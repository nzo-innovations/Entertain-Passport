import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  defaultCommissionPct: z.number().min(0).max(100),
  freeStaffPerEvent: z.number().int().min(0).max(100),
  extraStaffMonthlyFee: z.number().int().min(0).max(10_000_000), // minor units (cents)
});

export async function PATCH(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }

  const settings = await db.platformSettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });
  await logAudit(admin.id, "UPDATE", "PlatformSettings", "default", parsed.data);

  return NextResponse.json({ ok: true, settings });
}
