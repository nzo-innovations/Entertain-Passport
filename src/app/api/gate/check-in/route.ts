import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { findTicketByCode, getEventCheckinStats } from "@/lib/gate";
import { getGatePhysicalSuggestionsForTicket } from "@/lib/physical-tickets";
import { TicketStatus } from "@/lib/types";
import { profileIdentityDisplay } from "@/lib/profile";

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

  // Gate staff can ONLY check in tickets for events they are assigned to.
  const allowed = await canScanEventTickets(session.id, eventId, session.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ticket = await findTicketByCode(eventId, code);
  const stats = await getEventCheckinStats(eventId);

  if (!ticket) {
    return NextResponse.json({ ok: false, result: "INVALID", message: "Ticket not found for this event", stats });
  }

  const holder = ticket.holderName ?? ticket.orderItem.order.user.name ?? ticket.orderItem.order.user.email;
  const identity =
    ticket.rfidCard?.passportNo ??
    (ticket.holderNic ? `ID ${ticket.holderNic}` : null) ??
    profileIdentityDisplay(ticket.holder) ??
    (ticket.holderUserId === ticket.orderItem.order.user.id
      ? profileIdentityDisplay(ticket.orderItem.order.user)
      : null) ??
    "Entertain Passport";
  const summary = {
    id: ticket.id,
    holder,
    packageName: ticket.orderItem.package.name,
    identity,
    passportNo: ticket.rfidCard?.passportNo ?? null,
    checkedInAt: ticket.checkedInAt,
    isBulk: false as boolean,
  };

  // Flag bulk purchases so gate staff can open the order group.
  const orderTicketCount = await db.ticket.count({
    where: { orderItem: { orderId: ticket.orderItem.orderId, eventId } },
  });
  summary.isBulk = orderTicketCount > 1;

  if (ticket.status === TicketStatus.CHECKED_IN) {
    return NextResponse.json({
      ok: false,
      result: "ALREADY_USED",
      message: "Already checked in",
      ticket: summary,
      stats,
    });
  }
  if (ticket.status !== TicketStatus.VALID) {
    return NextResponse.json({
      ok: false,
      result: "INVALID_STATUS",
      message: `Ticket status: ${ticket.status}`,
      ticket: summary,
      stats,
    });
  }

  await db.ticket.update({
    where: { id: ticket.id },
    data: { status: TicketStatus.CHECKED_IN, checkedInAt: new Date(), checkedInById: session.id },
  });

  const [after, physicalTickets] = await Promise.all([
    getEventCheckinStats(eventId),
    getGatePhysicalSuggestionsForTicket(eventId, ticket.id),
  ]);
  return NextResponse.json({
    ok: true,
    result: "CHECKED_IN",
    message: "Entry granted",
    ticket: { ...summary, checkedInAt: new Date() },
    physicalTickets,
    stats: after,
  });
}
