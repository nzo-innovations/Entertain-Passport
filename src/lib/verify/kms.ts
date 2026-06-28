// ============================================================
// KMS / envelope-encryption abstraction (DESFire master-key custody)
// ============================================================
// Master keys are NEVER stored in the verification database. They live with a
// KMS provider. Per-card data keys are generated locally, then WRAPPED
// (envelope-encrypted) by the master key; only the wrapped blob + key id +
// version are persisted (VerifCardKey). Rotation bumps the version while keeping
// older versions decryptable, so previously issued cards keep working.
//
// Providers:
//   * "local"  - dev only. Master key from VERIFY_LOCAL_MASTER_KEY (base64 32B).
//   * "aws-kms"/"vault" - production seams (throw until wired to the SDK).
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export type KmsProviderId = "local" | "aws-kms" | "vault";

export interface KmsProvider {
  readonly id: KmsProviderId;
  /** Highest active key version for a master key id. */
  currentVersion(keyId: string): number;
  /** Wrap (encrypt) a plaintext data key with the master key version. */
  wrap(keyId: string, version: number, plaintext: Buffer): Buffer;
  /** Unwrap (decrypt) a wrapped data key with the master key version. */
  unwrap(keyId: string, version: number, ciphertext: Buffer): Buffer;
}

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

function aesGcmEncrypt(key: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

function aesGcmDecrypt(key: Buffer, blob: Buffer): Buffer {
  const iv = blob.subarray(0, GCM_IV_BYTES);
  const tag = blob.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES);
  const ct = blob.subarray(GCM_IV_BYTES + GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/** Dev/local provider: master key(s) sourced from env. */
class LocalKmsProvider implements KmsProvider {
  readonly id = "local" as const;

  private masterKey(version: number): Buffer {
    // Version 1 uses VERIFY_LOCAL_MASTER_KEY; higher versions look up
    // VERIFY_LOCAL_MASTER_KEY_V<n> so rotation can be exercised in dev.
    const raw =
      version <= 1
        ? process.env.VERIFY_LOCAL_MASTER_KEY
        : process.env[`VERIFY_LOCAL_MASTER_KEY_V${version}`];
    if (!raw) throw new Error(`Local master key v${version} not configured.`);
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error("VERIFY_LOCAL_MASTER_KEY must be base64 of exactly 32 bytes (AES-256).");
    }
    return key;
  }

  currentVersion(): number {
    const v = Number(process.env.VERIFY_KMS_KEY_VERSION ?? "1");
    return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
  }

  wrap(_keyId: string, version: number, plaintext: Buffer): Buffer {
    return aesGcmEncrypt(this.masterKey(version), plaintext);
  }

  unwrap(_keyId: string, version: number, ciphertext: Buffer): Buffer {
    return aesGcmDecrypt(this.masterKey(version), ciphertext);
  }
}

let provider: KmsProvider | null = null;

export function getKms(): KmsProvider {
  if (provider) return provider;
  const id = (process.env.VERIFY_KMS_PROVIDER ?? "local") as KmsProviderId;
  switch (id) {
    case "local":
      provider = new LocalKmsProvider();
      return provider;
    case "aws-kms":
    case "vault":
      // Production seam: implement with @aws-sdk/client-kms or the Vault transit
      // engine. Keep the same wrap/unwrap contract so callers are unchanged.
      throw new Error(
        `KMS provider "${id}" is not wired yet. Set VERIFY_KMS_PROVIDER=local for dev or implement the provider.`
      );
    default:
      throw new Error(`Unknown VERIFY_KMS_PROVIDER "${id}".`);
  }
}

export const DATA_KEY_BYTES = 32;

export type GeneratedDataKey = {
  plaintext: Buffer;
  wrappedBase64: string;
  keyId: string;
  version: number;
};

/** Generate a fresh per-card data key and return it plaintext + wrapped. */
export function generateCardDataKey(): GeneratedDataKey {
  const kms = getKms();
  const keyId = process.env.VERIFY_KMS_KEY_ID ?? "ep-card-master";
  const version = kms.currentVersion(keyId);
  const plaintext = randomBytes(DATA_KEY_BYTES);
  const wrapped = kms.wrap(keyId, version, plaintext);
  return { plaintext, wrappedBase64: wrapped.toString("base64"), keyId, version };
}

/** Recover a per-card data key from its stored wrapped blob. */
export function unwrapCardDataKey(keyId: string, version: number, wrappedBase64: string): Buffer {
  const kms = getKms();
  return kms.unwrap(keyId, version, Buffer.from(wrappedBase64, "base64"));
}
