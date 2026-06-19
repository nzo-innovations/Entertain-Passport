import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getLoyaltySettings } from "@/lib/loyalty/config";
import { toMajor } from "@/lib/money";

const patchSchema = z.object({
  loyaltyEnabled: z.boolean(),
  loyaltyRequiresPassport: z.boolean(),
  /** Major currency units spent per point (e.g. 100 = LKR 100 per point). */
  loyaltySpendMajorPerPoint: z.number().min(1).max(1_000_000),
});

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getLoyaltySettings();
  return NextResponse.json({
    ...settings,
    loyaltySpendMajorPerPoint: toMajor(settings.loyaltyMinorPerPoint),
  });
}

export async function PATCH(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid loyalty settings." }, { status: 400 });
  }

  const loyaltyMinorPerPoint = Math.round(parsed.data.loyaltySpendMajorPerPoint * 100);

  const settings = await db.platformSettings.upsert({
    where: { id: "default" },
    update: {
      loyaltyEnabled: parsed.data.loyaltyEnabled,
      loyaltyRequiresPassport: parsed.data.loyaltyRequiresPassport,
      loyaltyMinorPerPoint,
    },
    create: {
      id: "default",
      loyaltyEnabled: parsed.data.loyaltyEnabled,
      loyaltyRequiresPassport: parsed.data.loyaltyRequiresPassport,
      loyaltyMinorPerPoint,
    },
  });

  await logAudit(admin.id, "UPDATE", "PlatformSettings", "default", {
    loyaltyEnabled: settings.loyaltyEnabled,
    loyaltyRequiresPassport: settings.loyaltyRequiresPassport,
    loyaltyMinorPerPoint: settings.loyaltyMinorPerPoint,
  });

  return NextResponse.json({
    loyaltyEnabled: settings.loyaltyEnabled,
    loyaltyRequiresPassport: settings.loyaltyRequiresPassport,
    loyaltyMinorPerPoint: settings.loyaltyMinorPerPoint,
    loyaltySpendMajorPerPoint: toMajor(settings.loyaltyMinorPerPoint),
  });
}
