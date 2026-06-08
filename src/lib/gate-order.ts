import { db } from "./db";
import { describeTicketHolder } from "./gate-holders";
import { findTicketByCode } from "./gate";

export async function getOrderGroupForTicket(ticketId: string, eventId: string) {
  const anchor = await db.ticket.findFirst({
    where: { id: ticketId, orderItem: { eventId } },
    include: {
      rfidCard: { select: { passportNo: true } },
      holder: { select: { id: true, name: true, email: true } },
      orderItem: {
        include: {
          package: { select: { name: true } },
          order: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });
  if (!anchor) return null;

  const buyer = anchor.orderItem.order.user;
  const orderId = anchor.orderItem.orderId;

  const tickets = await db.ticket.findMany({
    where: { orderItem: { orderId, eventId } },
    include: {
      rfidCard: { select: { passportNo: true } },
      holder: { select: { id: true, name: true, email: true } },
      orderItem: { include: { package: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    orderId,
    purchasedAt: anchor.orderItem.order.createdAt,
    buyer: {
      id: buyer.id,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
    },
    packageName: anchor.orderItem.package.name,
    ticketCount: tickets.length,
    tickets: tickets.map((t, index) => {
      const { label, kind } = describeTicketHolder(t, buyer, index, tickets.length);
      return {
        id: t.id,
        slot: index + 1,
        label,
        kind,
        status: t.status,
        code: t.ticketCode ?? t.barcode,
        passportNo: t.rfidCard?.passportNo ?? null,
        checkedInAt: t.checkedInAt,
        isHighlighted: t.id === ticketId,
      };
    }),
  };
}

export async function lookupByCode(eventId: string, code: string) {
  const ticket = await findTicketByCode(eventId, code);
  if (!ticket) return null;
  const group = await getOrderGroupForTicket(ticket.id, eventId);
  if (!group) return null;

  const idx = group.tickets.findIndex((t) => t.id === ticket.id);
  const { label, kind } = describeTicketHolder(
    ticket,
    group.buyer,
    idx >= 0 ? idx : 0,
    group.tickets.length
  );

  return {
    ticketId: ticket.id,
    holder: label,
    kind,
    status: ticket.status,
    code: ticket.ticketCode ?? ticket.barcode,
    passportNo: ticket.rfidCard?.passportNo ?? null,
    packageName: ticket.orderItem.package.name,
    checkedInAt: ticket.checkedInAt,
    group,
  };
}
