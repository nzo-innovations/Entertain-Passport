import { db } from "@/lib/db";
import { compactPublicNumber } from "./passport-inventory-service";
import { verifyTagSignatureV2 } from "./crypto-service";
import {
  checkInTicket,
  findValidTicketForNfc,
} from "@/lib/nfc/ticket-verification-service";
import {
  logBlockedCardAttempt,
  logFailedSignature,
  logGateEntryDenial,
  logGateEntrySuccess,
  logNfcVerification,
  recordGateScan,
} from "@/lib/nfc/audit-log-service";
import { NFC_SCAN_TYPES } from "@/lib/nfc/types";
import type { NfcVerifyResult } from "@/lib/nfc/types";
import { verifyNfcAtGate } from "@/lib/nfc/nfc-service";

export type VerifyV2Input = {
  internalPassportUuid: string;
  publicPassportNumber: string;
  nfcUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  signature: string;
  eventId: string;
  scannedById: string;
  checkIn?: boolean;
};

/** Gate verification for inventory-programmed NFC v2 payloads. */
export async function verifyInventoryNfcAtGate(input: VerifyV2Input): Promise<NfcVerifyResult> {
  const publicCompact = compactPublicNumber(input.publicPassportNumber);
  const nfcUid = input.nfcUid.trim();

  const baseScan = {
    passportId: input.internalPassportUuid,
    cardUid: nfcUid,
    counter: input.counter,
    eventId: input.eventId,
    scannedById: input.scannedById,
    scanType: input.checkIn ? NFC_SCAN_TYPES.CHECK_IN : NFC_SCAN_TYPES.VERIFY,
  };

  const inventory = await db.passportNumberInventory.findUnique({
    where: { internalPassportUuid: input.internalPassportUuid },
    include: {
      rfidCard: true,
      walletCredentials: {
        where: { status: "ACTIVE" },
      },
      nfcProgramming: {
        where: { programmingStatus: "PROGRAMMED" },
        orderBy: { programmedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!inventory) {
    await recordGateScan({
      ...baseScan,
      verdict: "DENY",
      reason: "PASSPORT_NOT_FOUND",
      signatureValid: false,
    });
    return { verdict: "DENY", reason: "Passport not registered." };
  }

  if (inventory.publicPassportNumber !== publicCompact) {
    await recordGateScan({
      ...baseScan,
      rfidCardId: inventory.rfidCard?.id,
      verdict: "DENY",
      reason: "PUBLIC_NUMBER_MISMATCH",
      signatureValid: false,
    });
    return { verdict: "DENY", reason: "Public passport number mismatch." };
  }

  const programming = inventory.nfcProgramming[0];
  const walletCredential = inventory.walletCredentials.find((w) => w.credentialUid === nfcUid);

  if (!inventory.userPrimaryIdHash) {
    await recordGateScan({
      ...baseScan,
      verdict: "DENY",
      reason: "NOT_ASSIGNED",
      signatureValid: false,
    });
    return { verdict: "DENY", reason: "Card is not assigned." };
  }

  const isVirtualScan = Boolean(walletCredential);
  const isPhysicalScan = Boolean(programming && programming.nfcUid === nfcUid);

  if (!isVirtualScan && !isPhysicalScan) {
    if (!programming && !walletCredential) {
      await recordGateScan({
        ...baseScan,
        verdict: "DENY",
        reason: "NOT_PROGRAMMED",
        signatureValid: false,
      });
      return { verdict: "DENY", reason: "Card is not programmed." };
    }
    await recordGateScan({
      ...baseScan,
      rfidCardId: inventory.rfidCard?.id,
      verdict: "DENY",
      reason: "UID_MISMATCH",
      signatureValid: false,
    });
    return { verdict: "DENY", reason: "Credential UID does not match registered passport." };
  }

  const signatureValid = verifyTagSignatureV2(
    {
      internalPassportUuid: input.internalPassportUuid,
      publicPassportNumber: publicCompact,
      nfcUid,
      keyVersion: input.keyVersion,
      issuedAt: input.issuedAt,
      counter: input.counter,
      userPrimaryIdHash: inventory.userPrimaryIdHash,
    },
    input.signature
  );

  if (!signatureValid) {
    await logFailedSignature(input.scannedById, input.internalPassportUuid, { eventId: input.eventId });
    await recordGateScan({
      ...baseScan,
      rfidCardId: inventory.rfidCard?.id,
      verdict: "DENY",
      reason: "INVALID_SIGNATURE",
      signatureValid: false,
    });
    return { verdict: "DENY", reason: "Invalid NFC signature." };
  }

  const blockedStatuses = ["BLOCKED", "DAMAGED", "REPLACED"];
  if (isPhysicalScan && inventory.status !== "PROGRAMMED") {
    if (blockedStatuses.includes(inventory.status)) {
      await logBlockedCardAttempt(input.scannedById, inventory.id, {
        status: inventory.status,
        eventId: input.eventId,
      });
    }
    await recordGateScan({
      ...baseScan,
      rfidCardId: inventory.rfidCard?.id,
      verdict: "DENY",
      reason: `STATUS_${inventory.status}`,
      signatureValid: true,
    });
    const msg =
      inventory.status === "BLOCKED"
        ? "Card is blocked."
        : inventory.status === "DAMAGED"
          ? "Card is damaged."
          : inventory.status === "REPLACED"
            ? "Card was replaced."
            : `Card status: ${inventory.status}.`;
    return { verdict: "DENY", reason: msg };
  }

  if (isVirtualScan && blockedStatuses.includes(inventory.status)) {
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

  const counterBaseline = isVirtualScan
    ? (walletCredential?.counter ?? 0)
    : (programming?.counter ?? 0);

  if (input.counter < counterBaseline) {
    await recordGateScan({
      ...baseScan,
      rfidCardId: inventory.rfidCard?.id,
      verdict: "DENY",
      reason: "COUNTER_REPLAY",
      signatureValid: true,
    });
    return { verdict: "DENY", reason: "NFC counter replay detected." };
  }

  const rfidCardId = inventory.rfidCard?.id;
  if (!rfidCardId) {
    return { verdict: "DENY", reason: "No active NFC registration for this passport." };
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

  if (input.counter > counterBaseline) {
    if (isVirtualScan && walletCredential) {
      await db.passportWalletCredential.update({
        where: { id: walletCredential.id },
        data: { counter: input.counter },
      });
    }
    if (isPhysicalScan && programming) {
      await db.nfcCardProgramming.update({
        where: { id: programming.id },
        data: { counter: input.counter },
      });
    }
    if (inventory.rfidCard) {
      await db.rfidCard.update({
        where: { id: inventory.rfidCard.id },
        data: { counter: input.counter },
      });
    }
  }

  await logNfcVerification(input.scannedById, inventory.id, {
    eventId: input.eventId,
    counter: input.counter,
    ticketId: ticket.ticketId,
  });

  const credentialChannel = isVirtualScan ? ("WALLET" as const) : ("PHYSICAL" as const);
  const scanPayload = {
    ticketId: ticket.ticketId,
    credentialChannel,
    passportNo: inventory.formattedPassportNumber,
  };

  if (input.checkIn) {
    await checkInTicket(ticket.ticketId, input.scannedById);
    await logGateEntrySuccess(input.scannedById, ticket.ticketId, {
      passportId: input.internalPassportUuid,
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
    reason: input.checkIn ? "Entry granted." : "Valid ticket found.",
    ticketId: ticket.ticketId,
    passportNo: inventory.formattedPassportNumber,
    holder: ticket.holder,
    packageName: ticket.packageName,
    credentialChannel,
  };
}

/** Route v1 legacy or v2 inventory payloads. */
export async function verifyNfcPayloadAtGate(
  body: Record<string, unknown>,
  ctx: { eventId: string; scannedById: string; checkIn?: boolean }
): Promise<NfcVerifyResult> {
  if (typeof body.internalPassportUuid === "string" && typeof body.publicPassportNumber === "string") {
    return verifyInventoryNfcAtGate({
      internalPassportUuid: body.internalPassportUuid,
      publicPassportNumber: body.publicPassportNumber,
      nfcUid: String(body.nfcUid ?? body.cardUid ?? ""),
      keyVersion: Number(body.keyVersion),
      issuedAt: String(body.issuedAt),
      counter: Number(body.counter),
      signature: String(body.signature),
      eventId: ctx.eventId,
      scannedById: ctx.scannedById,
      checkIn: ctx.checkIn,
    });
  }

  return verifyNfcAtGate({
    passportId: String(body.passportId ?? ""),
    cardUid: String(body.cardUid ?? body.nfcUid ?? ""),
    keyVersion: Number(body.keyVersion),
    issuedAt: String(body.issuedAt),
    counter: Number(body.counter),
    signature: String(body.signature),
    eventId: ctx.eventId,
    scannedById: ctx.scannedById,
    checkIn: ctx.checkIn,
  });
}
