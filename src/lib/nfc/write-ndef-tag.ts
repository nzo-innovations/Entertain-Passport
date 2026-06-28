import type { PassportNdefWriteInput } from "./passport-ndef";

type NdefWriterLike = {
  write: (message: { records: Array<{ recordType: string; data: string; lang?: string }> }) => Promise<void>;
};

const WEB_NFC_WRITE_UNAVAILABLE =
  "This browser cannot write NFC tags. Copy the display text and JSON, then use NFC Tools (Android) or NXP TagWriter, or a phone with built-in NFC.";

/** Web NFC write is only available where the browser exposes NDEFReader (e.g. Chrome on Android). */
export function isWebNfcWriteSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

async function writeNdefRecords(
  records: Array<{ recordType: string; data: string; lang?: string }>
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined" || !isWebNfcWriteSupported()) {
    return { ok: false, error: WEB_NFC_WRITE_UNAVAILABLE };
  }

  try {
    const Writer = window.NDEFReader as unknown as new () => NdefWriterLike;
    const writer = new Writer();
    await writer.write({ records });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "NFC write failed.";
    return { ok: false, error: message };
  }
}

/** Write a text NDEF record to a tag via Web NFC (Chrome / Edge, Android, some desktops). */
export async function writeTextNdefTag(text: string): Promise<{ ok: boolean; error?: string }> {
  return writeNdefRecords([{ recordType: "text", data: text.trim(), lang: "en" }]);
}

/**
 * Write Entertain Passport tag: record 1 = branded card display for generic taps;
 * record 2 = signed JSON for gate / admin verification.
 */
export async function writePassportNdefTag(input: PassportNdefWriteInput): Promise<{ ok: boolean; error?: string }> {
  const publicDisplay = input.publicDisplay.trim();
  const tagJson = input.tagJson.trim();
  if (!publicDisplay || !tagJson) {
    return { ok: false, error: "Missing display text or tag JSON." };
  }

  return writeNdefRecords([
    { recordType: "text", data: publicDisplay, lang: "en" },
    { recordType: "text", data: tagJson, lang: "en" },
  ]);
}
