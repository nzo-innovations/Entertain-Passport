import { createHmac, timingSafeEqual } from "crypto";
import {
  getActiveKeyVersion,
  getHmacSecret,
  verifyTagSignature as verifyLegacySignature,
} from "@/lib/nfc/crypto-service";
import type { NfcTagPayloadV2, TagSignatureInputV2 } from "./types";

export function buildSignaturePayloadV2(input: TagSignatureInputV2): string {
  return [
    input.internalPassportUuid,
    input.publicPassportNumber,
    input.nfcUid,
    String(input.keyVersion),
    input.issuedAt,
    String(input.counter),
    input.userPrimaryIdHash,
  ].join("|");
}

export function signTagPayloadV2(input: TagSignatureInputV2): string {
  const payload = buildSignaturePayloadV2(input);
  const secret = getHmacSecret(input.keyVersion);
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function verifyTagSignatureV2(input: TagSignatureInputV2, signature: string): boolean {
  if (!signature?.trim()) return false;
  const expected = signTagPayloadV2(input);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature.trim(), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildTagPayloadV2(params: {
  internalPassportUuid: string;
  publicPassportNumber: string;
  nfcUid: string;
  keyVersion: number;
  issuedAt: Date;
  counter: number;
  userPrimaryIdHash: string;
}): NfcTagPayloadV2 {
  const issuedAt = params.issuedAt.toISOString();
  const sigInput: TagSignatureInputV2 = {
    internalPassportUuid: params.internalPassportUuid,
    publicPassportNumber: params.publicPassportNumber,
    nfcUid: params.nfcUid,
    keyVersion: params.keyVersion,
    issuedAt,
    counter: params.counter,
    userPrimaryIdHash: params.userPrimaryIdHash,
  };
  return {
    internalPassportUuid: params.internalPassportUuid,
    publicPassportNumber: params.publicPassportNumber,
    nfcUid: params.nfcUid,
    keyVersion: params.keyVersion,
    issuedAt,
    counter: params.counter,
    signature: signTagPayloadV2(sigInput),
  };
}

export { getActiveKeyVersion, verifyLegacySignature };
