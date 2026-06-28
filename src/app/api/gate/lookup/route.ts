import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { getOrderGroupForTicket, lookupByCode } from "@/lib/gate-order";

// Look up a ticket + full purchase group (buyer + all tickets in the order for this event).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const code = (url.searchParams.get("code") ?? "").trim();
  const ticketId = (url.searchParams.get("ticketId") ?? "").trim();

  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
  if (!code && !ticketId) {
    return NextResponse.json({ error: "code or ticketId required" }, { status: 400 });
  }

  const allowed = await canScanEventTickets(session.id, eventId, session.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (ticketId) {
    const group = await getOrderGroupForTicket(ticketId, eventId);
    if (!group) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const ticket = group.tickets.find((t) => t.id === ticketId);
    return NextResponse.json({
      ticketId,
      holder: ticket?.label ?? "Guest",
      kind: ticket?.kind,
      status: ticket?.status,
      identity: ticket?.identity,
      passportNo: ticket?.passportNo,
      packageName: group.packageName,
      checkedInAt: ticket?.checkedInAt ?? null,
      group,
    });
  }

  const result = await lookupByCode(eventId, code);
  if (!result) return NextResponse.json({ error: "Ticket not found for this event" }, { status: 404 });
  return NextResponse.json(result);
}
