import type { NfcTagPayload } from "./types";

/** Parse NFC reader output - JSON tag payload or legacy typed code. */
export function parseNfcReaderInput(raw: string): NfcTagPayload | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<NfcTagPayload>;
    if (
      typeof parsed.passportId === "string" &&
      typeof parsed.cardUid === "string" &&
      typeof parsed.keyVersion === "number" &&
      typeof parsed.issuedAt === "string" &&
      typeof parsed.counter === "number" &&
      typeof parsed.signature === "string"
    ) {
      return parsed as NfcTagPayload;
    }
  } catch {
    return null;
  }
  return null;
}
