import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { getEventCheckinStats } from "@/lib/gate";
import { verifyWalletSmartTapAtGate } from "@/lib/passport/wallet-tap-verify-service";

const schema = z.object({
  smartTapRedemptionValue: z.string().trim().min(8).max(128),
  eventId: z.string().min(1),
  checkIn: z.boolean().optional().default(true),
});

/** Verify Entertain Passport after Google Wallet NFC Smart Tap at gate. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ verdict: "DENY", reason: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ verdict: "DENY", reason: "Invalid wallet tap payload." }, { status: 400 });
  }

  const allowed = await canScanEventTickets(session.id, parsed.data.eventId, session.role);
  if (!allowed) {
    return NextResponse.json({ verdict: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const result = await verifyWalletSmartTapAtGate({
    ...parsed.data,
    scannedById: session.id,
  });

  const stats =
    parsed.data.checkIn && result.verdict === "ALLOW"
      ? await getEventCheckinStats(parsed.data.eventId)
      : undefined;

  const status = result.verdict === "ALLOW" ? 200 : 403;
  return NextResponse.json({ ...result, stats }, { status });
}
