import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_CARD_PRICE = 50_000;
const SHIPPING_METHOD = "SL_REGISTERED_POST";

const schema = z.object({
  paymentTiming: z.enum(["PAY_NOW", "DEFER_TO_NEXT_ORDER"]),
  quantity: z.number().int().min(1).max(4).default(1),
});

function addressIsComplete(address: {
  line1: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
}) {
  return Boolean(address.line1 && address.city && address.district && address.province);
}

async function buildShippingSnapshot(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { addresses: { orderBy: { isPrimary: "desc" }, take: 1 } },
  });
  if (!user) return null;
  const address = user.addresses[0];
  if (!user.phone || !address || !addressIsComplete(address)) return null;
  return { user, address };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, orders] = await Promise.all([
    db.platformSettings.findUnique({ where: { id: "default" } }),
    db.passportCardOrder.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const pendingCheckout = orders.find((o) => o.status === "PENDING_PAYMENT") ?? null;

  return NextResponse.json({
    price: settings?.passportCardPrice ?? DEFAULT_CARD_PRICE,
    deferredTotal: orders
      .filter((order) => order.status === "DEFERRED")
      .reduce((sum, order) => sum + order.total, 0),
    pendingCheckout,
    orders,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card order request." }, { status: 400 });
  }

  const shipping = await buildShippingSnapshot(session.id);
  if (!shipping) {
    return NextResponse.json(
      { error: "Add your mobile number and full address before ordering a card." },
      { status: 409 }
    );
  }

  const { user, address } = shipping;
  const settings = await db.platformSettings.findUnique({ where: { id: "default" } });
  const unitPrice = settings?.passportCardPrice ?? DEFAULT_CARD_PRICE;
  const quantity = parsed.data.quantity;
  const total = unitPrice * quantity;
  const payNow = parsed.data.paymentTiming === "PAY_NOW";

  if (payNow) {
    const existingDeferred = await db.passportCardOrder.findFirst({
      where: { userId: session.id, status: "DEFERRED" },
      orderBy: { createdAt: "desc" },
    });
    if (existingDeferred) {
      return NextResponse.json({
        ok: true,
        checkout: true,
        order: existingDeferred,
      });
    }

    const existingPending = await db.passportCardOrder.findFirst({
      where: { userId: session.id, status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "desc" },
    });
    if (existingPending) {
      return NextResponse.json({
        ok: true,
        checkout: true,
        order: existingPending,
      });
    }

    await db.passportCardOrder.updateMany({
      where: { userId: session.id, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });

    const order = await db.passportCardOrder.create({
      data: {
        userId: session.id,
        quantity,
        unitPrice,
        total,
        currency: "LKR",
        paymentTiming: "PAY_NOW",
        status: "PENDING_PAYMENT",
        shippingMethod: SHIPPING_METHOD,
        shippingName: user.name,
        shippingPhone: user.phone,
        addressId: address.id,
        addressSnapshotJson: JSON.stringify({
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          district: address.district,
          province: address.province,
          country: address.country,
          zip: address.zip,
        }),
      },
    });

    return NextResponse.json({ ok: true, checkout: true, order });
  }

  const order = await db.passportCardOrder.create({
    data: {
      userId: session.id,
      quantity,
      unitPrice,
      total,
      currency: "LKR",
      paymentTiming: "DEFER_TO_NEXT_ORDER",
      status: "DEFERRED",
      shippingMethod: SHIPPING_METHOD,
      shippingName: user.name,
      shippingPhone: user.phone,
      addressId: address.id,
      addressSnapshotJson: JSON.stringify({
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        district: address.district,
        province: address.province,
        country: address.country,
        zip: address.zip,
      }),
    },
  });

  return NextResponse.json({ ok: true, checkout: false, order });
}
