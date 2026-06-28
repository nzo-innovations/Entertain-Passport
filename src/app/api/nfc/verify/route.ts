import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { verifyNfcPayloadAtGate } from "@/lib/passport/passport-verify-service";
import { getEventCheckinStats } from "@/lib/gate";

const legacySchema = z.object({
  passportId: z.string().uuid(),
  cardUid: z.string().trim().min(4).max(64),
  keyVersion: z.number().int().positive(),
  issuedAt: z.string().min(10),
  counter: z.number().int().min(0),
  signature: z.string().trim().min(32),
  eventId: z.string().min(1),
  checkIn: z.boolean().optional().default(true),
});

const v2Schema = z.object({
  internalPassportUuid: z.string().uuid(),
  publicPassportNumber: z.string().min(10),
  nfcUid: z.string().trim().min(4).max(64),
  keyVersion: z.number().int().positive(),
  issuedAt: z.string().min(10),
  counter: z.number().int().min(0),
  signature: z.string().trim().min(32),
  eventId: z.string().min(1),
  checkIn: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ verdict: "DENY", reason: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const isV2 = body && typeof body.internalPassportUuid === "string";
  const parsed = (isV2 ? v2Schema : legacySchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ verdict: "DENY", reason: "Invalid NFC payload." }, { status: 400 });
  }

  const allowed = await canScanEventTickets(session.id, parsed.data.eventId, session.role);
  if (!allowed) {
    return NextResponse.json({ verdict: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const result = await verifyNfcPayloadAtGate(parsed.data as Record<string, unknown>, {
    eventId: parsed.data.eventId,
    scannedById: session.id,
    checkIn: parsed.data.checkIn,
  });

  const stats =
    parsed.data.checkIn && result.verdict === "ALLOW"
      ? await getEventCheckinStats(parsed.data.eventId)
      : undefined;

  const status = result.verdict === "ALLOW" ? 200 : 403;
  return NextResponse.json({ ...result, stats }, { status });
}
