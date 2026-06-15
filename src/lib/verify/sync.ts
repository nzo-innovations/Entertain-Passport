// ============================================================
// One-way sync: CORE app  ->  VERIFICATION plane (write-only)
// ============================================================
// Called from the trusted core app (e.g. the Super-Admin RFID routes). It
// projects ONLY minimal, hashed identity into the isolated verification DB.
// There is no path back: the verification plane never reads core sales data.
import { verifyDb } from "@/lib/verify-db";
import { hashPii, hashUid, encryptCardBlock } from "./crypto";
import { generateCardDataKey } from "./kms";

export type IdentitySyncInput = {
  uid: string;
  passportNo: string;
  status: string; // UNASSIGNED | ACTIVE | BLOCKED | LOST
  adminLabel?: string | null;
  name?: string | null;
  nic?: string | null;
  mobile?: string | null;
};

/** Upsert the minimal identity projection for a card. Best-effort. */
export async function syncIdentity(input: IdentitySyncInput): Promise<void> {
  const cardUidHash = hashUid(input.uid);
  const data = {
    cardUidHash,
    status: input.status,
    adminLabel: input.adminLabel ?? null,
    nameHash: hashPii(input.name),
    nicHash: hashPii(input.nic),
    mobileHash: hashPii(input.mobile),
  };
  await verifyDb.verifIdentity.upsert({
    where: { passportNo: input.passportNo },
    create: { passportNo: input.passportNo, ...data },
    update: data,
  });
}

/** Update only the validation status (assign/block/lost/activate/unassign). */
export async function syncStatus(passportNo: string, status: string): Promise<void> {
  await verifyDb.verifIdentity
    .update({ where: { passportNo }, data: { status } })
    .catch(() => undefined);
}

export type ProvisionResult = {
  /** base64 block to write into the DESFire card user memory. */
  block: string;
  keyVersion: number;
};

/**
 * Provision per-card crypto for a DESFire EV2/EV3 card and return the encrypted
 * on-card block to program onto the chip. Re-provisioning rotates the card's
 * data key (e.g. on re-issue). Requires the identity to already exist.
 */
export async function provisionCardKey(passportNo: string, uid: string): Promise<ProvisionResult> {
  const generated = generateCardDataKey();
  const diversifierHash = hashUid(uid);
  const block = encryptCardBlock(generated.plaintext, {
    passportNo,
    version: generated.version,
    issuedAt: Date.now(),
  });

  await verifyDb.verifCardKey.upsert({
    where: { passportNo },
    create: {
      passportNo,
      kmsKeyId: generated.keyId,
      keyVersion: generated.version,
      wrappedDataKey: generated.wrappedBase64,
      diversifierHash,
    },
    update: {
      kmsKeyId: generated.keyId,
      keyVersion: generated.version,
      wrappedDataKey: generated.wrappedBase64,
      diversifierHash,
      rotatedAt: new Date(),
    },
  });

  return { block, keyVersion: generated.version };
}
