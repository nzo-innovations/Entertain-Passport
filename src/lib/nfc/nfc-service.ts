import { db } from "@/lib/db";
import { provisionCardKey, syncIdentity, syncStatus } from "@/lib/verify/sync";
import {
  buildTagPayload,
  ensureDefaultKeyVersion,
  getActiveKeyVersion,
  verifyTagSignature,
} from "./crypto-service";
import {
  logBlockedCardAttempt,
  logFailedSignature,
  logGateEntryDenial,
  logGateEntrySuccess,
  logNfcRegistration,
  logNfcVerification,
  recordGateScan,
} from "./audit-log-service";
import {
  checkInTicket,
  findValidTicketForNfc,
  transferTicketsToCard,
} from "./ticket-verification-service";
import { fulfillPassportOrder, generatePassportId, uniquePassportNo } from "./passport-service";
import type { NfcBlockMode, NfcTagPayload, NfcVerifyResult } from "./types";
import { NFC_SCAN_TYPES } from "./types";

export type RegisterNfcInput = {
  cardUid: string;
  label?: string;
  email?: string;
  userId?: string;
  orderId?: string;
  reprogramCardId?: string;
  programmedById: string;
};

export type RegisterNfcResult = {
  card: {
    id: string;
    passportId: string;
    passportNo: string;
    uid: string;
    status: string;
    keyVersion: number;
    counter: number;
  };
  tagPayload: NfcTagPayload;
  cardBlock: string | null;
};

async function resolveUser(email?: string, userId?: string) {
  if (userId) {
    return db.user.findUnique({ where: { id: userId } });
  }
  if (email) {
    return db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }
  return null;
}

async function syncCardToVerifyPlane(
  card: { uid: string; passportNo: string; status: string; label: string | null },
  user?: { name: string | null; nic: string | null; idNumber: string | null; phone: string | null } | null
): Promise<string | null> {
  try {
    if (user) {
      await syncIdentity({
        uid: card.uid,
        passportNo: card.passportNo,
        status: card.status,
        adminLabel: card.label,
        name: user.name,
        nic: user.nic ?? user.idNumber,
        mobile: user.phone,
      });
    } else {
      await syncIdentity({
        uid: card.uid,
        passportNo: card.passportNo,
        status: card.status,
        adminLabel: card.label,
      });
    }
    const prov = await provisionCardKey(card.passportNo, card.uid);
    return prov.block;
  } catch (err) {
    console.error("verification sync failed", err);
    return null;
  }
}

export async function registerNfcCard(input: RegisterNfcInput): Promise<RegisterNfcResult> {
  await ensureDefaultKeyVersion();
  const keyVersion = await getActiveKeyVersion();
  const cardUid = input.cardUid.trim();

  const uidTaken = await db.rfidCard.findUnique({ where: { uid: cardUid } });
  if (uidTaken && uidTaken.id !== input.reprogramCardId) {
    throw new Error("That NFC chip UID is already registered.");
  }

  let user = await resolveUser(input.email, input.userId);
  let orderUserId: string | undefined;

  if (input.orderId) {
    const order = await db.passportCardOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new Error("Passport card order not found.");
    if (!["PAID", "DEFERRED"].includes(order.status)) {
      throw new Error("Order must be paid before NFC fulfillment.");
    }
    orderUserId = order.userId;
    if (!user) user = await db.user.findUnique({ where: { id: order.userId } });
  }

  const issuedAt = new Date();
  const counter = 0;
  const passportId = generatePassportId();
  const passportNo = await uniquePassportNo();
  const tagPayload = buildTagPayload({ passportId, cardUid, keyVersion, issuedAt, counter });

  let card;

  if (input.reprogramCardId) {
    const existing = await db.rfidCard.findUnique({ where: { id: input.reprogramCardId } });
    if (!existing) throw new Error("Card to reprogram not found.");
    if (existing.status === "LOST") throw new Error("Cannot reprogram a permanently declined card.");

    card = await db.rfidCard.update({
      where: { id: existing.id },
      data: {
        uid: cardUid,
        passportId,
        passportNo: existing.passportNo,
        label: input.label ?? existing.label,
        keyVersion,
        issuedAt,
        counter,
        signature: tagPayload.signature,
        programmedById: input.programmedById,
      },
    });
  } else {
    card = await db.rfidCard.create({
      data: {
        uid: cardUid,
        passportId,
        passportNo,
        label: input.label || null,
        status: user || orderUserId ? "ACTIVE" : "UNASSIGNED",
        keyVersion,
        issuedAt,
        counter,
        signature: tagPayload.signature,
        assignedUserId: user?.id ?? orderUserId ?? null,
        assignedAt: user || orderUserId ? issuedAt : null,
        programmedById: input.programmedById,
        passportCardOrderId: input.orderId ?? null,
      },
    });
  }

  if (input.orderId) {
    await fulfillPassportOrder({
      orderId: input.orderId,
      cardId: card.id,
      fulfilledById: input.programmedById,
    });
  }

  const cardBlock = await syncCardToVerifyPlane(card, user);

  await logNfcRegistration(input.programmedById, card.id, {
    passportId,
    cardUid,
    orderId: input.orderId,
    reprogram: Boolean(input.reprogramCardId),
  });

  await recordGateScan({
    rfidCardId: card.id,
    passportId,
    cardUid,
    counter,
    verdict: "ALLOW",
    reason: input.reprogramCardId ? "NFC_REPROGRAMMED" : "NFC_REGISTERED",
    scanType: NFC_SCAN_TYPES.REGISTER,
    scannedById: input.programmedById,
    payload: tagPayload,
    signatureValid: true,
  });

  return {
    card: {
      id: card.id,
      passportId,
      passportNo: card.passportNo,
      uid: card.uid,
      status: card.status,
      keyVersion: card.keyVersion,
      counter: card.counter,
    },
    tagPayload,
    cardBlock,
  };
}

export type VerifyNfcInput = {
  passportId: string;
  cardUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  signature: string;
  eventId: string;
  scannedById: string;
  checkIn?: boolean;
};

export async function verifyNfcAtGate(input: VerifyNfcInput): Promise<NfcVerifyResult> {
  const baseScan = {
    passportId: input.passportId,
    cardUid: input.cardUid,
    counter: input.counter,
    eventId: input.eventId,
    scannedById: input.scannedById,
    scanType: input.checkIn ? NFC_SCAN_TYPES.CHECK_IN : NFC_SCAN_TYPES.VERIFY,
  };

  const sigInput = {
    passportId: input.passportId,
    cardUid: input.cardUid,
    keyVersion: input.keyVersion,
    issuedAt: input.issuedAt,
    counter: input.counter,
  };

  const signatureValid = verifyTagSignature(sigInput, input.signature);
  if (!signatureValid) {
    await logFailedSignature(input.scannedById, input.passportId, { eventId: input.eventId });
    await recordGateScan({
      ...baseScan,
      verdict: "DENY",
      reason: "INVALID_SIGNATURE",
      signatureValid: false,
      payload: { passportId: input.passportId, cardUid: input.cardUid, counter: input.counter },
    });
    await logGateEntryDenial(input.scannedById, input.passportId, { reason: "INVALID_SIGNATURE" });
    return { verdict: "DENY", reason: "Invalid NFC signature." };
  }

  const card = await db.rfidCard.findUnique({
    where: { passportId: input.passportId },
    include: { assignedUser: { select: { name: true, email: true } } },
  });

  if (!card) {
    await recordGateScan({ ...baseScan, verdict: "DENY", reason: "PASSPORT_NOT_FOUND", signatureValid: true });
    await logGateEntryDenial(input.scannedById, input.passportId, { reason: "PASSPORT_NOT_FOUND" });
    return { verdict: "DENY", reason: "Passport not registered." };
  }

  if (card.uid !== input.cardUid.trim()) {
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "DENY",
      reason: "UID_MISMATCH",
      signatureValid: true,
    });
    await logGateEntryDenial(input.scannedById, card.id, { reason: "UID_MISMATCH" });
    return { verdict: "DENY", reason: "NFC chip UID does not match registered card." };
  }

  if (card.status === "BLOCKED" || card.status === "LOST") {
    await logBlockedCardAttempt(input.scannedById, card.id, { status: card.status, eventId: input.eventId });
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "DENY",
      reason: card.status === "LOST" ? "CARD_LOST" : "CARD_BLOCKED",
      signatureValid: true,
    });
    await logGateEntryDenial(input.scannedById, card.id, { reason: card.status });
    return {
      verdict: "DENY",
      reason: card.status === "LOST" ? "Card permanently declined (lost)." : "Card temporarily blocked.",
    };
  }

  if (card.status !== "ACTIVE") {
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "DENY",
      reason: "CARD_NOT_ACTIVE",
      signatureValid: true,
    });
    return { verdict: "DENY", reason: `Card status: ${card.status}. Assign and activate before entry.` };
  }

  if (input.counter < card.counter) {
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "DENY",
      reason: "COUNTER_REPLAY",
      signatureValid: true,
    });
    return { verdict: "DENY", reason: "NFC counter replay detected." };
  }

  const ticket = await findValidTicketForNfc({ rfidCardId: card.id, eventId: input.eventId });
  if (!ticket) {
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "DENY",
      reason: "NO_VALID_TICKET",
      signatureValid: true,
    });
    await logGateEntryDenial(input.scannedById, card.id, { reason: "NO_VALID_TICKET", eventId: input.eventId });
    return { verdict: "DENY", reason: "No valid ticket for this event on this passport." };
  }

  if (input.counter > card.counter) {
    await db.rfidCard.update({
      where: { id: card.id },
      data: { counter: input.counter },
    });
  }

  await logNfcVerification(input.scannedById, card.id, {
    eventId: input.eventId,
    counter: input.counter,
    ticketId: ticket.ticketId,
  });

  if (input.checkIn) {
    await checkInTicket(ticket.ticketId, input.scannedById);
    await logGateEntrySuccess(input.scannedById, ticket.ticketId, {
      passportId: card.passportId ?? input.passportId,
      eventId: input.eventId,
    });
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "ALLOW",
      reason: "CHECKED_IN",
      signatureValid: true,
      payload: { ticketId: ticket.ticketId },
    });
  } else {
    await recordGateScan({
      ...baseScan,
      rfidCardId: card.id,
      verdict: "ALLOW",
      reason: "TICKET_VALID",
      signatureValid: true,
      payload: { ticketId: ticket.ticketId },
    });
  }

  return {
    verdict: "ALLOW",
    reason: input.checkIn ? "Entry granted." : "Valid ticket found.",
    ticketId: ticket.ticketId,
    passportNo: ticket.passportNo,
    holder: ticket.holder,
    packageName: ticket.packageName,
  };
}

export async function blockNfcCard(args: {
  cardId: string;
  mode: NfcBlockMode;
  actorId: string;
}): Promise<{ cardId: string; status: string }> {
  const card = await db.rfidCard.findUnique({ where: { id: args.cardId } });
  if (!card) throw new Error("Card not found.");

  const status = args.mode === "permanent" ? "LOST" : "BLOCKED";
  const updated = await db.rfidCard.update({
    where: { id: args.cardId },
    data: { status },
  });

  try {
    await syncStatus(updated.passportNo, status);
  } catch (err) {
    console.error("verification sync (block) failed", err);
  }

  await logBlockedCardAttempt(args.actorId, card.id, { mode: args.mode, status });

  return { cardId: updated.id, status: updated.status };
}

export async function replaceNfcCard(args: {
  oldCardId: string;
  newCardUid: string;
  actorId: string;
  label?: string;
}): Promise<RegisterNfcResult & { transferredTickets: number }> {
  const oldCard = await db.rfidCard.findUnique({ where: { id: args.oldCardId } });
  if (!oldCard) throw new Error("Original card not found.");

  await blockNfcCard({ cardId: args.oldCardId, mode: "permanent", actorId: args.actorId });

  const registered = await registerNfcCard({
    cardUid: args.newCardUid,
    label: args.label ?? oldCard.label ?? undefined,
    userId: oldCard.assignedUserId ?? undefined,
    programmedById: args.actorId,
  });

  await db.rfidCard.update({
    where: { id: args.oldCardId },
    data: { replacedByCardId: registered.card.id },
  });

  const transferredTickets = await transferTicketsToCard(args.oldCardId, registered.card.id);

  return { ...registered, transferredTickets };
}

export async function unassignNfcCard(cardId: string, actorId: string): Promise<void> {
  const updated = await db.rfidCard.update({
    where: { id: cardId },
    data: { assignedUserId: null, assignedAt: null, status: "UNASSIGNED" },
  });
  try {
    await syncStatus(updated.passportNo, "UNASSIGNED");
  } catch (err) {
    console.error("verification sync (unassign) failed", err);
  }
  await logNfcRegistration(actorId, cardId, { action: "unassign" });
}

export async function assignNfcCard(cardId: string, email: string, actorId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new Error("No user with that email.");

  const updated = await db.rfidCard.update({
    where: { id: cardId },
    data: { assignedUserId: user.id, assignedAt: new Date(), status: "ACTIVE" },
  });

  await syncCardToVerifyPlane(updated, user);
  await logNfcRegistration(actorId, cardId, { action: "assign", userId: user.id });
}
