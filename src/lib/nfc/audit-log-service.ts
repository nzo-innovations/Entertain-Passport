import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { NfcScanType, NfcVerifyVerdict } from "./types";

export async function recordGateScan(args: {
  eventId?: string | null;
  rfidCardId?: string | null;
  passportId: string;
  cardUid: string;
  counter: number;
  verdict: NfcVerifyVerdict;
  reason: string;
  scanType: NfcScanType;
  signatureValid?: boolean | null;
  scannedById?: string | null;
  payload?: unknown;
}): Promise<void> {
  try {
    await db.gateScan.create({
      data: {
        eventId: args.eventId ?? null,
        rfidCardId: args.rfidCardId ?? null,
        passportId: args.passportId,
        cardUid: args.cardUid,
        counter: args.counter,
        verdict: args.verdict,
        reason: args.reason,
        scanType: args.scanType,
        signatureValid: args.signatureValid ?? null,
        scannedById: args.scannedById ?? null,
        payloadJson: args.payload ? JSON.stringify(args.payload) : null,
      },
    });
  } catch (err) {
    console.error("GateScan write failed", err);
  }
}

export async function logNfcRegistration(
  actorId: string | null,
  cardId: string,
  diff: unknown
): Promise<void> {
  await logAudit(actorId, "NFC_REGISTER", "RfidCard", cardId, diff);
}

export async function logNfcVerification(
  actorId: string | null,
  cardId: string,
  diff: unknown
): Promise<void> {
  await logAudit(actorId, "NFC_VERIFY", "RfidCard", cardId, diff);
}

export async function logFailedSignature(
  actorId: string | null,
  passportId: string,
  diff: unknown
): Promise<void> {
  await logAudit(actorId, "NFC_SIGNATURE_FAIL", "RfidCard", passportId, diff);
}

export async function logBlockedCardAttempt(
  actorId: string | null,
  cardId: string,
  diff: unknown
): Promise<void> {
  await logAudit(actorId, "NFC_BLOCKED_ATTEMPT", "RfidCard", cardId, diff);
}

export async function logGateEntrySuccess(
  actorId: string | null,
  ticketId: string,
  diff: unknown
): Promise<void> {
  await logAudit(actorId, "GATE_ENTRY_ALLOW", "Ticket", ticketId, diff);
}

export async function logGateEntryDenial(
  actorId: string | null,
  refId: string,
  diff: unknown
): Promise<void> {
  await logAudit(actorId, "GATE_ENTRY_DENY", "GateScan", refId, diff);
}
