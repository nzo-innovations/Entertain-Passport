import { createHmac, randomBytes, type BinaryLike } from "crypto";
import {
  computeLuhnCheckDigit,
  formatPublicPassportNumber,
} from "./passport-number-generator";
import { PUBLIC_PREFIX, type PassportCardTypeCode } from "./types";

const ENGINE_VERSION = "ep-serial-v2";
const FIELD_SEP = "\x1e";

let digitMixerCache: { pepper: string; table: number[] } | null = null;

function serialPepper(): string {
  const pepper =
    process.env.PASSPORT_SERIAL_PEPPER?.trim() ||
    process.env.PASSPORT_ID_HASH_PEPPER?.trim() ||
    process.env.NFC_HMAC_SECRET?.trim();
  if (!pepper) {
    throw new Error(
      "Missing PASSPORT_SERIAL_PEPPER (or PASSPORT_ID_HASH_PEPPER / NFC_HMAC_SECRET fallback)."
    );
  }
  return pepper;
}

function getDigitMixer(pepper: string): number[] {
  if (digitMixerCache?.pepper === pepper) return digitMixerCache.table;
  const seed = createHmac("sha512", pepper).update(`${ENGINE_VERSION}:digit-mixer`).digest();
  const table = Array.from({ length: 256 }, (_, i) => {
    const a = seed[i % seed.length];
    const b = seed[(i * 17 + 3) % seed.length];
    const c = seed[(i * 31 + 11) % seed.length];
    return (a ^ b ^ c ^ i) % 10;
  });
  digitMixerCache = { pepper, table };
  return table;
}

function foldDigest(digest: Buffer, mixer: number[]): Buffer {
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    const a = digest[i % digest.length];
    const b = digest[(i * 13 + 7) % digest.length];
    const c = digest[(i * 29 + 19) % digest.length];
    out[i] = (a ^ b ^ c ^ mixer[a] ^ mixer[b]) & 0xff;
  }
  return out;
}

function digestToDigits(digest: Buffer, count: number, mixer: number[]): string {
  const folded = foldDigest(digest, mixer);
  let carry = mixer[folded[0] ?? 0] ?? 0;
  let out = "";
  for (let i = 0; i < count; i++) {
    const b = folded[i % folded.length];
    const b2 = folded[(i * 11 + 5) % folded.length];
    carry = (carry + mixer[b] + (b2 ^ i) + ((b & 0x0f) + (b >> 4))) % 10;
    out += String(carry);
  }
  return out;
}

function deriveSerialBody(args: {
  issueYear: number;
  cardType: PassportCardTypeCode;
  batchCode: string;
  batchId: string;
  sequence: number;
  internalPassportUuid: string;
  entropy: Buffer;
}): { rr: string; rrrr: string; xxx: string } {
  const pepper = serialPepper();
  const mixer = getDigitMixer(pepper);
  const yy = String(args.issueYear).padStart(2, "0").slice(-2);

  const anchor: BinaryLike[] = [
    ENGINE_VERSION,
    PUBLIC_PREFIX,
    yy,
    args.cardType,
    args.batchCode,
    args.batchId,
    String(args.sequence),
    args.internalPassportUuid,
    args.entropy,
  ];

  const h1 = createHmac("sha512", pepper).update(anchor.join(FIELD_SEP), "utf8").digest();
  const h2 = createHmac("sha512", pepper).update(h1).update(`${ENGINE_VERSION}:fold`).digest();
  const nine = digestToDigits(Buffer.concat([h1, h2]), 9, mixer);

  return {
    rr: nine.slice(0, 2),
    rrrr: nine.slice(2, 6),
    xxx: nine.slice(6, 9),
  };
}

/** Server-only serial builder - RR/RRRR/XXX/C are never chosen client-side. */
export function generateSecurePublicPassportNumber(args: {
  issueYear: number;
  cardType: PassportCardTypeCode;
  batchCode: string;
  batchId: string;
  sequence: number;
  internalPassportUuid: string;
}): { compact: string; formatted: string } {
  const yy = String(args.issueYear).padStart(2, "0").slice(-2);
  const entropy = randomBytes(16);
  const { rr, rrrr, xxx } = deriveSerialBody({ ...args, entropy });
  const body15 = `${PUBLIC_PREFIX}${yy}${args.cardType}${rr}${rrrr}${xxx}`;
  const check = computeLuhnCheckDigit(body15);
  const compact = `${body15}${check}`;
  return { compact, formatted: formatPublicPassportNumber(compact) };
}
