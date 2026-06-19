import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { adjustLoyaltyPoints, LoyaltyOfferError } from "@/lib/loyalty/offers";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email().optional(),
  userId: z.string().optional(),
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Delta must be non-zero."),
  reason: z.string().min(2).max(200),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid adjustment." }, { status: 400 });
  }

  const userId =
    parsed.data.userId ??
    (parsed.data.email
      ? (await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }))?.id
      : undefined);

  if (!userId) return NextResponse.json({ error: "User not found." }, { status: 404 });

  try {
    const entry = await adjustLoyaltyPoints({
      userId,
      delta: parsed.data.delta,
      reason: parsed.data.reason.trim(),
      grantedById: admin.id,
    });
    await logAudit(admin.id, "CREATE", "LoyaltyEntry", entry.id, {
      userId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    if (err instanceof LoyaltyOfferError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
