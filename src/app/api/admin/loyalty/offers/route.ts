import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { listEligibleCardsForOffer, parsePassportAllowList } from "@/lib/loyalty/offers";
import { LoyaltyOfferStatus } from "@/lib/types";

const offerSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  pointsGrant: z.number().int().min(0).max(1_000_000),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).optional(),
  audienceMode: z.enum(["ALL_CARDS", "FILTERED"]).default("ALL_CARDS"),
  minTotalUsage: z.number().int().min(0).nullable().optional(),
  maxTotalUsage: z.number().int().min(0).nullable().optional(),
  minLoyaltyPoints: z.number().int().min(0).nullable().optional(),
  maxLoyaltyPoints: z.number().int().min(0).nullable().optional(),
  passportNos: z.array(z.string()).optional(),
  maxTotalGrants: z.number().int().min(1).nullable().optional(),
  maxGrantsPerUser: z.number().int().min(1).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

function serializeOffer(offer: Awaited<ReturnType<typeof db.loyaltyOffer.findFirst>> & object) {
  return {
    ...offer,
    passportNos: parsePassportAllowList(offer.passportNosJson),
  };
}

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const offers = await db.loyaltyOffer.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { grants: true } } },
  });

  const enriched = await Promise.all(
    offers.map(async (offer) => {
      const eligible = offer.status === LoyaltyOfferStatus.ACTIVE ? await listEligibleCardsForOffer(offer) : [];
      return {
        ...serializeOffer(offer),
        grantCount: offer._count.grants,
        eligibleNow: eligible.length,
      };
    })
  );

  return NextResponse.json({ offers: enriched });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = offerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid offer." }, { status: 400 });
  }

  const data = parsed.data;
  const offer = await db.loyaltyOffer.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      pointsGrant: data.pointsGrant,
      status: data.status ?? LoyaltyOfferStatus.DRAFT,
      audienceMode: data.audienceMode,
      minTotalUsage: data.minTotalUsage ?? null,
      maxTotalUsage: data.maxTotalUsage ?? null,
      minLoyaltyPoints: data.minLoyaltyPoints ?? null,
      maxLoyaltyPoints: data.maxLoyaltyPoints ?? null,
      passportNosJson: data.passportNos?.length ? JSON.stringify(data.passportNos) : null,
      maxTotalGrants: data.maxTotalGrants ?? null,
      maxGrantsPerUser: data.maxGrantsPerUser ?? 1,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      createdById: admin.id,
    },
  });

  await logAudit(admin.id, "CREATE", "LoyaltyOffer", offer.id, { title: offer.title });

  const eligible =
    offer.status === LoyaltyOfferStatus.ACTIVE ? (await listEligibleCardsForOffer(offer)).length : 0;

  return NextResponse.json({ offer: { ...serializeOffer(offer), eligibleNow: eligible } }, { status: 201 });
}
