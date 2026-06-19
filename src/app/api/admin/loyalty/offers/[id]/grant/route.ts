import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  LoyaltyOfferError,
  grantOfferToAllEligible,
  grantOfferToCard,
  listEligibleCardsForOffer,
} from "@/lib/loyalty/offers";
import { db } from "@/lib/db";

const schema = z.object({
  mode: z.enum(["preview", "all", "one"]),
  rfidCardId: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const offer = await db.loyaltyOffer.findUnique({ where: { id: params.id } });
  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  const eligible = await listEligibleCardsForOffer(offer);
  return NextResponse.json({ count: eligible.length, cards: eligible });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid grant request." }, { status: 400 });
  }

  try {
    if (parsed.data.mode === "preview") {
      const offer = await db.loyaltyOffer.findUnique({ where: { id: params.id } });
      if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
      const eligible = await listEligibleCardsForOffer(offer);
      return NextResponse.json({ count: eligible.length, cards: eligible });
    }

    if (parsed.data.mode === "one") {
      if (!parsed.data.rfidCardId) {
        return NextResponse.json({ error: "rfidCardId required." }, { status: 400 });
      }
      const grant = await grantOfferToCard({
        offerId: params.id,
        rfidCardId: parsed.data.rfidCardId,
        grantedById: admin.id,
        note: parsed.data.note,
      });
      await logAudit(admin.id, "CREATE", "LoyaltyOfferGrant", grant.id, { offerId: params.id });
      return NextResponse.json({ ok: true, grant });
    }

    const result = await grantOfferToAllEligible({ offerId: params.id, grantedById: admin.id });
    await logAudit(admin.id, "CREATE", "LoyaltyOfferGrant", params.id, {
      mode: "all",
      eligible: result.eligible,
      granted: result.results.filter((r) => r.ok).length,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LoyaltyOfferError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
