import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  isVerified: z.boolean().optional(),
  // null clears the override (use platform default); number sets a per-org rate.
  commissionPct: z.union([z.number().min(0).max(100), z.null()]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid organization data." }, { status: 400 });
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.phone !== undefined) data.phone = d.phone || null;
  if (d.website !== undefined) data.website = d.website || null;
  if (d.isVerified !== undefined) data.isVerified = d.isVerified;
  if (d.commissionPct !== undefined) data.commissionPct = d.commissionPct;

  const org = await db.organization.update({ where: { id: params.id }, data });
  await logAudit(admin.id, "UPDATE", "Organization", org.id, data);

  return NextResponse.json({ ok: true, organization: org });
}
