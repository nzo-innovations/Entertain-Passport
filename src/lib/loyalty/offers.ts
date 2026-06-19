import type { LoyaltyOffer } from "@prisma/client";
import { db } from "@/lib/db";
import { LoyaltyOfferStatus } from "@/lib/types";
import { type CardUsageStats, getCardUsageStats, listActiveCardUsageStats } from "./usage";

export class LoyaltyOfferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoyaltyOfferError";
  }
}

export function parsePassportAllowList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function offerIsLive(offer: LoyaltyOffer, now = new Date()): boolean {
  if (offer.status !== LoyaltyOfferStatus.ACTIVE) return false;
  if (offer.startsAt && offer.startsAt > now) return false;
  if (offer.endsAt && offer.endsAt < now) return false;
  if (offer.maxTotalGrants != null && offer.grantsCount >= offer.maxTotalGrants) return false;
  return true;
}

/** Whether a card profile matches an offer's audience + usage/points filters. */
export function cardMatchesOffer(card: CardUsageStats, offer: LoyaltyOffer): boolean {
  if (card.cardStatus !== "ACTIVE" || !card.userId) return false;

  const allowList = parsePassportAllowList(offer.passportNosJson);
  if (allowList.length > 0 && !allowList.includes(card.passportNo)) return false;

  if (offer.audienceMode === "FILTERED" || offer.minTotalUsage != null || offer.maxTotalUsage != null) {
    if (offer.minTotalUsage != null && card.totalUsage < offer.minTotalUsage) return false;
    if (offer.maxTotalUsage != null && card.totalUsage > offer.maxTotalUsage) return false;
  }

  if (offer.minLoyaltyPoints != null && card.loyaltyPoints < offer.minLoyaltyPoints) return false;
  if (offer.maxLoyaltyPoints != null && card.loyaltyPoints > offer.maxLoyaltyPoints) return false;

  return true;
}

export async function listEligibleCardsForOffer(offer: LoyaltyOffer): Promise<CardUsageStats[]> {
  const pool =
    offer.audienceMode === "ALL_CARDS" && !offer.passportNosJson
      ? await listActiveCardUsageStats()
      : await listActiveCardUsageStats();

  return pool.filter((c) => cardMatchesOffer(c, offer));
}

export async function grantOfferToCard(args: {
  offerId: string;
  rfidCardId: string;
  grantedById: string;
  note?: string;
}) {
  const offer = await db.loyaltyOffer.findUnique({ where: { id: args.offerId } });
  if (!offer) throw new LoyaltyOfferError("Offer not found.");
  if (!offerIsLive(offer)) throw new LoyaltyOfferError("Offer is not active or has expired.");

  const card = await db.rfidCard.findUnique({
    where: { id: args.rfidCardId },
    include: { assignedUser: { select: { id: true, loyaltyPoints: true } } },
  });
  if (!card?.assignedUserId) throw new LoyaltyOfferError("Card is not assigned to a member.");
  if (card.status !== "ACTIVE") throw new LoyaltyOfferError("Card is not active.");

  const usage = await getCardUsageStats(card.passportNo);
  if (!usage || !cardMatchesOffer(usage, offer)) {
    throw new LoyaltyOfferError("This card does not match the offer eligibility rules.");
  }

  if (offer.maxGrantsPerUser != null) {
    const prior = await db.loyaltyOfferGrant.count({
      where: { offerId: offer.id, userId: card.assignedUserId },
    });
    if (prior >= offer.maxGrantsPerUser) {
      throw new LoyaltyOfferError("This member has already received this offer the maximum number of times.");
    }
  }

  return db.$transaction(async (tx) => {
    const fresh = await tx.loyaltyOffer.findUnique({ where: { id: offer.id } });
    if (!fresh || !offerIsLive(fresh)) throw new LoyaltyOfferError("Offer is no longer available.");
    if (fresh.maxTotalGrants != null && fresh.grantsCount >= fresh.maxTotalGrants) {
      throw new LoyaltyOfferError("Offer grant limit reached.");
    }

    const grant = await tx.loyaltyOfferGrant.create({
      data: {
        offerId: fresh.id,
        userId: card.assignedUserId!,
        rfidCardId: card.id,
        pointsGranted: fresh.pointsGrant,
        note: args.note ?? null,
        grantedById: args.grantedById,
      },
    });

    if (fresh.pointsGrant > 0) {
      await tx.loyaltyEntry.create({
        data: {
          userId: card.assignedUserId!,
          delta: fresh.pointsGrant,
          reason: `Offer: ${fresh.title}`,
          refId: grant.id,
        },
      });
      await tx.user.update({
        where: { id: card.assignedUserId! },
        data: { loyaltyPoints: { increment: fresh.pointsGrant } },
      });
    }

    await tx.loyaltyOffer.update({
      where: { id: fresh.id },
      data: { grantsCount: { increment: 1 } },
    });

    return grant;
  });
}

/** Grant an offer to every currently eligible active passport. */
export async function grantOfferToAllEligible(args: { offerId: string; grantedById: string }) {
  const offer = await db.loyaltyOffer.findUnique({ where: { id: args.offerId } });
  if (!offer) throw new LoyaltyOfferError("Offer not found.");
  if (!offerIsLive(offer)) throw new LoyaltyOfferError("Offer is not active.");

  const eligible = await listEligibleCardsForOffer(offer);
  const results: { passportNo: string; ok: boolean; error?: string }[] = [];

  for (const card of eligible) {
    try {
      await grantOfferToCard({
        offerId: args.offerId,
        rfidCardId: card.rfidCardId,
        grantedById: args.grantedById,
      });
      results.push({ passportNo: card.passportNo, ok: true });
    } catch (err) {
      results.push({
        passportNo: card.passportNo,
        ok: false,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return { eligible: eligible.length, results };
}

/** Manual loyalty point adjustment by Super Admin. */
export async function adjustLoyaltyPoints(args: {
  userId: string;
  delta: number;
  reason: string;
  grantedById: string;
}) {
  if (!args.reason.trim()) throw new LoyaltyOfferError("Reason is required.");
  if (args.delta === 0) throw new LoyaltyOfferError("Delta must be non-zero.");

  const user = await db.user.findUnique({ where: { id: args.userId }, select: { id: true, loyaltyPoints: true } });
  if (!user) throw new LoyaltyOfferError("User not found.");
  if (user.loyaltyPoints + args.delta < 0) {
    throw new LoyaltyOfferError("Adjustment would make balance negative.");
  }

  return db.$transaction(async (tx) => {
    const entry = await tx.loyaltyEntry.create({
      data: {
        userId: args.userId,
        delta: args.delta,
        reason: args.reason.trim(),
        refId: args.grantedById,
      },
    });
    await tx.user.update({
      where: { id: args.userId },
      data: { loyaltyPoints: { increment: args.delta } },
    });
    return entry;
  });
}
