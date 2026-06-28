import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { testProgrammedCardByUid, testProgrammedNfcPayload } from "@/lib/passport/passport-test-service";

const uidSchema = z.object({
  nfcUid: z.string().trim().min(4).max(64),
});

const v2Schema = z.object({
  internalPassportUuid: z.string().uuid(),
  publicPassportNumber: z.string().min(10),
  nfcUid: z.string().trim().min(4).max(64).optional(),
  cardUid: z.string().trim().min(4).max(64).optional(),
  keyVersion: z.number().int().positive(),
  issuedAt: z.string().min(10),
  counter: z.number().int().min(0),
  signature: z.string().trim().min(32),
});

const legacySchema = z.object({
  passportId: z.string().uuid(),
  cardUid: z.string().trim().min(4).max(64).optional(),
  nfcUid: z.string().trim().min(4).max(64).optional(),
  keyVersion: z.number().int().positive(),
  issuedAt: z.string().min(10),
  counter: z.number().int().min(0),
  signature: z.string().trim().min(32),
});

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ verdict: "FAIL", summary: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ verdict: "FAIL", summary: "Invalid JSON body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const hasSignature = typeof record.signature === "string" && record.signature.trim().length >= 32;
  const hasV2 = typeof record.internalPassportUuid === "string";
  const hasLegacy = typeof record.passportId === "string";
  const uidValue =
    typeof record.nfcUid === "string"
      ? record.nfcUid.trim()
      : typeof record.cardUid === "string"
        ? record.cardUid.trim()
        : "";

  if (!hasSignature && !hasV2 && !hasLegacy && uidValue.length >= 4) {
    const parsed = uidSchema.safeParse({ nfcUid: uidValue });
    if (!parsed.success) {
      return NextResponse.json({ verdict: "FAIL", summary: "Invalid chip UID." }, { status: 400 });
    }
    const result = await testProgrammedCardByUid(parsed.data.nfcUid);
    const status = result.verdict === "PASS" ? 200 : 422;
    return NextResponse.json(result, { status });
  }

  const parsed = (hasV2 ? v2Schema : legacySchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { verdict: "FAIL", summary: "Invalid NFC payload or chip UID.", checks: [] },
      { status: 400 }
    );
  }

  const uid = parsed.data.cardUid ?? parsed.data.nfcUid;
  if (!uid) {
    return NextResponse.json(
      { verdict: "FAIL", summary: "Missing nfcUid / cardUid.", checks: [] },
      { status: 400 }
    );
  }

  const result = await testProgrammedNfcPayload({
    ...parsed.data,
    nfcUid: uid,
    cardUid: uid,
  });

  const status = result.verdict === "PASS" ? 200 : 422;
  return NextResponse.json(result, { status });
}
