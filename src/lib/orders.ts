import { randomUUID } from "crypto";
import { db } from "./db";
import { generateBarcode, generateQrPayload } from "./tickets";
import { OrderStatus, TicketStatus } from "./types";
import { calculateEarnedPoints, getLoyaltySettings } from "./loyalty/config";
import {
  resolveTicketHolder,
  validateTicketHolders,
  type TicketHolderInput,
} from "./checkout-holders";

import {
  validateUserSeatHold,
  heartbeatSeatHold,
  SeatHoldError,
} from "./seating/seat-hold-service";
import { SEAT_HOLD_PHASE } from "./seating/constants";

export type CheckoutItem = { packageId: string; qty: number };

export type SeatedCheckoutItem = {
  eventId: string;
  seatExternalIds: string[];
};

export class CheckoutError extends Error {}

export { type TicketHolderInput };

/**
 * Creates a paid order and issues tickets atomically.
 * Uses conditional inventory updates to prevent overselling under concurrent checkout.
 */
export async function createPaidOrder(
  userId: string,
  items: CheckoutItem[],
  paymentRef = `demo_${Date.now()}`,
  ticketHolders?: TicketHolderInput[],
  passportCardOrderIds?: string[],
  seatedItems: SeatedCheckoutItem[] = []
) {
  const hasPackageTickets = items.length > 0;
  const hasSeatedTickets = seatedItems.some((s) => s.seatExternalIds.length > 0);
  const hasTickets = hasPackageTickets || hasSeatedTickets;
  const hasPassportPayNow = (passportCardOrderIds?.length ?? 0) > 0;
  if (!hasTickets && !hasPassportPayNow) {
    throw new CheckoutError("Your cart is empty.");
  }

  const packageIds = items.map((i) => i.packageId);

  for (const seated of seatedItems) {
    if (seated.seatExternalIds.length) {
      await heartbeatSeatHold(seated.eventId, userId, SEAT_HOLD_PHASE.CHECKOUT);
    }
  }

  const seatedValidations = await Promise.all(
    seatedItems
      .filter((s) => s.seatExternalIds.length > 0)
      .map(async (s) => {
        try {
          return await validateUserSeatHold(s.eventId, userId, s.seatExternalIds);
        } catch (err) {
          if (err instanceof SeatHoldError) {
            throw new CheckoutError(err.message);
          }
          throw err;
        }
      })
  );
  const seatedTicketCount = seatedValidations.reduce(
    (sum, v) => sum + v.seatDbIds.length,
    0
  );

  const [packages, passport, loyaltySettings, deferredCardOrders, payNowPassportOrders] =
    await Promise.all([
      hasPackageTickets
        ? db.ticketPackage.findMany({
            where: { id: { in: packageIds } },
            select: {
              id: true,
              name: true,
              price: true,
              qtyTotal: true,
              qtySold: true,
              event: { select: { id: true, commissionPct: true, currency: true } },
            },
          })
        : Promise.resolve([]),
      db.rfidCard.findFirst({
        where: { assignedUserId: userId, status: "ACTIVE" },
        select: { id: true },
      }),
      getLoyaltySettings(),
      hasTickets
        ? db.passportCardOrder.findMany({
            where: {
              userId,
              status: "DEFERRED",
              ...(passportCardOrderIds?.length
                ? { id: { notIn: passportCardOrderIds } }
                : {}),
            },
            select: { id: true, total: true },
          })
        : Promise.resolve([]),
      hasPassportPayNow
        ? db.passportCardOrder.findMany({
            where: {
              userId,
              id: { in: passportCardOrderIds! },
              status: { in: ["PENDING_PAYMENT", "DEFERRED"] },
            },
            select: { id: true, total: true },
          })
        : Promise.resolve([]),
    ]);

  if (hasPassportPayNow && payNowPassportOrders.length !== passportCardOrderIds!.length) {
    throw new CheckoutError("Entertain Passport card order is no longer available for checkout.");
  }

  const lines = hasPackageTickets
    ? items.map((item) => {
        const pkg = packages.find((p) => p.id === item.packageId);
        if (!pkg) throw new CheckoutError("Ticket package no longer available");
        if (item.qty < 1 || item.qty > 20) throw new CheckoutError("Invalid quantity");
        if (pkg.qtySold + item.qty > pkg.qtyTotal) {
          throw new CheckoutError(`Not enough tickets left for ${pkg.name}`);
        }
        return { pkg, qty: item.qty };
      })
    : [];

  const totalTickets = lines.reduce((s, l) => s + l.qty, 0) + seatedTicketCount;
  let holders: TicketHolderInput[] = [];
  if (totalTickets > 0) {
    try {
      holders = validateTicketHolders(
        ticketHolders ?? Array.from({ length: totalTickets }, () => ({ type: "self" as const })),
        totalTickets
      );
    } catch (err) {
      throw new CheckoutError(err instanceof Error ? err.message : "Invalid ticket holders.");
    }
  }

  const seatedSubtotal = seatedValidations.reduce((s, v) => s + v.totalCents, 0);
  const ticketSubtotal = lines.reduce((s, l) => s + l.pkg.price * l.qty, 0) + seatedSubtotal;
  const passportPayNowTotal = payNowPassportOrders.reduce((sum, order) => sum + order.total, 0);
  const passportDeferredTotal = deferredCardOrders.reduce((sum, order) => sum + order.total, 0);
  const passportCardTotal = passportPayNowTotal + passportDeferredTotal;
  const subtotal = ticketSubtotal + passportPayNowTotal;
  const fees = Math.round(subtotal * 0.025);
  const commissionAmt =
    lines.reduce(
      (s, l) => s + Math.round(l.pkg.price * l.qty * ((l.pkg.event.commissionPct ?? 5) / 100)),
      0
    ) +
    seatedValidations.reduce((s, v, i) => {
      const eventId = seatedItems.filter((x) => x.seatExternalIds.length)[i]?.eventId;
      return s + Math.round(v.totalCents * 0.05); // default 5% when seated
    }, 0);
  const total = subtotal + fees + passportDeferredTotal;
  const currency =
    lines[0]?.pkg.event.currency ??
    (seatedItems[0]
      ? (
          await db.event.findUnique({
            where: { id: seatedItems[0].eventId },
            select: { currency: true },
          })
        )?.currency ?? "LKR"
      : "LKR");
  const loyaltyEarned = calculateEarnedPoints(ticketSubtotal, loyaltySettings, !!passport);

  const passportOrdersToMarkPaid = [
    ...payNowPassportOrders.map((o) => o.id),
    ...deferredCardOrders.map((o) => o.id),
  ];

  return db.$transaction(async (tx) => {
    for (const { pkg, qty } of lines) {
      const reserved = await tx.ticketPackage.updateMany({
        where: {
          id: pkg.id,
          qtySold: { lte: pkg.qtyTotal - qty },
        },
        data: { qtySold: { increment: qty } },
      });
      if (reserved.count !== 1) {
        throw new CheckoutError(`Not enough tickets left for ${pkg.name}`);
      }
    }

    const order = await tx.order.create({
      data: {
        userId,
        status: OrderStatus.PAID,
        subtotal: ticketSubtotal,
        fees,
        passportCardTotal,
        commissionAmt,
        total,
        currency,
        paymentRef,
        loyaltyEarned,
      },
    });

    let holderIndex = 0;

    await Promise.all(
      lines.map(async ({ pkg, qty }) => {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            eventId: pkg.event.id,
            packageId: pkg.id,
            qty,
            unitPrice: pkg.price,
          },
        });

        for (let i = 0; i < qty; i++) {
          const holderInput = holders[holderIndex++] ?? { type: "self" as const };
          let holderData;
          try {
            holderData = await resolveTicketHolder(
              userId,
              holderInput,
              passport?.id ?? null,
              tx
            );
          } catch (err) {
            throw new CheckoutError(
              err instanceof Error ? err.message : "Could not assign ticket holder."
            );
          }
          const ticketId = randomUUID();
          const barcode = generateBarcode();
          await tx.ticket.create({
            data: {
              id: ticketId,
              orderItemId: orderItem.id,
              barcode,
              qrCode: generateQrPayload(ticketId, barcode),
              status: TicketStatus.VALID,
              ...holderData,
            },
          });
        }
      })
    );

    for (let si = 0; si < seatedValidations.length; si++) {
      const validation = seatedValidations[si];
      const seatedLine = seatedItems.filter((x) => x.seatExternalIds.length)[si];
      const eventId = seatedLine.eventId;

      let seatedPkg = await tx.ticketPackage.findFirst({
        where: { eventId, name: "Assigned Seating" },
      });
      if (!seatedPkg) {
        seatedPkg = await tx.ticketPackage.create({
          data: {
            eventId,
            name: "Assigned Seating",
            description: "Reserved seats",
            price: 0,
            qtyTotal: 99999,
            qtySold: 0,
            sortOrder: 99,
          },
        });
      }

      const map = await tx.eventSeatMap.findUnique({
        where: { eventId },
        include: { seats: true, categories: true },
      });
      if (!map) throw new CheckoutError("Seat map not found.");

      const catMap = new Map(map.categories.map((c) => [c.externalId, c]));

      for (const seatDbId of validation.seatDbIds) {
        const seat = map.seats.find((s) => s.id === seatDbId);
        if (!seat || seat.status !== "HELD") {
          throw new CheckoutError(`Seat ${seat?.label ?? "unknown"} is no longer available.`);
        }
        const cat = seat.categoryExternalId ? catMap.get(seat.categoryExternalId) : undefined;
        const unitPrice = cat?.price ?? 0;

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            eventId,
            packageId: seatedPkg.id,
            qty: 1,
            unitPrice,
            seatIds: JSON.stringify([seatDbId]),
          },
        });

        const holderInput = holders[holderIndex++] ?? { type: "self" as const };
        const holderData = await resolveTicketHolder(
          userId,
          holderInput,
          passport?.id ?? null,
          tx
        );
        const ticketId = randomUUID();
        const barcode = generateBarcode();
        await tx.ticket.create({
          data: {
            id: ticketId,
            orderItemId: orderItem.id,
            barcode,
            qrCode: generateQrPayload(ticketId, barcode),
            status: TicketStatus.VALID,
            seatId: seatDbId,
            ...holderData,
          },
        });

        await tx.seat.update({
          where: { id: seatDbId },
          data: { status: "SOLD" },
        });
      }

      await tx.seatHold.deleteMany({ where: { eventSeatMapId: map.id, userId } });
      await tx.ticketPackage.update({
        where: { id: seatedPkg.id },
        data: { qtySold: { increment: validation.seatDbIds.length } },
      });
    }

    if (loyaltyEarned > 0) {
      await tx.loyaltyEntry.create({
        data: { userId, delta: loyaltyEarned, reason: "Order earned", refId: order.id },
      });
      await tx.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: loyaltyEarned } },
      });
    }

    if (passportOrdersToMarkPaid.length > 0) {
      await tx.passportCardOrder.updateMany({
        where: {
          id: { in: passportOrdersToMarkPaid },
          userId,
          status: { in: ["PENDING_PAYMENT", "DEFERRED"] },
        },
        data: { status: "PAID", paymentRef: `order_${order.id}` },
      });
    }

    return order;
  });
}
