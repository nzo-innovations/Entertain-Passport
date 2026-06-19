import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { listEligibleCardsForOffer, parsePassportAllowList } from "@/lib/loyalty/offers";

const patchSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  pointsGrant: z.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).optional(),
  audienceMode: z.enum(["ALL_CARDS", "FILTERED"]).optional(),
  minTotalUsage: z.number().int().min(0).nullable().optional(),
  maxTotalUsage: z.number().int().min(0).nullable().optional(),
  minLoyaltyPoints: z.number().int().min(0).nullable().optional(),
  maxLoyaltyPoints: z.number().int().min(0).nullable().optional(),
  passportNos: z.array(z.string()).nullable().optional(),
  maxTotalGrants: z.number().int().min(1).nullable().optional(),
  maxGrantsPerUser: z.number().int().min(1).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid offer update." }, { status: 400 });
  }

  const existing = await db.loyaltyOffer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  const d = parsed.data;
  const offer = await db.loyaltyOffer.update({
    where: { id: params.id },
    data: {
      ...(d.title !== undefined ? { title: d.title.trim() } : {}),
      ...(d.description !== undefined ? { description: d.description?.trim() || null } : {}),
      ...(d.pointsGrant !== undefined ? { pointsGrant: d.pointsGrant } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.audienceMode !== undefined ? { audienceMode: d.audienceMode } : {}),
      ...(d.minTotalUsage !== undefined ? { minTotalUsage: d.minTotalUsage } : {}),
      ...(d.maxTotalUsage !== undefined ? { maxTotalUsage: d.maxTotalUsage } : {}),
      ...(d.minLoyaltyPoints !== undefined ? { minLoyaltyPoints: d.minLoyaltyPoints } : {}),
      ...(d.maxLoyaltyPoints !== undefined ? { maxLoyaltyPoints: d.maxLoyaltyPoints } : {}),
      ...(d.passportNos !== undefined
        ? { passportNosJson: d.passportNos?.length ? JSON.stringify(d.passportNos) : null }
        : {}),
      ...(d.maxTotalGrants !== undefined ? { maxTotalGrants: d.maxTotalGrants } : {}),
      ...(d.maxGrantsPerUser !== undefined ? { maxGrantsPerUser: d.maxGrantsPerUser } : {}),
      ...(d.startsAt !== undefined ? { startsAt: d.startsAt ? new Date(d.startsAt) : null } : {}),
      ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
    },
  });

  await logAudit(admin.id, "UPDATE", "LoyaltyOffer", offer.id, d);

  const eligible = await listEligibleCardsForOffer(offer);
  return NextResponse.json({
    offer: { ...offer, passportNos: parsePassportAllowList(offer.passportNosJson), eligibleNow: eligible.length },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.loyaltyOffer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  await db.loyaltyOffer.delete({ where: { id: params.id } });
  await logAudit(admin.id, "DELETE", "LoyaltyOffer", params.id, { title: existing.title });

  return NextResponse.json({ ok: true });
}
