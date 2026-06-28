import { randomBytes } from "crypto";

/** Human-friendly Entertain Passport number, e.g. EP-7F3A-91C2. */
export function generatePassportNo(): string {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `EP-${part()}-${part()}`;
}

export const NFC_CARD_STATUSES = ["UNASSIGNED", "ACTIVE", "BLOCKED", "LOST"] as const;
export type NfcCardStatus = (typeof NFC_CARD_STATUSES)[number];
