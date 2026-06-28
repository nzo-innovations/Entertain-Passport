import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { generatePassportNo } from "@/lib/rfid";

export function generatePassportId(): string {
  return randomUUID();
}

export async function uniquePassportNo(preferred?: string): Promise<string> {
  let passportNo = preferred?.trim() || generatePassportNo();
  for (let i = 0; i < 8; i++) {
    const exists = await db.rfidCard.findUnique({ where: { passportNo } });
    if (!exists) return passportNo;
    passportNo = generatePassportNo();
  }
  throw new Error("Could not allocate unique passport number.");
}

export async function fulfillPassportOrder(args: {
  orderId: string;
  cardId: string;
  fulfilledById: string;
}): Promise<void> {
  const order = await db.passportCardOrder.findUnique({ where: { id: args.orderId } });
  if (!order) throw new Error("Order not found.");

  const fulfilledCount = await db.rfidCard.count({
    where: { passportCardOrderId: args.orderId },
  });
  const allFulfilled = fulfilledCount >= order.quantity;

  await db.passportCardOrder.update({
    where: { id: args.orderId },
    data: {
      fulfilledAt: allFulfilled ? new Date() : order.fulfilledAt,
      fulfilledById: args.fulfilledById,
      status: allFulfilled ? "FULFILLED" : order.status,
    },
  });
}
