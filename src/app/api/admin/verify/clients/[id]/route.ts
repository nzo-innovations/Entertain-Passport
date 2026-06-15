import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { verifyDb } from "@/lib/verify-db";
import { encryptSecret, generateSecret } from "@/lib/verify/secret";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["revoke", "activate", "rotate"]),
  ipAllowlist: z.string().trim().max(400).nullable().optional(),
  rateLimitRpm: z.number().int().min(1).max(100_000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const client = await verifyDb.apiClient.findUnique({ where: { id: params.id } });
  if (!client) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.ipAllowlist !== undefined) data.ipAllowlist = parsed.data.ipAllowlist || null;
  if (parsed.data.rateLimitRpm !== undefined) data.rateLimitRpm = parsed.data.rateLimitRpm;

  let newSecret: string | null = null;
  switch (parsed.data.action) {
    case "revoke":
      data.status = "REVOKED";
      data.revokedAt = new Date();
      break;
    case "activate":
      data.status = "ACTIVE";
      data.revokedAt = null;
      break;
    case "rotate":
      newSecret = generateSecret();
      try {
        data.secretEnc = encryptSecret(newSecret);
      } catch {
        return NextResponse.json({ error: "Key custody (KMS) is not configured." }, { status: 500 });
      }
      break;
  }

  await verifyDb.apiClient.update({ where: { id: params.id }, data });
  await logAudit(admin.id, "UPDATE", "ApiClient", params.id, { action: parsed.data.action });

  // On rotate, the new secret is returned exactly once.
  return NextResponse.json({ ok: true, keyId: client.keyId, secret: newSecret });
}
