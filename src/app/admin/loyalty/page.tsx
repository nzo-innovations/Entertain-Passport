import { db } from "@/lib/db";
import { getLoyaltySettings } from "@/lib/loyalty/config";
import { listEligibleCardsForOffer, parsePassportAllowList } from "@/lib/loyalty/offers";
import { LoyaltyOfferStatus } from "@/lib/types";
import { toMajor } from "@/lib/money";
import { LoyaltyManager } from "@/components/admin/loyalty-manager";

export const dynamic = "force-dynamic";

export default async function AdminLoyaltyPage() {
  const [settings, offers] = await Promise.all([
    getLoyaltySettings(),
    db.loyaltyOffer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { grants: true } } },
    }),
  ]);

  const enriched = await Promise.all(
    offers.map(async (offer) => {
      const eligible =
        offer.status === LoyaltyOfferStatus.ACTIVE ? await listEligibleCardsForOffer(offer) : [];
      return {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        pointsGrant: offer.pointsGrant,
        status: offer.status,
        audienceMode: offer.audienceMode,
        minTotalUsage: offer.minTotalUsage,
        maxTotalUsage: offer.maxTotalUsage,
        minLoyaltyPoints: offer.minLoyaltyPoints,
        maxLoyaltyPoints: offer.maxLoyaltyPoints,
        grantsCount: offer.grantsCount,
        grantCount: offer._count.grants,
        eligibleNow: eligible.length,
        passportNos: parsePassportAllowList(offer.passportNosJson),
      };
    })
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Loyalty &amp; rewards</h1>
        <p className="text-sm text-muted-foreground">
          Configure earn rules, create targeted offers, and grant bonus points based on Entertain Passport
          usage across our platform and partner verification taps.
        </p>
      </header>

      <LoyaltyManager
        initialSettings={{
          loyaltyEnabled: settings.loyaltyEnabled,
          loyaltyRequiresPassport: settings.loyaltyRequiresPassport,
          loyaltySpendMajorPerPoint: toMajor(settings.loyaltyMinorPerPoint),
        }}
        initialOffers={enriched}
      />
    </div>
  );
}
