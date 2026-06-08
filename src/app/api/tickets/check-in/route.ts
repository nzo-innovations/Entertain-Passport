import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { parseQrPayload } from "@/lib/tickets";
import { TicketStatus } from "@/lib/types";

const ticketSelect = {
  id: true,
  barcode: true,
  status: true,
  checkedInAt: true,
  orderItem: {
    select: {
      eventId: true,
      event: { select: { id: true, title: true, slug: true } },
      package: { select: { name: true } },
      order: { select: { user: { select: { name: true, email: true } } } },
    },
  },
} as const;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { barcode: raw, eventId } = (await req.json()) as {
      barcode?: string;
      eventId?: string;
    };
    if (!raw || !eventId) {
      return NextResponse.json({ error: "barcode and eventId required" }, { status: 400 });
    }

    const canScan = await canScanEventTickets(session.id, eventId, session.role);
    if (!canScan) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { ticketId, barcode } = parseQrPayload(raw);

    const ticket = ticketId
      ? await db.ticket.findUnique({
          where: { id: ticketId },
          select: ticketSelect,
        })
      : await db.ticket.findFirst({
          where: { OR: [{ barcode }, { qrCode: raw }] },
          select: ticketSelect,
        });

    if (!ticket || (ticketId && ticket.barcode !== barcode)) {
      return NextResponse.json({ ok: false, result: "INVALID", message: "Ticket not found" });
    }

    if (ticket.orderItem.eventId !== eventId) {
      return NextResponse.json({
        ok: false,
        result: "WRONG_EVENT",
        message: "This ticket is for a different event",
        eventTitle: ticket.orderItem.event.title,
      });
    }

    if (ticket.status === TicketStatus.CHECKED_IN) {
      return NextResponse.json({
        ok: false,
        result: "ALREADY_USED",
        message: "Ticket already checked in",
        checkedInAt: ticket.checkedInAt,
        ticket: summarize(ticket),
      });
    }

    if (ticket.status !== TicketStatus.VALID) {
      return NextResponse.json({
        ok: false,
        result: "INVALID_STATUS",
        message: `Ticket status: ${ticket.status}`,
      });
    }

    const updated = await db.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.CHECKED_IN,
        checkedInAt: new Date(),
        checkedInById: session.id,
      },
      select: ticketSelect,
    });

    return NextResponse.json({
      ok: true,
      result: "CHECKED_IN",
      message: "Entry granted",
      ticket: summarize(updated),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check-in failed" },
      { status: 500 }
    );
  }
}

function summarize(ticket: {
  id: string;
  barcode: string;
  status: string;
  checkedInAt: Date | null;
  orderItem: {
    package: { name: string };
    order: { user: { name: string | null } };
  };
}) {
  return {
    id: ticket.id,
    barcode: ticket.barcode,
    status: ticket.status,
    checkedInAt: ticket.checkedInAt,
    packageName: ticket.orderItem.package.name,
    holderName: ticket.orderItem.order.user.name,
  };
}
