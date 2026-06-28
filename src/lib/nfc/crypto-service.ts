import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import type { NfcTagPayload } from "./types";

export type TagSignatureInput = {
  passportId: string;
  cardUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
};

/** Canonical HMAC payload: passportId|cardUid|keyVersion|issuedAt|counter */
export function buildSignaturePayload(input: TagSignatureInput): string {
  return [
    input.passportId,
    input.cardUid,
    String(input.keyVersion),
    input.issuedAt,
    String(input.counter),
  ].join("|");
}

function secretEnvKey(version: number): string {
  return `NFC_HMAC_SECRET_V${version}`;
}

/** Read HMAC secret from server env only - never exposed to client or NFC tag. */
export function getHmacSecret(version: number): Buffer {
  const fromVersioned = process.env[secretEnvKey(version)]?.trim();
  const fallback = version === 1 ? process.env.NFC_HMAC_SECRET?.trim() : undefined;
  const raw = fromVersioned || fallback;
  if (!raw) {
    throw new Error(
      `Missing NFC HMAC secret for key version ${version}. Set ${secretEnvKey(version)} or NFC_HMAC_SECRET.`
    );
  }
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length >= 32) return b64;
  } catch {
    /* fall through */
  }
  return Buffer.from(raw, "utf8");
}

export function signTagPayload(input: TagSignatureInput): string {
  const payload = buildSignaturePayload(input);
  const secret = getHmacSecret(input.keyVersion);
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function verifyTagSignature(input: TagSignatureInput, signature: string): boolean {
  if (!signature?.trim()) return false;
  const expected = signTagPayload(input);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature.trim(), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildTagPayload(params: {
  passportId: string;
  cardUid: string;
  keyVersion: number;
  issuedAt: Date;
  counter: number;
}): NfcTagPayload {
  const issuedAt = params.issuedAt.toISOString();
  const signature = signTagPayload({
    passportId: params.passportId,
    cardUid: params.cardUid,
    keyVersion: params.keyVersion,
    issuedAt,
    counter: params.counter,
  });
  return {
    passportId: params.passportId,
    cardUid: params.cardUid,
    keyVersion: params.keyVersion,
    issuedAt,
    counter: params.counter,
    signature,
  };
}

/** Active key version from DB registry, falling back to env. */
export async function getActiveKeyVersion(): Promise<number> {
  const active = await db.nfcKeyVersion.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
  });
  if (active) return active.version;
  const fromEnv = Number(process.env.NFC_HMAC_KEY_VERSION ?? "1");
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 1;
}

/** Ensure default key version row exists (idempotent). */
export async function ensureDefaultKeyVersion(): Promise<number> {
  const version = Number(process.env.NFC_HMAC_KEY_VERSION ?? "1") || 1;
  await db.nfcKeyVersion.upsert({
    where: { version },
    create: { version, label: "default", isActive: true },
    update: {},
  });
  return version;
}

/** Dev helper - generate a random 32-byte secret as hex. */
export function generateDevHmacSecret(): string {
  return randomBytes(32).toString("hex");
}
