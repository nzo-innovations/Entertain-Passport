import { createHmac } from "crypto";
import { validateIdentity, type IdentityType } from "@/lib/identity";

function idHashPepper(): string {
  const pepper =
    process.env.PASSPORT_ID_HASH_PEPPER?.trim() ||
    process.env.NFC_HMAC_SECRET?.trim() ||
    process.env.VERIFY_HASH_PEPPER?.trim();
  if (!pepper) {
    throw new Error("Missing PASSPORT_ID_HASH_PEPPER (or NFC_HMAC_SECRET fallback) for ID hashing.");
  }
  return pepper;
}

/** Hash primary ID - never store or log plain NIC/passport. */
export function hashUserPrimaryId(type: IdentityType, rawValue: string): string {
  const validated = validateIdentity(type, rawValue);
  if (!validated.ok) {
    throw new Error(validated.error ?? "Invalid primary ID.");
  }
  const pepper = idHashPepper();
  const message = `${type}:${validated.normalized}`;
  return createHmac("sha256", pepper).update(message, "utf8").digest("hex");
}

/** Safe audit reference - first 8 hex chars of hash only. */
export function primaryIdAuditRef(hash: string): string {
  return `id:${hash.slice(0, 8)}…`;
}
