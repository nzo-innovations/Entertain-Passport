import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ensureDefaultKeyVersion } from "@/lib/nfc/crypto-service";
import { provisionCardKey, syncIdentity } from "@/lib/verify/sync";
import { buildPassportPublicDisplay } from "@/lib/nfc/passport-ndef";
import { revokeWalletCredentialsForInventory } from "@/lib/passport/wallet-credential-service";
import { buildTagPayloadV2, getActiveKeyVersion } from "./crypto-service";
import { primaryIdAuditRef } from "./id-hash";
import {
  compactPublicNumber,
  resolvePublicNumberInput,
} from "./passport-inventory-service";
import type { NfcTagPayloadV2 } from "./types";

export async function programNfcForAssignedPassport(args: {
  publicPassportNumber: string;
  nfcUid: string;
  programmedById: string;
  reprogram?: boolean;
}): Promise<{
  tagPayload: NfcTagPayloadV2;
  programmingId: string;
  rfidCardId: string;
  reprogrammed: boolean;
  publicDisplay: string;
  formattedPassportNumber: string;
  holderName: string | null;
}> {
  await ensureDefaultKeyVersion();
  const keyVersion = await getActiveKeyVersion();
  const parsed = resolvePublicNumberInput(args.publicPassportNumber);
  if (!parsed.ok) throw new Error(parsed.error ?? "Invalid passport number.");

  const inventory = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: parsed.compact },
    include: { assignedUser: true, rfidCard: true },
  });
  if (!inventory) throw new Error("Passport number not found.");

  const reprogram = args.reprogram === true;
  const allowedStatuses: string[] = reprogram ? ["ASSIGNED", "PROGRAMMED"] : ["ASSIGNED"];
  if (!allowedStatuses.includes(inventory.status)) {
    if (inventory.status === "PROGRAMMED" && !reprogram) {
      throw new Error(
        "Card is already PROGRAMMED. Enable re-program mode if the chip write failed or you need a new chip."
      );
    }
    throw new Error(`Card status is ${inventory.status}. Only ${allowedStatuses.join(" or ")} cards can be programmed.`);
  }
  if (!inventory.userPrimaryIdHash || !inventory.assignedUserId) {
    throw new Error("Card must be assigned with a verified primary ID before programming.");
  }

  const nfcUid = args.nfcUid.trim();
  const uidConflict = await db.rfidCard.findUnique({ where: { uid: nfcUid } });
  if (uidConflict && uidConflict.inventoryId !== inventory.id) {
    throw new Error("NFC UID already registered on another card.");
  }

  if (reprogram && inventory.status === "PROGRAMMED") {
    await db.nfcCardProgramming.updateMany({
      where: { inventoryId: inventory.id, programmingStatus: "PROGRAMMED" },
      data: { programmingStatus: "FAILED" },
    });
  }

  const issuedAt = new Date();
  const counter = 0;
  const tagPayload = buildTagPayloadV2({
    internalPassportUuid: inventory.internalPassportUuid,
    publicPassportNumber: inventory.publicPassportNumber,
    nfcUid,
    keyVersion,
    issuedAt,
    counter,
    userPrimaryIdHash: inventory.userPrimaryIdHash,
  });

  const programming = await db.nfcCardProgramming.create({
    data: {
      inventoryId: inventory.id,
      publicPassportNumber: inventory.publicPassportNumber,
      internalPassportUuid: inventory.internalPassportUuid,
      userId: inventory.assignedUserId,
      userPrimaryIdType: inventory.userPrimaryIdType,
      userPrimaryIdHash: inventory.userPrimaryIdHash,
      nfcUid,
      keyVersion,
      counter,
      signature: tagPayload.signature,
      programmingStatus: "PROGRAMMED",
      programmedById: args.programmedById,
      programmedAt: issuedAt,
    },
  });

  const user = inventory.assignedUser;
  const rfidCard = await db.rfidCard.upsert({
    where: { inventoryId: inventory.id },
    create: {
      inventoryId: inventory.id,
      uid: nfcUid,
      passportId: inventory.internalPassportUuid,
      passportNo: inventory.formattedPassportNumber,
      status: "ACTIVE",
      keyVersion,
      issuedAt,
      counter,
      signature: tagPayload.signature,
      assignedUserId: inventory.assignedUserId,
      assignedAt: inventory.assignedAt,
      programmedById: args.programmedById,
    },
    update: {
      uid: nfcUid,
      passportId: inventory.internalPassportUuid,
      passportNo: inventory.formattedPassportNumber,
      status: "ACTIVE",
      keyVersion,
      issuedAt,
      counter,
      signature: tagPayload.signature,
      programmedById: args.programmedById,
    },
  });

  await db.passportNumberInventory.update({
    where: { id: inventory.id },
    data: { status: "PROGRAMMED", programmedAt: issuedAt },
  });

  try {
    await syncIdentity({
      uid: nfcUid,
      passportNo: inventory.formattedPassportNumber,
      status: "ACTIVE",
      name: user?.name,
      nic: user?.idType === "NIC" ? user.idNumber : user?.nic,
      mobile: user?.phone,
    });
    await provisionCardKey(inventory.formattedPassportNumber, nfcUid);
  } catch (err) {
    console.error("verify plane sync after program failed", err);
  }

  await logAudit(
    args.programmedById,
    reprogram ? "NFC_REPROGRAM" : "NFC_PROGRAM",
    "NfcCardProgramming",
    programming.id,
    {
      inventoryId: inventory.id,
      publicPassportNumber: inventory.publicPassportNumber,
      primaryIdRef: primaryIdAuditRef(inventory.userPrimaryIdHash),
      reprogram,
    }
  );

  const publicDisplay = buildPassportPublicDisplay({
    formattedPassportNumber: inventory.formattedPassportNumber,
    holderName: user?.name,
  });

  return {
    tagPayload,
    programmingId: programming.id,
    rfidCardId: rfidCard.id,
    reprogrammed: reprogram,
    publicDisplay,
    formattedPassportNumber: inventory.formattedPassportNumber,
    holderName: user?.name ?? null,
  };
}

/** Undo a failed chip write - returns passport to ASSIGNED so it can be programmed again. */
export async function resetPassportProgramming(args: {
  publicPassportNumber: string;
  actorId: string;
  reason?: string;
}): Promise<{ inventoryId: string; status: "ASSIGNED" }> {
  const parsed = resolvePublicNumberInput(args.publicPassportNumber);
  if (!parsed.ok) throw new Error(parsed.error ?? "Invalid passport number.");

  const inventory = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: parsed.compact },
    include: { rfidCard: true },
  });
  if (!inventory) throw new Error("Passport number not found.");
  if (inventory.status !== "PROGRAMMED") {
    throw new Error(`Card status is ${inventory.status}. Only PROGRAMMED cards can be reset.`);
  }

  await db.nfcCardProgramming.updateMany({
    where: { inventoryId: inventory.id, programmingStatus: "PROGRAMMED" },
    data: { programmingStatus: "FAILED" },
  });

  if (inventory.rfidCard) {
    await db.rfidCard.update({
      where: { id: inventory.rfidCard.id },
      data: { status: "BLOCKED" },
    });
  }

  await db.passportNumberInventory.update({
    where: { id: inventory.id },
    data: { status: "ASSIGNED", programmedAt: null },
  });

  await logAudit(args.actorId, "NFC_PROGRAM_RESET", "PassportNumberInventory", inventory.id, {
    publicPassportNumber: inventory.publicPassportNumber,
    reason: args.reason?.trim() || "Chip write failed - reset for re-programming",
  });

  return { inventoryId: inventory.id, status: "ASSIGNED" };
}

export async function blockPassportInventory(args: {
  publicPassportNumber: string;
  mode: "temporary" | "permanent" | "damaged";
  actorId: string;
}) {
  const compact = compactPublicNumber(args.publicPassportNumber);
  const inventory = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: compact },
    include: { rfidCard: true },
  });
  if (!inventory) throw new Error("Passport not found.");

  const status = args.mode === "damaged" ? "DAMAGED" : "BLOCKED";

  await db.passportNumberInventory.update({
    where: { id: inventory.id },
    data: { status },
  });

  if (inventory.rfidCard) {
    await db.rfidCard.update({
      where: { id: inventory.rfidCard.id },
      data: { status: args.mode === "permanent" ? "LOST" : "BLOCKED" },
    });
  }

  await revokeWalletCredentialsForInventory(inventory.id);

  await logAudit(args.actorId, "BLOCK", "PassportNumberInventory", inventory.id, { mode: args.mode });
  return { inventoryId: inventory.id, status };
}

export async function replacePassportInventory(args: {
  oldPublicPassportNumber: string;
  newPublicPassportNumber: string;
  nfcUid: string;
  actorId: string;
}) {
  const oldCompact = compactPublicNumber(args.oldPublicPassportNumber);
  const old = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: oldCompact },
    include: { rfidCard: true },
  });
  if (!old?.assignedUserId || !old.userPrimaryIdHash || !old.userPrimaryIdType) {
    throw new Error("Old card has no assignment to transfer.");
  }

  const oldRfidCardId = old.rfidCard?.id ?? null;

  await db.passportNumberInventory.update({
    where: { id: old.id },
    data: { status: "REPLACED" },
  });
  if (old.rfidCard) {
    await db.rfidCard.update({ where: { id: old.rfidCard.id }, data: { status: "LOST" } });
  }
  await db.nfcCardProgramming.updateMany({
    where: { inventoryId: old.id, programmingStatus: "PROGRAMMED" },
    data: { programmingStatus: "REPLACED" },
  });
  await revokeWalletCredentialsForInventory(old.id);

  const newParsed = resolvePublicNumberInput(args.newPublicPassportNumber);
  if (!newParsed.ok) throw new Error(newParsed.error ?? "Invalid new passport number.");

  const newInv = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: newParsed.compact },
  });
  if (!newInv || newInv.status !== "AVAILABLE") {
    throw new Error("Replacement passport must be AVAILABLE in inventory.");
  }

  await db.passportNumberInventory.update({
    where: { id: newInv.id },
    data: {
      status: "ASSIGNED",
      assignedUserId: old.assignedUserId,
      assignedAt: new Date(),
      userPrimaryIdType: old.userPrimaryIdType,
      userPrimaryIdHash: old.userPrimaryIdHash,
    },
  });

  const programmed = await programNfcForAssignedPassport({
    publicPassportNumber: newParsed.compact,
    nfcUid: args.nfcUid,
    programmedById: args.actorId,
  });

  if (oldRfidCardId) {
    await db.ticket.updateMany({
      where: { rfidCardId: oldRfidCardId },
      data: { rfidCardId: programmed.rfidCardId },
    });
  }

  await logAudit(args.actorId, "REPLACE", "PassportNumberInventory", newInv.id, {
    replacedFrom: old.publicPassportNumber,
  });

  return programmed;
}
