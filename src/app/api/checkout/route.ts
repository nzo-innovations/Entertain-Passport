import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { createPaidOrder, CheckoutError } from "@/lib/orders";
import type { TicketHolderInput } from "@/lib/checkout-holders";

const holderSchema = z.object({
  type: z.enum(["self", "passport", "identity"]),
  passportNo: z.string().trim().max(40).optional(),
  idType: z.enum(["NIC", "PASSPORT"]).optional(),
  idNumber: z.string().trim().max(40).optional(),
  name: z.string().trim().max(80).optional(),
});

const schema = z.object({
  items: z
    .array(
      z.object({
        packageId: z.string().min(1),
        qty: z.number().int().min(1),
      })
    )
    .default([]),
  seatedItems: z
    .array(
      z.object({
        eventId: z.string().min(1),
        seatExternalIds: z.array(z.string().min(1)).min(1),
      })
    )
    .optional()
    .default([]),
  passportCardOrderIds: z.array(z.string().min(1)).optional(),
  ticketHolders: z.array(holderSchema).optional(),
}).refine(
  (d) =>
    d.items.length > 0 ||
    (d.seatedItems?.length ?? 0) > 0 ||
    (d.passportCardOrderIds?.length ?? 0) > 0,
  { message: "Cart is empty." }
);

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in to complete your purchase." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  try {
    const order = await createPaidOrder(
      userId,
      parsed.data.items,
      `demo_${Date.now()}`,
      parsed.data.ticketHolders as TicketHolderInput[] | undefined,
      parsed.data.passportCardOrderIds,
      parsed.data.seatedItems
    );
    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Checkout failed", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
