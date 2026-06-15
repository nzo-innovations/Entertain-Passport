// ============================================================
// Partner-edge auth pipeline (before any identity DB read)
// ============================================================
// API key lookup -> partner status -> timestamp -> IP allowlist -> HMAC sig
//   -> replay nonce -> scope -> rate limit -> monthly quota
import { verifyDb } from "@/lib/verify-db";
import { decryptSecret } from "./secret";
import {
  buildCanonical,
  computeSignature,
  parseAuthHeader,
  signaturesMatch,
  timestampFresh,
} from "./hmac";
import { currentPeriod, effectiveLimits, type EffectiveLimits, type PartnerWithPlan } from "./limits";
import type { ApiClient } from "@/generated/verify-client";

export type AuthOk = {
  ok: true;
  client: ApiClient;
  partner: PartnerWithPlan;
  scopes: string[];
  limits: EffectiveLimits;
};

export type AuthFail = {
  ok: false;
  httpStatus: number;
  reason: string;
};

const SKEW_SECONDS = Number(process.env.VERIFY_HMAC_MAX_SKEW_SECONDS ?? "120");

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const trimmed = cidr.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("/")) return ip.trim() === trimmed;
  const [range, bitsStr] = trimmed.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null || !Number.isFinite(bits)) return false;
  if (bits <= 0) return true;
  const mask = bits >= 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function ipAllowed(ip: string | null, allowlist: string | null): boolean {
  if (!allowlist || !allowlist.trim()) return true; // no allowlist = any
  if (!ip) return false;
  return allowlist.split(",").some((c) => ipInCidr(ip, c));
}

export async function authenticatePartner(args: {
  authHeader: string | null;
  method: string;
  path: string;
  rawBody: string;
  ip: string | null;
  requiredScope: string;
}): Promise<AuthOk | AuthFail> {
  const parsed = parseAuthHeader(args.authHeader);
  if (!parsed) return { ok: false, httpStatus: 401, reason: "missing_or_malformed_auth" };

  const client = await verifyDb.apiClient.findUnique({
    where: { keyId: parsed.keyId },
    include: { partner: { include: { plan: true } } },
  });
  if (!client || client.status !== "ACTIVE") {
    return { ok: false, httpStatus: 401, reason: "unknown_or_revoked_key" };
  }
  if (client.partner.status !== "ACTIVE") {
    return { ok: false, httpStatus: 403, reason: "partner_suspended" };
  }
  if (!timestampFresh(parsed.ts)) {
    return { ok: false, httpStatus: 401, reason: "stale_timestamp" };
  }
  if (!ipAllowed(args.ip, client.ipAllowlist)) {
    return { ok: false, httpStatus: 403, reason: "ip_not_allowed" };
  }

  // Recompute + compare the HMAC signature.
  let secret: string;
  try {
    secret = decryptSecret(client.secretEnc);
  } catch {
    return { ok: false, httpStatus: 500, reason: "secret_custody_error" };
  }
  const canonical = buildCanonical({
    ts: parsed.ts,
    nonce: parsed.nonce,
    method: args.method,
    path: args.path,
    body: args.rawBody,
  });
  if (!signaturesMatch(parsed.sig, computeSignature(secret, canonical))) {
    return { ok: false, httpStatus: 401, reason: "bad_signature" };
  }

  // Replay protection: a nonce may be used once within the skew window.
  try {
    await verifyDb.apiNonce.create({
      data: {
        keyId: parsed.keyId,
        nonce: parsed.nonce,
        expiresAt: new Date(Date.now() + (SKEW_SECONDS + 5) * 1000),
      },
    });
  } catch {
    return { ok: false, httpStatus: 401, reason: "replayed_nonce" };
  }

  const scopes = parseScopes(client.scopesJson);
  if (!scopes.includes(args.requiredScope)) {
    return { ok: false, httpStatus: 403, reason: "scope_denied" };
  }

  const limits = effectiveLimits(client.partner, client);

  // Rate limit: requests in the last 60s for this client.
  const since = new Date(Date.now() - 60_000);
  const recent = await verifyDb.apiRequestLog.count({
    where: { apiClientId: client.id, createdAt: { gte: since } },
  });
  if (recent >= limits.rateLimitRpm) {
    return { ok: false, httpStatus: 429, reason: "rate_limited" };
  }

  // Monthly quota: billable verifications this period.
  if (limits.monthlyQuota !== null) {
    const usage = await verifyDb.usageCounter.findUnique({
      where: { apiClientId_period: { apiClientId: client.id, period: currentPeriod() } },
    });
    if ((usage?.billableCount ?? 0) >= limits.monthlyQuota) {
      return { ok: false, httpStatus: 402, reason: "quota_exceeded" };
    }
  }

  return { ok: true, client, partner: client.partner, scopes, limits };
}

function parseScopes(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}
