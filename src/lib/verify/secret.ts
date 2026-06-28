// ============================================================
// API-client credential generation + secret custody
// ============================================================
// HMAC request signing requires the server to recompute the signature, so the
// signing secret must be RECOVERABLE (not a one-way hash). We therefore store it
// envelope-encrypted at rest via the verification KMS, and decrypt it only in
// memory at verification time. The plaintext secret is shown to the partner
// exactly ONCE at issuance and never persisted in the clear.
import { randomBytes } from "crypto";
import { getKms } from "./kms";

/** Public key identifier shown to the partner (safe to store/transmit). */
export function generateKeyId(): string {
  return `pk_live_${randomBytes(12).toString("hex")}`;
}

/** Signing secret - shown to the partner exactly ONCE. */
export function generateSecret(): string {
  return `sk_live_${randomBytes(32).toString("base64url")}`;
}

/** Envelope-encrypt a signing secret. Encoded as keyId:version:wrappedBase64. */
export function encryptSecret(secret: string): string {
  const kms = getKms();
  const keyId = process.env.VERIFY_KMS_KEY_ID ?? "ep-card-master";
  const version = kms.currentVersion(keyId);
  const wrapped = kms.wrap(keyId, version, Buffer.from(secret, "utf8"));
  return `${keyId}:${version}:${wrapped.toString("base64")}`;
}

/** Recover a signing secret from its stored envelope. */
export function decryptSecret(stored: string): string {
  const kms = getKms();
  const idx1 = stored.indexOf(":");
  const idx2 = stored.indexOf(":", idx1 + 1);
  if (idx1 < 0 || idx2 < 0) throw new Error("Malformed stored secret.");
  const keyId = stored.slice(0, idx1);
  const version = Number(stored.slice(idx1 + 1, idx2));
  const wrapped = Buffer.from(stored.slice(idx2 + 1), "base64");
  return kms.unwrap(keyId, version, wrapped).toString("utf8");
}
