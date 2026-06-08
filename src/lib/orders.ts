import { randomUUID } from "crypto";
import { db } from "./db";
import { generateBarcode, generateQrPayload } from "./tickets";
import { OrderStatus, TicketStatus } from "./types";

export type CheckoutItem = { packageId: string; qty: number };

export class CheckoutError extends Error {}

/**
 * Creates a paid order and issues tickets atomically.
 * Uses conditional inventory updates to prevent overselling under concurrent checkout.
 */
export async function createPaidOrder(
  userId: string,
  items: CheckoutItem[],
  paymentRef = `demo_${Date.now()}`
) {
  if (!items.length) throw new CheckoutError("Cart is empty");

  const packageIds = items.map((i) => i.packageId);

  const [packages, passport] = await Promise.all([
    db.ticketPackage.findMany({
      where: { id: { in: packageIds } },
      select: {
        id: true,
        name: true,
        price: true,
        qtyTotal: true,
        qtySold: true,
        event: { select: { id: true, commissionPct: true, currency: true } },
      },
    }),
    db.rfidCard.findFirst({
      where: { assignedUserId: userId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  const lines = items.map((item) => {
    const pkg = packages.find((p) => p.id === item.packageId);
    if (!pkg) throw new CheckoutError("Ticket package no longer available");
    if (item.qty < 1 || item.qty > 20) throw new CheckoutError("Invalid quantity");
    if (pkg.qtySold + item.qty > pkg.qtyTotal) {
      throw new CheckoutError(`Not enough tickets left for ${pkg.name}`);
    }
    return { pkg, qty: item.qty };
  });

  const subtotal = lines.reduce((s, l) => s + l.pkg.price * l.qty, 0);
  const fees = Math.round(subtotal * 0.025);
  const commissionAmt = lines.reduce(
    (s, l) => s + Math.round(l.pkg.price * l.qty * ((l.pkg.event.commissionPct ?? 5) / 100)),
    0
  );
  const total = subtotal + fees;
  const currency = lines[0]?.pkg.event.currency ?? "LKR";
  const loyaltyEarned = passport ? Math.floor(subtotal / 100) : 0;

  return db.$transaction(async (tx) => {
    // Reserve inventory first — fails if another checkout took the last tickets.
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
        subtotal,
        fees,
        commissionAmt,
        total,
        currency,
        paymentRef,
        loyaltyEarned,
      },
    });

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

        const ticketRows = Array.from({ length: qty }, () => {
          const ticketId = randomUUID();
          const barcode = generateBarcode();
          return {
            id: ticketId,
            orderItemId: orderItem.id,
            barcode,
            qrCode: generateQrPayload(ticketId, barcode),
            status: TicketStatus.VALID,
            holderUserId: userId,
            rfidCardId: passport?.id ?? null,
          };
        });

        await tx.ticket.createMany({ data: ticketRows });
      })
    );

    if (loyaltyEarned > 0) {
      await tx.loyaltyEntry.create({
        data: { userId, delta: loyaltyEarned, reason: "Order earned", refId: order.id },
      });
      await tx.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: loyaltyEarned } },
      });
    }

    return order;
  });
}
