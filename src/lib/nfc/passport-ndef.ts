/** Human-readable NDEF text shown when a card is tapped on phones and other generic NFC apps. */
export function buildPassportPublicDisplay(args: {
  formattedPassportNumber: string;
  holderName?: string | null;
}): string {
  const lines = ["Entertain Passport", args.formattedPassportNumber.trim()];
  const name = args.holderName?.trim();
  if (name) lines.push(name);
  return lines.join("\n");
}

function isSignedTagPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (typeof p.signature !== "string") return false;
  return typeof p.internalPassportUuid === "string" || typeof p.passportId === "string";
}

function tryParseSignedJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isSignedTagPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Pick signed tag JSON from NFC reader output (single record, multi-record, or multi-line wedge). */
export function findSignedTagJsonString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = tryParseSignedJson(trimmed);
  if (direct) return trimmed;

  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim();
    if (tryParseSignedJson(candidate)) return candidate;
  }

  const start = trimmed.indexOf("{");
  if (start >= 0) {
    const slice = trimmed.slice(start);
    if (tryParseSignedJson(slice)) return slice;
  }

  return null;
}

export type PassportNdefWriteInput = {
  publicDisplay: string;
  tagJson: string;
};
