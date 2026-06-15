import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { verifyDb } from "@/lib/verify-db";
import { listPartnersForAdmin } from "@/lib/verify/admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalEntity: z.string().trim().max(160).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  planCode: z.string().trim().max(40).optional().or(z.literal("")),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `partner-${Date.now()}`
  );
}

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ partners: await listPartnersForAdmin() });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid partner data." }, { status: 400 });

  let slug = slugify(parsed.data.name);
  for (let i = 0; i < 5 && (await verifyDb.partner.findUnique({ where: { slug } })); i++) {
    slug = `${slug}-${i + 2}`;
  }

  const plan = parsed.data.planCode
    ? await verifyDb.verifPlan.findUnique({ where: { code: parsed.data.planCode } })
    : await verifyDb.verifPlan.findUnique({ where: { code: "PAYG" } });

  const partner = await verifyDb.partner.create({
    data: {
      name: parsed.data.name,
      slug,
      legalEntity: parsed.data.legalEntity || null,
      contactEmail: parsed.data.contactEmail || null,
      planId: plan?.id ?? null,
    },
  });

  await logAudit(admin.id, "CREATE", "Partner", partner.id, { name: partner.name, slug });
  return NextResponse.json({ ok: true, partner });
}
