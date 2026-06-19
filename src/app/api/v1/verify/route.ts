// ============================================================
// PUBLIC PARTNER EDGE — POST /api/v1/verify  (tap-only, verdict-only)
// ============================================================
// This route imports ONLY the isolated verification plane. It must never import
// `@/lib/db` (the core/full-access client). Returns nothing but a validation
// verdict + status; no identity or sales data ever leaves here.
import { NextResponse } from "next/server";
import { assertVerifyIsolation } from "@/lib/verify-db";
import { authenticatePartner } from "@/lib/verify/auth";
import { verifyTap, meterAndLog, type Verdict } from "@/lib/verify/verify-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENDPOINT = "/api/v1/verify";

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: Request) {
  const started = Date.now();
  const ip = clientIp(req);

  try {
    assertVerifyIsolation();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const rawBody = await req.text();

  const auth = await authenticatePartner({
    authHeader: req.headers.get("authorization"),
    method: "POST",
    path: ENDPOINT,
    rawBody,
    ip,
    requiredScope: "verify:tap",
  });

  if (!auth.ok) {
    await meterAndLog({
      apiClientId: null,
      partnerId: null,
      endpoint: ENDPOINT,
      verdict: "DENIED",
      httpStatus: auth.httpStatus,
      latencyMs: Date.now() - started,
      ip,
      sigValid: auth.reason !== "bad_signature" && auth.reason !== "missing_or_malformed_auth",
      billable: false,
      limits: null,
      reason: auth.reason,
    });
    return NextResponse.json({ error: "denied", reason: auth.reason }, { status: auth.httpStatus });
  }

  // Parse body (already signature-verified).
  let body: { mode?: string; uid?: string; block?: string };
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return finalize(auth, "INVALID", 400, started, ip, false, "invalid_json");
  }

  // Locked contract: tap mode only.
  if (body.mode && body.mode !== "tap") {
    return finalize(auth, "INVALID", 400, started, ip, false, "unsupported_mode");
  }

  const outcome = await verifyTap({ uid: body.uid ?? "", block: body.block ?? "" });
  const httpStatus = outcome.verdict === "ERROR" ? 500 : 200;

  await meterAndLog({
    apiClientId: auth.client.id,
    partnerId: auth.partner.id,
    endpoint: ENDPOINT,
    verdict: outcome.verdict,
    httpStatus,
    latencyMs: Date.now() - started,
    ip,
    sigValid: true,
    billable: outcome.billable,
    limits: auth.limits,
    reason: outcome.reason,
    passportNo: outcome.passportNo,
  });

  return NextResponse.json(
    {
      valid: outcome.verdict === "VALID",
      status: outcome.status,
      verifiedAt: new Date().toISOString(),
    },
    { status: httpStatus }
  );
}

// Helper for early verdicts that still need logging + metering.
async function finalize(
  auth: Extract<Awaited<ReturnType<typeof authenticatePartner>>, { ok: true }>,
  verdict: Verdict,
  httpStatus: number,
  started: number,
  ip: string | null,
  billable: boolean,
  reason: string
) {
  await meterAndLog({
    apiClientId: auth.client.id,
    partnerId: auth.partner.id,
    endpoint: ENDPOINT,
    verdict,
    httpStatus,
    latencyMs: Date.now() - started,
    ip,
    sigValid: true,
    billable,
    limits: auth.limits,
    reason,
  });
  return NextResponse.json({ valid: false, reason }, { status: httpStatus });
}
