import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { verifyDb } from "@/lib/verify-db";
import { encryptSecret, generateKeyId, generateSecret } from "@/lib/verify/secret";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  label: z.string().trim().max(80).optional().or(z.literal("")),
  ipAllowlist: z.string().trim().max(400).optional().or(z.literal("")),
  rateLimitRpm: z.number().int().min(1).max(100_000).nullable().optional(),
});

// Issue a new API credential for a partner. The signing secret is returned ONCE.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const partner = await verifyDb.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const keyId = generateKeyId();
  const secret = generateSecret();

  let secretEnc: string;
  try {
    secretEnc = encryptSecret(secret);
  } catch (err) {
    console.error("secret custody error", err);
    return NextResponse.json({ error: "Key custody (KMS) is not configured." }, { status: 500 });
  }

  const client = await verifyDb.apiClient.create({
    data: {
      partnerId: partner.id,
      label: parsed.data.label || null,
      keyId,
      secretEnc,
      scopesJson: JSON.stringify(["verify:tap"]),
      ipAllowlist: parsed.data.ipAllowlist || null,
      rateLimitRpm: parsed.data.rateLimitRpm ?? null,
    },
  });

  await logAudit(admin.id, "CREATE", "ApiClient", client.id, { partnerId: partner.id, keyId });

  // Secret shown exactly once.
  return NextResponse.json({ ok: true, keyId, secret, clientId: client.id });
}
