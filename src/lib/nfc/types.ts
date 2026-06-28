/** Minimal payload written to the NFC tag - no PII. */
export type NfcTagPayload = {
  passportId: string;
  cardUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  signature: string;
};

export type NfcVerifyVerdict = "ALLOW" | "DENY";

export type PassportCredentialChannel = "PHYSICAL" | "WALLET";

export type NfcVerifyResult = {
  verdict: NfcVerifyVerdict;
  reason: string;
  ticketId?: string;
  passportNo?: string;
  holder?: string;
  packageName?: string;
  credentialChannel?: PassportCredentialChannel;
};

export type NfcBlockMode = "temporary" | "permanent";

export const NFC_SCAN_TYPES = {
  REGISTER: "REGISTER",
  VERIFY: "VERIFY",
  CHECK_IN: "CHECK_IN",
} as const;

export type NfcScanType = (typeof NFC_SCAN_TYPES)[keyof typeof NFC_SCAN_TYPES];
