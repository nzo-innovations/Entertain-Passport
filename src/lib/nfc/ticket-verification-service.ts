import { db } from "@/lib/db";
import { TicketStatus } from "@/lib/types";

export type TicketMatch = {
  ticketId: string;
  passportNo: string;
  holder: string;
  packageName: string;
  status: string;
};

/** Backend-only ticket validation - never trust NFC tag for ticket data. */
export async function findValidTicketForNfc(args: {
  rfidCardId: string;
  eventId: string;
}): Promise<TicketMatch | null> {
  const ticket = await db.ticket.findFirst({
    where: {
      rfidCardId: args.rfidCardId,
      orderItem: { eventId: args.eventId },
      status: TicketStatus.VALID,
    },
    include: {
      rfidCard: { select: { passportNo: true } },
      holder: { select: { name: true, email: true } },
      orderItem: {
        include: {
          package: { select: { name: true } },
          order: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });

  if (!ticket) return null;

  const holder =
    ticket.holderName ??
    ticket.holder?.name ??
    ticket.orderItem.order.user.name ??
    ticket.orderItem.order.user.email ??
    "Guest";

  return {
    ticketId: ticket.id,
    passportNo: ticket.rfidCard?.passportNo ?? "",
    holder,
    packageName: ticket.orderItem.package.name,
    status: ticket.status,
  };
}

export async function checkInTicket(ticketId: string, scannedById: string): Promise<void> {
  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.CHECKED_IN,
      checkedInAt: new Date(),
      checkedInById: scannedById,
    },
  });
}

export async function transferTicketsToCard(oldCardId: string, newCardId: string): Promise<number> {
  const result = await db.ticket.updateMany({
    where: { rfidCardId: oldCardId },
    data: { rfidCardId: newCardId },
  });
  return result.count;
}
