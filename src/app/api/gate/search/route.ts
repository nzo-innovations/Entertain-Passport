import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { TicketStatus } from "@/lib/types";

const PAGE_SIZE = 15;

// Paginated attendee search for gate staff (checked-in log + pending lookup).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "checked_in"; // checked_in | pending | all
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const allowed = await canScanEventTickets(session.id, eventId, session.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const statusFilter =
    status === "pending"
      ? { status: TicketStatus.VALID }
      : status === "all"
      ? { status: { in: [TicketStatus.VALID, TicketStatus.CHECKED_IN] } }
      : { status: TicketStatus.CHECKED_IN };

  const where = {
    orderItem: { eventId },
    ...statusFilter,
    ...(q
      ? {
          OR: [
            { ticketCode: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
            { holderName: { contains: q, mode: "insensitive" as const } },
            { holderNic: { contains: q, mode: "insensitive" as const } },
            { rfidCard: { passportNo: { contains: q, mode: "insensitive" as const } } },
            { orderItem: { order: { user: { name: { contains: q, mode: "insensitive" as const } } } } },
            { orderItem: { order: { user: { email: { contains: q, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };

  const [total, tickets] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.findMany({
      where,
      include: {
        rfidCard: { select: { passportNo: true } },
        holder: { select: { id: true, name: true, email: true } },
        orderItem: {
          include: {
            package: { select: { name: true } },
            order: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                items: {
                  where: { eventId },
                  select: { id: true, qty: true },
                },
              },
            },
          },
        },
      },
      orderBy: status === "pending" ? { createdAt: "asc" } : { checkedInAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // Group sizes per order for holder labelling.
  const orderQtyCache = new Map<string, number>();

  return NextResponse.json({
    tickets: tickets.map((t) => {
      const buyer = t.orderItem.order.user;
      const orderId = t.orderItem.orderId;
      if (!orderQtyCache.has(orderId)) {
        orderQtyCache.set(orderId, t.orderItem.order.items.reduce((s, i) => s + i.qty, 0));
      }
      const totalInOrder = orderQtyCache.get(orderId) ?? 1;

      return {
        id: t.id,
        holder: t.holderName ?? buyer.name ?? "Guest",
        buyerName: buyer.name ?? buyer.email,
        buyerEmail: buyer.email,
        packageName: t.orderItem.package.name,
        code: t.ticketCode ?? t.barcode,
        passportNo: t.rfidCard?.passportNo ?? null,
        status: t.status,
        checkedInAt: t.checkedInAt,
        orderTicketCount: totalInOrder,
        isBulk: totalInOrder > 1,
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
