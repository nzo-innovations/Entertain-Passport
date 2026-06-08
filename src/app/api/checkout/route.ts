import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { createPaidOrder, CheckoutError } from "@/lib/orders";

const schema = z.object({
  items: z
    .array(
      z.object({
        packageId: z.string().min(1),
        qty: z.number().int().min(1).max(20),
      })
    )
    .min(1),
});

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
    const order = await createPaidOrder(userId, parsed.data.items);
    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Checkout failed", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
