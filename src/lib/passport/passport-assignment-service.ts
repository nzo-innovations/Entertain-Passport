import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { IdentityType } from "@/lib/identity";
import { validateIdentity } from "@/lib/identity";
import { hashUserPrimaryId, primaryIdAuditRef } from "./id-hash";
import { resolvePublicNumberInput } from "./passport-inventory-service";
import { PASSPORT_CARD_TYPE_LABELS } from "./types";

async function findUserByPrimaryId(primaryIdType: IdentityType, primaryIdValue: string) {
  const validation = validateIdentity(primaryIdType, primaryIdValue);
  if (!validation.ok) {
    return { ok: false as const, error: validation.error ?? "Invalid primary ID." };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { idNumber: validation.normalized, idType: primaryIdType },
        ...(primaryIdType === "NIC" ? [{ nic: validation.normalized }] : []),
      ],
    },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return { ok: false as const, error: "User does not exist in database." };
  }

  return { ok: true as const, user, normalized: validation.normalized };
}

async function resolveUserByPrimaryId(primaryIdType: IdentityType, primaryIdValue: string) {
  const result = await findUserByPrimaryId(primaryIdType, primaryIdValue);
  if (!result.ok) {
    throw new Error(
      result.error === "User does not exist in database."
        ? "No member account found with that NIC or passport. The guest must sign up on Entertain Passport first."
        : result.error
    );
  }
  return result;
}

export async function lookupPassportForAssign(publicPassportNumber: string) {
  const trimmed = publicPassportNumber.trim();
  if (!trimmed) {
    return { state: "idle" as const };
  }

  const parsed = resolvePublicNumberInput(trimmed);
  if (!parsed.ok) {
    return { state: "invalid" as const, error: parsed.error ?? "Invalid passport number format." };
  }
  if (parsed.compact.length < 10) {
    return { state: "idle" as const };
  }

  const inventory = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: parsed.compact },
    select: {
      formattedPassportNumber: true,
      status: true,
      cardType: true,
    },
  });

  if (!inventory) {
    return { state: "missing" as const, error: "Card does not exist in database." };
  }

  const cardTypeLabel = PASSPORT_CARD_TYPE_LABELS[inventory.cardType] ?? inventory.cardType;
  const assignable = inventory.status === "AVAILABLE";

  return {
    state: "found" as const,
    formattedPassportNumber: inventory.formattedPassportNumber,
    status: inventory.status,
    cardTypeLabel,
    assignable,
    detail: `${cardTypeLabel} · ${inventory.status}`,
    error: assignable ? undefined : `Card exists but status is ${inventory.status}. Only AVAILABLE cards can be assigned.`,
  };
}

export async function lookupUserForAssign(primaryIdType: IdentityType, primaryIdValue: string) {
  const trimmed = primaryIdValue.trim();
  if (!trimmed) {
    return { state: "idle" as const };
  }
  if (trimmed.length < 5) {
    return { state: "idle" as const };
  }

  const result = await findUserByPrimaryId(primaryIdType, trimmed);
  if (!result.ok) {
    return {
      state: result.error === "Invalid primary ID." ? ("invalid" as const) : ("missing" as const),
      error: result.error,
    };
  }

  return {
    state: "found" as const,
    name: result.user.name,
    email: result.user.email,
    detail: result.user.name ?? result.user.email,
  };
}

export async function assignPassportToUser(args: {
  publicPassportNumber: string;
  userId: string;
  primaryIdType: IdentityType;
  primaryIdValue: string;
  actorId: string;
}): Promise<{ inventoryId: string; formattedPassportNumber: string }> {
  const parsed = resolvePublicNumberInput(args.publicPassportNumber);
  if (!parsed.ok) throw new Error(parsed.error ?? "Invalid passport number.");

  const inventory = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: parsed.compact },
  });
  if (!inventory) throw new Error("Passport number not found in inventory.");
  if (inventory.status !== "AVAILABLE") {
    throw new Error(`Card status is ${inventory.status}. Only AVAILABLE cards can be assigned.`);
  }

  const user = await db.user.findUnique({ where: { id: args.userId } });
  if (!user) throw new Error("User not found.");

  const userPrimaryIdHash = hashUserPrimaryId(args.primaryIdType, args.primaryIdValue);

  await db.passportNumberInventory.update({
    where: { id: inventory.id },
    data: {
      status: "ASSIGNED",
      assignedUserId: args.userId,
      assignedAt: new Date(),
      userPrimaryIdType: args.primaryIdType,
      userPrimaryIdHash,
    },
  });

  await logAudit(args.actorId, "ASSIGN", "PassportNumberInventory", inventory.id, {
    userId: args.userId,
    publicPassportNumber: parsed.compact,
    primaryIdRef: primaryIdAuditRef(userPrimaryIdHash),
  });

  return { inventoryId: inventory.id, formattedPassportNumber: inventory.formattedPassportNumber };
}

export async function assignPassportByPrimaryId(args: {
  publicPassportNumber: string;
  primaryIdType: IdentityType;
  primaryIdValue: string;
  actorId: string;
}) {
  const { user, normalized } = await resolveUserByPrimaryId(args.primaryIdType, args.primaryIdValue);
  return assignPassportToUser({
    publicPassportNumber: args.publicPassportNumber,
    userId: user.id,
    primaryIdType: args.primaryIdType,
    primaryIdValue: normalized,
    actorId: args.actorId,
  });
}
