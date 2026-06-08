import { db } from "./db";
import { UserRole, TicketStatus } from "./types";
import { parseQrPayload } from "./tickets";

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
 * Resolves a typed/tapped code to a ticket for a given event. Accepts (in order)
 * the printed ticket code, the internal barcode, the QR payload, or an NFC/RFID
 * Entertain Passport (chip UID or passport number).
 */
export async function findTicketByCode(eventId: string, rawCode: string) {
  const code = rawCode.trim();
  if (!code) return null;

  const include = {
    rfidCard: { select: { passportNo: true, uid: true } },
    holder: { select: { id: true, name: true, email: true } },
    orderItem: {
      include: {
        event: { select: { id: true, title: true } },
        package: { select: { name: true } },
        order: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    },
  } as const;

  // 1) Printed ticket code (scoped to event)
  let ticket = await db.ticket.findFirst({
    where: { ticketCode: code, orderItem: { eventId } },
    include,
  });
  if (ticket) return ticket;

  // 2) Internal barcode / QR payload
  const { barcode } = parseQrPayload(code);
  ticket = await db.ticket.findFirst({
    where: { OR: [{ barcode }, { barcode: code }, { qrCode: code }], orderItem: { eventId } },
    include,
  });
  if (ticket) return ticket;

  // 3) NFC/RFID Entertain Passport: chip UID or passport number -> a VALID ticket
  //    linked to that card for this event (fall back to any of its tickets).
  const card = await db.rfidCard.findFirst({
    where: { OR: [{ uid: code }, { passportNo: code }] },
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
