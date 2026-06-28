import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isGoogleWalletConfigured } from "@/lib/google-wallet/config";
import { buildGoogleWalletSaveUrl, buildSmartTapRedemptionValue } from "@/lib/google-wallet/generic-pass";
import { ensureDefaultKeyVersion } from "@/lib/nfc/crypto-service";
import { buildTagPayloadV2, getActiveKeyVersion } from "@/lib/passport/crypto-service";
import type { NfcTagPayloadV2 } from "@/lib/passport/types";

export const WALLET_PLATFORMS = {
  GOOGLE: "GOOGLE",
  APPLE: "APPLE",
} as const;

export type WalletPlatform = (typeof WALLET_PLATFORMS)[keyof typeof WALLET_PLATFORMS];

const ASSIGNABLE_INVENTORY_STATUSES = ["ASSIGNED", "PROGRAMMED"] as const;

export function buildVirtualCredentialUid(): string {
  return `VW${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

export type UserPassportWalletContext = {
  inventoryId: string;
  formattedPassportNumber: string;
  publicPassportNumber: string;
  internalPassportUuid: string;
  status: string;
  holderName: string;
  rfidCardId: string | null;
};

export async function getUserPassportWalletContext(userId: string): Promise<UserPassportWalletContext | null> {
  const inventory = await db.passportNumberInventory.findFirst({
    where: {
      assignedUserId: userId,
      status: { in: [...ASSIGNABLE_INVENTORY_STATUSES] },
    },
    include: {
      assignedUser: { select: { name: true } },
      rfidCard: { select: { id: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  if (!inventory) return null;

  return {
    inventoryId: inventory.id,
    formattedPassportNumber: inventory.formattedPassportNumber,
    publicPassportNumber: inventory.publicPassportNumber,
    internalPassportUuid: inventory.internalPassportUuid,
    status: inventory.status,
    holderName: inventory.assignedUser?.name?.trim() || "Member",
    rfidCardId: inventory.rfidCard?.id ?? null,
  };
}

async function ensureRfidCardForWallet(inventoryId: string): Promise<string> {
  const inventory = await db.passportNumberInventory.findUnique({
    where: { id: inventoryId },
    include: { rfidCard: true },
  });
  if (!inventory) throw new Error("Passport not found.");

  if (inventory.rfidCard) return inventory.rfidCard.id;

  const card = await db.rfidCard.create({
    data: {
      inventoryId: inventory.id,
      passportId: inventory.internalPassportUuid,
      passportNo: inventory.formattedPassportNumber,
      uid: `PENDING-${inventory.id}`,
      status: "ACTIVE",
      assignedUserId: inventory.assignedUserId,
      assignedAt: inventory.assignedAt,
    },
  });

  return card.id;
}

function buildVirtualTagPayload(args: {
  inventory: {
    internalPassportUuid: string;
    publicPassportNumber: string;
    userPrimaryIdHash: string;
  };
  credentialUid: string;
  keyVersion: number;
  issuedAt: Date;
  counter: number;
}): NfcTagPayloadV2 {
  return buildTagPayloadV2({
    internalPassportUuid: args.inventory.internalPassportUuid,
    publicPassportNumber: args.inventory.publicPassportNumber,
    nfcUid: args.credentialUid,
    keyVersion: args.keyVersion,
    issuedAt: args.issuedAt,
    counter: args.counter,
    userPrimaryIdHash: args.inventory.userPrimaryIdHash,
  });
}

export async function getWalletCredentialStatus(userId: string) {
  const passport = await getUserPassportWalletContext(userId);
  const googleConfigured = isGoogleWalletConfigured();

  if (!passport) {
    return {
      hasPassport: false as const,
      googleWallet: { configured: googleConfigured, provisioned: false },
    };
  }

  const googleCredential = await db.passportWalletCredential.findUnique({
    where: {
      inventoryId_platform: {
        inventoryId: passport.inventoryId,
        platform: WALLET_PLATFORMS.GOOGLE,
      },
    },
    select: { status: true, provisionedAt: true, externalObjectId: true },
  });

  return {
    hasPassport: true as const,
    formattedPassportNumber: passport.formattedPassportNumber,
    passportStatus: passport.status,
    holderName: passport.holderName,
    googleWallet: {
      configured: googleConfigured,
      provisioned: googleCredential?.status === "ACTIVE",
      status: googleCredential?.status ?? null,
      provisionedAt: googleCredential?.provisionedAt?.toISOString() ?? null,
    },
  };
}

export async function provisionGoogleWalletPassport(userId: string): Promise<{
  saveUrl: string;
  formattedPassportNumber: string;
  holderName: string;
  credentialUid: string;
  reprovisioned: boolean;
}> {
  if (!isGoogleWalletConfigured()) {
    throw new Error(
      "Google Wallet is not configured on this server. Contact support or use your physical Entertain Passport card."
    );
  }

  await ensureDefaultKeyVersion();
  const keyVersion = await getActiveKeyVersion();

  const inventory = await db.passportNumberInventory.findFirst({
    where: {
      assignedUserId: userId,
      status: { in: [...ASSIGNABLE_INVENTORY_STATUSES] },
    },
    include: { assignedUser: { select: { name: true } } },
    orderBy: { assignedAt: "desc" },
  });

  if (!inventory || !inventory.userPrimaryIdHash) {
    throw new Error("No assigned Entertain Passport found on your account.");
  }

  const blocked = ["BLOCKED", "DAMAGED", "REPLACED"];
  if (blocked.includes(inventory.status)) {
    throw new Error("Your Entertain Passport cannot be added to Google Wallet in its current state.");
  }

  const rfidCardId = await ensureRfidCardForWallet(inventory.id);
  const holderName = inventory.assignedUser?.name?.trim() || "Member";

  let credential = await db.passportWalletCredential.findUnique({
    where: {
      inventoryId_platform: {
        inventoryId: inventory.id,
        platform: WALLET_PLATFORMS.GOOGLE,
      },
    },
  });

  const reprovisioned = Boolean(credential);
  const issuedAt = credential?.issuedAt ?? new Date();
  const counter = credential?.counter ?? 0;
  const credentialUid = credential?.credentialUid ?? buildVirtualCredentialUid();
  const smartTapRedemptionValue =
    credential?.smartTapRedemptionValue ?? buildSmartTapRedemptionValue();

  const tagPayload = buildVirtualTagPayload({
    inventory: {
      internalPassportUuid: inventory.internalPassportUuid,
      publicPassportNumber: inventory.publicPassportNumber,
      userPrimaryIdHash: inventory.userPrimaryIdHash,
    },
    credentialUid,
    keyVersion,
    issuedAt,
    counter,
  });

  const { saveUrl, objectId } = await buildGoogleWalletSaveUrl({
    inventoryId: inventory.id,
    formattedPassportNumber: inventory.formattedPassportNumber,
    holderName,
    smartTapRedemptionValue,
  });

  if (credential) {
    credential = await db.passportWalletCredential.update({
      where: { id: credential.id },
      data: {
        rfidCardId,
        credentialUid,
        keyVersion,
        counter,
        signature: tagPayload.signature,
        issuedAt,
        externalObjectId: objectId,
        smartTapRedemptionValue,
        status: "ACTIVE",
        revokedAt: null,
        lastSyncedAt: new Date(),
      },
    });
  } else {
    credential = await db.passportWalletCredential.create({
      data: {
        inventoryId: inventory.id,
        rfidCardId,
        platform: WALLET_PLATFORMS.GOOGLE,
        credentialUid,
        keyVersion,
        counter,
        signature: tagPayload.signature,
        issuedAt,
        externalObjectId: objectId,
        smartTapRedemptionValue,
        status: "ACTIVE",
        lastSyncedAt: new Date(),
      },
    });
  }

  await logAudit(userId, reprovisioned ? "WALLET_REPROVISION" : "WALLET_PROVISION", "PassportWalletCredential", credential.id, {
    platform: WALLET_PLATFORMS.GOOGLE,
    inventoryId: inventory.id,
    publicNumberSuffix: inventory.publicPassportNumber.slice(-4),
  });

  return {
    saveUrl,
    formattedPassportNumber: inventory.formattedPassportNumber,
    holderName,
    credentialUid,
    reprovisioned,
  };
}

export async function revokeWalletCredentialsForInventory(inventoryId: string): Promise<number> {
  const result = await db.passportWalletCredential.updateMany({
    where: { inventoryId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  return result.count;
}
