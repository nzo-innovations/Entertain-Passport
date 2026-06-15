// ============================================================
// Verification-plane hashing + on-card block crypto
// ============================================================
import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

function pepper(): string {
  const p = process.env.VERIFY_HASH_PEPPER;
  if (!p) throw new Error("VERIFY_HASH_PEPPER is not set.");
  return p;
}

/** Keyed (peppered) SHA-256 HMAC, hex. Used for UID + PII hashing. */
export function keyedHashHex(value: string): string {
  return createHmac("sha256", pepper()).update(value).digest("hex");
}

/** Normalize then hash a raw chip UID (case/space-insensitive). */
export function hashUid(uid: string): string {
  return keyedHashHex(uid.trim().toUpperCase().replace(/[\s:]/g, ""));
}

/** Normalize then hash a PII value (name/nic/mobile). Returns null for empty. */
export function hashPii(value: string | null | undefined): string | null {
  if (!value) return null;
  const norm = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!norm) return null;
  return keyedHashHex(norm);
}

/** Constant-time comparison of two hex strings of equal length. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

export type CardBlockPayload = {
  passportNo: string;
  version: number;
  issuedAt: number; // epoch ms when the card block was written
};

/** Encrypt the on-card data block with the per-card data key (DESFire user memory). */
export function encryptCardBlock(dataKey: Buffer, payload: CardBlockPayload): string {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const pt = Buffer.from(JSON.stringify(payload), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt + parse an on-card data block. Throws on tamper/auth failure. */
export function decryptCardBlock(dataKey: Buffer, blockBase64: string): CardBlockPayload {
  const blob = Buffer.from(blockBase64, "base64");
  const iv = blob.subarray(0, GCM_IV_BYTES);
  const tag = blob.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES);
  const ct = blob.subarray(GCM_IV_BYTES + GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", dataKey, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(pt) as CardBlockPayload;
  if (!parsed || typeof parsed.passportNo !== "string") {
    throw new Error("Malformed card block payload.");
  }
  return parsed;
}
