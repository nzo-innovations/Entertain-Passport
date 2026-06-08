import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageEvent } from "@/lib/permissions";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageEvent(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const tickets = await db.ticket.findMany({
    where: {
      orderItem: { eventId: params.id },
      ...(q
        ? {
            OR: [
              { ticketCode: { contains: q, mode: "insensitive" } },
              { holderName: { contains: q, mode: "insensitive" } },
              { orderItem: { order: { user: { name: { contains: q, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    },
    include: {
      rfidCard: { select: { passportNo: true } },
      orderItem: {
        include: {
          package: { select: { name: true } },
          order: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      holder: t.holderName ?? t.orderItem.order.user.name ?? "Guest",
      packageName: t.orderItem.package.name,
      status: t.status,
      ticketCode: t.ticketCode ?? "",
      passportNo: t.rfidCard?.passportNo ?? "",
    })),
  });
}

const patchSchema = z.object({
  ticketId: z.string().min(1),
  ticketCode: z.string().trim().max(64).optional(),
  passportNo: z.string().trim().max(40).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageEvent(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const ticket = await db.ticket.findFirst({
    where: { id: parsed.data.ticketId, orderItem: { eventId: params.id } },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found for this event." }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (parsed.data.ticketCode !== undefined) {
    data.ticketCode = parsed.data.ticketCode || null;
  }

  if (parsed.data.passportNo !== undefined) {
    if (!parsed.data.passportNo) {
      data.rfidCardId = null;
    } else {
      const card = await db.rfidCard.findFirst({
        where: { OR: [{ passportNo: parsed.data.passportNo }, { uid: parsed.data.passportNo }] },
        select: { id: true },
      });
      if (!card) return NextResponse.json({ error: "No passport with that number/UID." }, { status: 404 });
      data.rfidCardId = card.id;
    }
  }

  try {
    await db.ticket.update({ where: { id: ticket.id }, data });
  } catch {
    return NextResponse.json({ error: "That ticket code is already in use." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
