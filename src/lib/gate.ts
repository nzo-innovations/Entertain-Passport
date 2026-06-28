import { db } from "./db";
import { normalizeIdentityLookup } from "./identity";
import { UserRole, TicketStatus } from "./types";

/** Events a user is allowed to run gate check-in for. */
export async function getGateEventsForUser(userId: string, role?: string) {
  if (role === UserRole.SUPER_ADMIN) {
    return db.event.findMany({
      include: { venue: true, category: true },
      orderBy: { startsAt: "asc" },
    });
  }
  return db.event.findMany({
    where: { staff: { some: { userId } } },
    include: { venue: true, category: true },
    orderBy: { startsAt: "asc" },
  });
}

export async function getEventCheckinStats(eventId: string) {
  const [total, checkedIn] = await Promise.all([
    db.ticket.count({
      where: { orderItem: { eventId }, status: { in: [TicketStatus.VALID, TicketStatus.CHECKED_IN] } },
    }),
    db.ticket.count({ where: { orderItem: { eventId }, status: TicketStatus.CHECKED_IN } }),
  ]);
  return { total, checkedIn, pending: total - checkedIn };
}

export type ResolvedTicket = Awaited<ReturnType<typeof findTicketByCode>>;

/**
 * Resolves a typed/tapped code to a ticket for a given event. Gate lookup is
 * limited to customer NIC/passport identity or an Entertain Passport card UID/card number.
 */
export async function findTicketByCode(eventId: string, rawCode: string) {
  const code = rawCode.trim();
  if (!code) return null;
  const identityNumber = normalizeIdentityLookup(code);
  const insensitive = "insensitive" as const;

  const include = {
    rfidCard: { select: { passportNo: true, uid: true } },
    holder: { select: { id: true, name: true, email: true, nic: true, idType: true, idNumber: true } },
    orderItem: {
      include: {
        event: { select: { id: true, title: true } },
        package: { select: { id: true, name: true } },
        order: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, nic: true, idType: true, idNumber: true } },
          },
        },
      },
    },
  } as const;

  const identityMatches = [
    { holderNic: { equals: identityNumber, mode: insensitive } },
    { holder: { is: { nic: { equals: identityNumber, mode: insensitive } } } },
    { holder: { is: { idNumber: { equals: identityNumber, mode: insensitive } } } },
    { orderItem: { order: { user: { nic: { equals: identityNumber, mode: insensitive } } } } },
    { orderItem: { order: { user: { idNumber: { equals: identityNumber, mode: insensitive } } } } },
  ];

  // 1) NIC/passport typed at the gate. Prefer an unused ticket, then fall back so the
  // caller can surface "already checked in" instead of "not found".
  let ticket = await db.ticket.findFirst({
    where: { orderItem: { eventId }, status: TicketStatus.VALID, OR: identityMatches },
    include,
  });
  if (ticket) return ticket;
  ticket = await db.ticket.findFirst({
    where: { orderItem: { eventId }, OR: identityMatches },
    include,
  });
  if (ticket) return ticket;

  // 2) NFC Entertain Passport: chip UID or passport number -> a VALID ticket
  //    linked to that card for this event (fall back to any of its tickets).
  const card = await db.rfidCard.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        { uid: { equals: code, mode: insensitive } },
        { passportNo: { equals: code, mode: insensitive } },
      ],
    },
    select: { id: true },
  });
  if (card) {
    ticket =
      (await db.ticket.findFirst({
        where: { rfidCardId: card.id, orderItem: { eventId }, status: TicketStatus.VALID },
        include,
      })) ??
      (await db.ticket.findFirst({
        where: { rfidCardId: card.id, orderItem: { eventId } },
        include,
      }));
    if (ticket) return ticket;
  }

  return null;
}
