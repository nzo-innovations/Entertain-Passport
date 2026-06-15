// ============================================================
// Partner request HMAC signing (over TLS) — auth scheme "EP-HMAC"
// ============================================================
// Authorization: EP-HMAC keyId="pk_live_..", ts="<unix>", nonce="<rand>", sig="<hex>"
//
// Canonical string signed by the partner:
//   <ts>\n<nonce>\n<METHOD>\n<path>\n<sha256(body) hex>
// Signature = HMAC-SHA256(secret, canonical) as hex.
import { createHash, createHmac, timingSafeEqual } from "crypto";

export type ParsedAuth = {
  keyId: string;
  ts: string;
  nonce: string;
  sig: string;
};

export function parseAuthHeader(header: string | null): ParsedAuth | null {
  if (!header) return null;
  const m = /^EP-HMAC\s+(.+)$/i.exec(header.trim());
  if (!m) return null;
  const parts: Record<string, string> = {};
  for (const seg of m[1].split(",")) {
    const kv = /^\s*([a-zA-Z]+)\s*=\s*"?([^"]*)"?\s*$/.exec(seg);
    if (kv) parts[kv[1].toLowerCase()] = kv[2];
  }
  if (!parts.keyid || !parts.ts || !parts.nonce || !parts.sig) return null;
  return { keyId: parts.keyid, ts: parts.ts, nonce: parts.nonce, sig: parts.sig };
}

export function bodyHashHex(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function buildCanonical(input: {
  ts: string;
  nonce: string;
  method: string;
  path: string;
  body: string;
}): string {
  return [
    input.ts,
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    bodyHashHex(input.body),
  ].join("\n");
}

export function computeSignature(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function signaturesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** True when the request timestamp is within the allowed skew window. */
export function timestampFresh(ts: string): boolean {
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const maxSkew = Number(process.env.VERIFY_HMAC_MAX_SKEW_SECONDS ?? "120");
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - tsNum) <= maxSkew;
}
