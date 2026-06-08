import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageCheckIns } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { TicketStatus } from "@/lib/types";

// Reverse a wrong check-in. Restricted to Event Managers (and owners/admins).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = (await req.json().catch(() => ({}))) as { ticketId?: string };
  if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 });

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { orderItem: { select: { eventId: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const allowed = await canManageCheckIns(session.id, ticket.orderItem.eventId, session.role);
  if (!allowed) {
    return NextResponse.json(
      { error: "Only an event manager can roll back a check-in." },
      { status: 403 }
    );
  }

  if (ticket.status !== TicketStatus.CHECKED_IN) {
    return NextResponse.json({ error: "Ticket is not checked in." }, { status: 400 });
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { status: TicketStatus.VALID, checkedInAt: null, checkedInById: null },
  });
  await logAudit(session.id, "ROLLBACK", "Ticket", ticketId, { eventId: ticket.orderItem.eventId });

  return NextResponse.json({ ok: true });
}
