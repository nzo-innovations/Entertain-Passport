import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { findTicketByCode } from "@/lib/gate";
import { profileIdentityDisplay } from "@/lib/profile";
import { TicketStatus } from "@/lib/types";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, eventId } = (await req.json().catch(() => ({}))) as {
    code?: string;
    eventId?: string;
  };
  if (!code || !eventId) {
    return NextResponse.json({ error: "code and eventId required" }, { status: 400 });
  }

  const canScan = await canScanEventTickets(session.id, eventId, session.role);
  if (!canScan) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ticket = await findTicketByCode(eventId, code);
  if (!ticket) {
    return NextResponse.json({ ok: false, result: "INVALID", message: "Ticket not found" });
  }

  const summary = summarize(ticket);

  if (ticket.status === TicketStatus.CHECKED_IN) {
    return NextResponse.json({
      ok: false,
      result: "ALREADY_USED",
      message: "Already checked in",
      checkedInAt: ticket.checkedInAt,
      ticket: summary,
    });
  }

  if (ticket.status !== TicketStatus.VALID) {
    return NextResponse.json({
      ok: false,
      result: "INVALID_STATUS",
      message: `Ticket status: ${ticket.status}`,
      ticket: summary,
    });
  }

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: {
      status: TicketStatus.CHECKED_IN,
      checkedInAt: new Date(),
      checkedInById: session.id,
    },
    include: {
      rfidCard: { select: { passportNo: true } },
      holder: { select: { nic: true, idType: true, idNumber: true } },
      orderItem: {
        include: {
          package: { select: { name: true } },
          order: {
            include: {
              user: { select: { id: true, name: true, nic: true, idType: true, idNumber: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    result: "CHECKED_IN",
    message: "Entry granted",
    ticket: summarize(updated),
  });
}

function summarize(ticket: {
  id: string;
  status: string;
  checkedInAt: Date | null;
  holderUserId: string | null;
  holderNic: string | null;
  rfidCard?: { passportNo: string | null } | null;
  holder?: { nic?: string | null; idType?: string | null; idNumber?: string | null } | null;
  orderItem: {
    package: { name: string };
    order: { user: { id: string; name: string | null; nic?: string | null; idType?: string | null; idNumber?: string | null } };
  };
}) {
  const buyer = ticket.orderItem.order.user;
  const identity =
    ticket.rfidCard?.passportNo ??
    (ticket.holderNic ? `ID ${ticket.holderNic}` : null) ??
    profileIdentityDisplay(ticket.holder) ??
    (ticket.holderUserId === buyer.id ? profileIdentityDisplay(buyer) : null) ??
    "Entertain Passport";

  return {
    id: ticket.id,
    identity,
    status: ticket.status,
    checkedInAt: ticket.checkedInAt,
    packageName: ticket.orderItem.package.name,
    holderName: buyer.name,
  };
}
