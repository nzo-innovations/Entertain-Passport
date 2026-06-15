import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { verifyDb } from "@/lib/verify-db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const nullableInt = z.number().int().min(0).nullable().optional();

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  planCode: z.string().trim().max(40).nullable().optional(),
  legalEntity: z.string().trim().max(160).nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional().or(z.literal("")),
  // Per-partner overrides (null clears the override -> inherits plan).
  overrideUnitPriceMinor: nullableInt,
  overrideMonthlyQuota: nullableInt,
  overrideRateLimitRpm: nullableInt,
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const partner = await verifyDb.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.legalEntity !== undefined) data.legalEntity = parsed.data.legalEntity || null;
  if (parsed.data.contactEmail !== undefined) data.contactEmail = parsed.data.contactEmail || null;
  if (parsed.data.overrideUnitPriceMinor !== undefined) data.overrideUnitPriceMinor = parsed.data.overrideUnitPriceMinor;
  if (parsed.data.overrideMonthlyQuota !== undefined) data.overrideMonthlyQuota = parsed.data.overrideMonthlyQuota;
  if (parsed.data.overrideRateLimitRpm !== undefined) data.overrideRateLimitRpm = parsed.data.overrideRateLimitRpm;

  if (parsed.data.planCode !== undefined) {
    if (parsed.data.planCode === null) {
      data.planId = null;
    } else {
      const plan = await verifyDb.verifPlan.findUnique({ where: { code: parsed.data.planCode } });
      if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
      data.planId = plan.id;
    }
  }

  const updated = await verifyDb.partner.update({ where: { id: params.id }, data });
  await logAudit(admin.id, "UPDATE", "Partner", params.id, parsed.data);
  return NextResponse.json({ ok: true, partner: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const partner = await verifyDb.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  await verifyDb.partner.delete({ where: { id: params.id } });
  await logAudit(admin.id, "DELETE", "Partner", params.id, { name: partner.name });
  return NextResponse.json({ ok: true });
}
