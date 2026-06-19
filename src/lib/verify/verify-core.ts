// ============================================================
// Tap-only verification core (verdict-only contract)
// ============================================================
// Decrypts the on-card block with the card's KMS-wrapped data key, binds it to
// the chip UID (clone resistance), and returns ONLY a validation verdict/status.
// No identity fields are ever returned (data-sharing contract = validation
// status only).
import { verifyDb } from "@/lib/verify-db";
import { decryptCardBlock, hashUid, timingSafeEqualHex } from "./crypto";
import { unwrapCardDataKey } from "./kms";
import { currentPeriod, type EffectiveLimits } from "./limits";

export type TapInput = {
  uid: string; // raw chip UID from the reader
  block: string; // base64 encrypted on-card data block
};

export type Verdict = "VALID" | "INVALID" | "NOT_FOUND" | "BLOCKED" | "ERROR";

export type TapOutcome = {
  verdict: Verdict;
  status: string | null; // validation status surfaced to partner (ACTIVE/BLOCKED/...)
  billable: boolean; // definitive answer about a real, known card
  passportNo?: string | null; // internal — for usage metering, never returned to partners
  reason?: string;
};

/** Core tap verification. Reads only the isolated verification plane. */
export async function verifyTap(input: TapInput): Promise<TapOutcome> {
  const uid = (input.uid ?? "").trim();
  const block = (input.block ?? "").trim();
  if (!uid || !block) {
    return { verdict: "INVALID", status: null, billable: false, reason: "missing_uid_or_block" };
  }

  const uidHash = hashUid(uid);
  const identity = await verifyDb.verifIdentity.findUnique({
    where: { cardUidHash: uidHash },
    include: { cardKey: true },
  });

  if (!identity) {
    return { verdict: "NOT_FOUND", status: null, billable: false, reason: "unknown_card" };
  }
  if (!identity.cardKey) {
    return { verdict: "INVALID", status: identity.status, billable: false, reason: "no_card_key" };
  }

  // Recover the per-card data key and decrypt the on-card block.
  let payloadPassport: string;
  try {
    const dataKey = unwrapCardDataKey(
      identity.cardKey.kmsKeyId,
      identity.cardKey.keyVersion,
      identity.cardKey.wrappedDataKey
    );
    payloadPassport = decryptCardBlock(dataKey, block).passportNo;
  } catch {
    // Auth-tag failure => tampered/forged block.
    return { verdict: "INVALID", status: identity.status, billable: true, reason: "block_decrypt_failed" };
  }

  // Bind the decrypted block to this identity and chip (clone resistance).
  if (payloadPassport !== identity.passportNo) {
    return { verdict: "INVALID", status: identity.status, billable: true, reason: "passport_mismatch" };
  }
  if (!timingSafeEqualHex(uidHash, identity.cardKey.diversifierHash)) {
    return { verdict: "INVALID", status: identity.status, billable: true, reason: "diversifier_mismatch" };
  }

  switch (identity.status) {
    case "ACTIVE":
      return { verdict: "VALID", status: "ACTIVE", billable: true, passportNo: identity.passportNo };
    case "BLOCKED":
    case "LOST":
      return {
        verdict: "BLOCKED",
        status: identity.status,
        billable: true,
        passportNo: identity.passportNo,
        reason: "card_blocked",
      };
    default:
      return { verdict: "INVALID", status: identity.status, billable: false, reason: "card_inactive" };
  }
}

/** Persist the per-call log and update monthly usage/billing rollups. */
export async function meterAndLog(args: {
  apiClientId: string | null;
  partnerId: string | null;
  endpoint: string;
  verdict: Verdict | "DENIED";
  httpStatus: number;
  latencyMs: number;
  ip: string | null;
  sigValid: boolean;
  billable: boolean;
  limits: EffectiveLimits | null;
  reason?: string;
  passportNo?: string | null;
}): Promise<number> {
  let priceMinor = 0;
  const period = currentPeriod();

  if (args.billable && args.apiClientId && args.partnerId && args.limits) {
    const existing = await verifyDb.usageCounter.findUnique({
      where: { apiClientId_period: { apiClientId: args.apiClientId, period } },
    });
    const priorBillable = existing?.billableCount ?? 0;
    // Included allowance: the first N billable verifications each period are free.
    priceMinor = priorBillable < args.limits.includedAllowance ? 0 : args.limits.unitPriceMinor;
  }

  try {
    await verifyDb.apiRequestLog.create({
      data: {
        apiClientId: args.apiClientId,
        partnerId: args.partnerId,
        endpoint: args.endpoint,
        mode: "TAP",
        verdict: args.verdict,
        httpStatus: args.httpStatus,
        latencyMs: args.latencyMs,
        ip: args.ip,
        sigValid: args.sigValid,
        billable: args.billable,
        priceMinor,
        reason: args.reason ?? null,
        passportNo: args.passportNo ?? null,
      },
    });

    if (args.apiClientId && args.partnerId) {
      await verifyDb.usageCounter.upsert({
        where: { apiClientId_period: { apiClientId: args.apiClientId, period } },
        create: {
          partnerId: args.partnerId,
          apiClientId: args.apiClientId,
          period,
          count: 1,
          billableCount: args.billable ? 1 : 0,
          amountMinor: priceMinor,
          currency: args.limits?.currency ?? "LKR",
        },
        update: {
          count: { increment: 1 },
          billableCount: { increment: args.billable ? 1 : 0 },
          amountMinor: { increment: priceMinor },
        },
      });
      await verifyDb.apiClient
        .update({ where: { id: args.apiClientId }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
  } catch (err) {
    console.error("verify meter/log failed", err);
  }

  return priceMinor;
}
