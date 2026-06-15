import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { verifyDb } from "@/lib/verify-db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Under the locked contract we return ONLY validation status to partners, so the
// default shared-fields set is exactly that. Recorded with the legal basis and
// the accepted terms version.
const schema = z.object({
  termsVersion: z.string().trim().min(1).max(40),
  legalBasis: z.enum(["CONTRACT", "CONSENT", "LEGITIMATE_INTEREST"]).default("CONTRACT"),
  sharedFields: z.array(z.string().trim().max(40)).max(20).optional(),
  acceptedByName: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent data." }, { status: 400 });

  const partner = await verifyDb.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  // Withdraw any prior active consent, then record the new acceptance.
  await verifyDb.partnerConsent.updateMany({
    where: { partnerId: partner.id, status: "ACTIVE" },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });

  const consent = await verifyDb.partnerConsent.create({
    data: {
      partnerId: partner.id,
      termsVersion: parsed.data.termsVersion,
      legalBasis: parsed.data.legalBasis,
      sharedFieldsJson: JSON.stringify(parsed.data.sharedFields ?? ["validation_status"]),
      acceptedByName: parsed.data.acceptedByName || null,
    },
  });

  await logAudit(admin.id, "CREATE", "PartnerConsent", consent.id, {
    partnerId: partner.id,
    termsVersion: consent.termsVersion,
    legalBasis: consent.legalBasis,
  });
  return NextResponse.json({ ok: true, consent });
}
