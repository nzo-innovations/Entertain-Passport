/** Entertain Passport public card type codes (TT segment). */
export const PASSPORT_CARD_TYPES = {
  STANDARD: "11",
  VIP: "21",
  PLATINUM: "31",
  ARTIST: "41",
  STAFF: "51",
  PARTNER: "61",
  SIGNATURE: "81",
} as const;

export type PassportCardTypeCode = (typeof PASSPORT_CARD_TYPES)[keyof typeof PASSPORT_CARD_TYPES];

/** Card types available when generating new print batches. */
export const PASSPORT_BATCH_CARD_TYPES = [
  PASSPORT_CARD_TYPES.STANDARD,
  PASSPORT_CARD_TYPES.PLATINUM,
  PASSPORT_CARD_TYPES.SIGNATURE,
] as const;

export type PassportBatchCardTypeCode = (typeof PASSPORT_BATCH_CARD_TYPES)[number];

export const PASSPORT_CARD_TYPE_LABELS: Record<string, string> = {
  "11": "Standard",
  "21": "VIP",
  "31": "Platinum",
  "41": "Artist",
  "51": "Staff",
  "61": "Partner",
  "81": "Signature",
};

export const INVENTORY_STATUSES = [
  "GENERATED",
  "PRINTED",
  "AVAILABLE",
  "ASSIGNED",
  "PROGRAMMED",
  "BLOCKED",
  "DAMAGED",
  "REPLACED",
] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const PUBLIC_PREFIX = "88";

/** v2 NFC tag payload - no plain NIC/passport, no userPrimaryIdHash on chip. */
export type NfcTagPayloadV2 = {
  internalPassportUuid: string;
  publicPassportNumber: string;
  nfcUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  signature: string;
};

export type TagSignatureInputV2 = {
  internalPassportUuid: string;
  publicPassportNumber: string;
  nfcUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  userPrimaryIdHash: string;
};
