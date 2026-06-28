import { db } from "@/lib/db";
import {
  checkInTicket,
  findValidTicketForNfc,
} from "@/lib/nfc/ticket-verification-service";
import {
  logBlockedCardAttempt,
  logGateEntryDenial,
  logGateEntrySuccess,
  logNfcVerification,
  recordGateScan,
} from "@/lib/nfc/audit-log-service";
import { NFC_SCAN_TYPES } from "@/lib/nfc/types";
import type { NfcVerifyResult } from "@/lib/nfc/types";

/** Gate verify after Google Wallet NFC Smart Tap (phone tap - no QR). */
export async function verifyWalletSmartTapAtGate(input: {
  smartTapRedemptionValue: string;
  eventId: string;
  scannedById: string;
  checkIn?: boolean;
}): Promise<NfcVerifyResult> {
  const redemptionValue = input.smartTapRedemptionValue.trim();
  const checkIn = input.checkIn !== false;

  const credential = await db.passportWalletCredential.findUnique({
    where: { smartTapRedemptionValue: redemptionValue },
    include: {
      inventory: {
        include: { rfidCard: true },
      },
    },
  });

  const baseScan = {
    passportId: credential?.inventory.internalPassportUuid ?? "unknown",
    cardUid: credential?.credentialUid ?? redemptionValue,
    counter: credential?.counter ?? 0,
    eventId: input.eventId,
    scannedById: input.scannedById,
    scanType: checkIn ? NFC_SCAN_TYPES.CHECK_IN : NFC_SCAN_TYPES.VERIFY,
  };

  if (!credential || credential.status !== "ACTIVE") {
    await recordGateScan({
      ...baseScan,
      verdict: "DENY",
      reason: "WALLET_NOT_FOUND",
      signatureValid: false,
    });
    return { verdict: "DENY", reason: "Google Wallet pass not recognized." };
  }

  const inventory = credential.inventory;
  const blockedStatuses = ["BLOCKED", "DAMAGED", "REPLACED"];
  if (blockedStatuses.includes(inventory.status)) {
    await logBlockedCardAttempt(input.scannedById, inventory.id, {
      status: inventory.status,
      eventId: input.eventId,
    });
    await recordGateScan({
      ...baseScan,
      rfidCardId: inventory.rfidCard?.id,
      verdict: "DENY",
      reason: `STATUS_${inventory.status}`,
      signatureValid: true,
    });
    return { verdict: "DENY", reason: "Virtual passport is not active." };
  }

  const rfidCardId = inventory.rfidCard?.id;
  if (!rfidCardId) {
    return { verdict: "DENY", reason: "No active passport registration." };
  }

  const ticket = await findValidTicketForNfc({ rfidCardId, eventId: input.eventId });
  if (!ticket) {
    await logGateEntryDenial(input.scannedById, inventory.id, {
      reason: "NO_VALID_TICKET",
      eventId: input.eventId,
    });
    await recordGateScan({
      ...baseScan,
      rfidCardId,
      verdict: "DENY",
      reason: "NO_VALID_TICKET",
      signatureValid: true,
    });
    return { verdict: "DENY", reason: "No valid ticket for this event on this passport." };
  }

  await logNfcVerification(input.scannedById, inventory.id, {
    eventId: input.eventId,
    counter: credential.counter,
    ticketId: ticket.ticketId,
  });

  const scanPayload = {
    ticketId: ticket.ticketId,
    credentialChannel: "WALLET" as const,
    passportNo: inventory.formattedPassportNumber,
    smartTap: true,
  };

  if (checkIn) {
    await checkInTicket(ticket.ticketId, input.scannedById);
    await logGateEntrySuccess(input.scannedById, ticket.ticketId, {
      passportId: inventory.internalPassportUuid,
      eventId: input.eventId,
    });
    await recordGateScan({
      ...baseScan,
      rfidCardId,
      verdict: "ALLOW",
      reason: "CHECKED_IN",
      signatureValid: true,
      payload: scanPayload,
    });
  } else {
    await recordGateScan({
      ...baseScan,
      rfidCardId,
      verdict: "ALLOW",
      reason: "TICKET_VALID",
      signatureValid: true,
      payload: scanPayload,
    });
  }

  return {
    verdict: "ALLOW",
    reason: checkIn ? "Entry granted." : "Valid ticket found.",
    ticketId: ticket.ticketId,
    passportNo: inventory.formattedPassportNumber,
    holder: ticket.holder,
    packageName: ticket.packageName,
    credentialChannel: "WALLET",
  };
}
