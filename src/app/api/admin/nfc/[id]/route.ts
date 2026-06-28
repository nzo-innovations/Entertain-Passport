import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { assignNfcCard, unassignNfcCard, blockNfcCard, replaceNfcCard, registerNfcCard } from "@/lib/nfc/nfc-service";

const schema = z.object({
  action: z.enum([
    "assign",
    "unassign",
    "block",
    "activate",
    "lost",
    "reprogram",
    "replace",
    "report_lost_temp",
    "report_lost_permanent",
  ]),
  email: z.string().trim().email().optional(),
  label: z.string().trim().max(80).optional(),
  newCardUid: z.string().trim().min(4).max(64).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const card = await db.rfidCard.findUnique({ where: { id: params.id } });
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  try {
    switch (parsed.data.action) {
      case "assign": {
        if (!parsed.data.email) return NextResponse.json({ error: "Email required to assign." }, { status: 400 });
        await assignNfcCard(params.id, parsed.data.email, admin.id);
        break;
      }
      case "unassign":
        await unassignNfcCard(params.id, admin.id);
        break;
      case "block":
      case "report_lost_temp":
        await blockNfcCard({ cardId: params.id, mode: "temporary", actorId: admin.id });
        break;
      case "lost":
      case "report_lost_permanent":
        await blockNfcCard({ cardId: params.id, mode: "permanent", actorId: admin.id });
        break;
      case "activate": {
        if (!card.assignedUserId) {
          return NextResponse.json({ error: "Assign the card to a user first." }, { status: 400 });
        }
        await db.rfidCard.update({ where: { id: params.id }, data: { status: "ACTIVE" } });
        break;
      }
      case "reprogram": {
        if (!parsed.data.newCardUid) {
          return NextResponse.json({ error: "newCardUid required to reprogram." }, { status: 400 });
        }
        const reprogrammed = await registerNfcCard({
          cardUid: parsed.data.newCardUid,
          label: parsed.data.label ?? card.label ?? undefined,
          reprogramCardId: params.id,
          userId: card.assignedUserId ?? undefined,
          programmedById: admin.id,
        });
        return NextResponse.json({ ok: true, card: reprogrammed.card, tagPayload: reprogrammed.tagPayload });
      }
      case "replace": {
        if (!parsed.data.newCardUid) {
          return NextResponse.json({ error: "newCardUid required to replace." }, { status: 400 });
        }
        const replaced = await replaceNfcCard({
          oldCardId: params.id,
          newCardUid: parsed.data.newCardUid,
          label: parsed.data.label,
          actorId: admin.id,
        });
        return NextResponse.json({
          ok: true,
          card: replaced.card,
          tagPayload: replaced.tagPayload,
          transferredTickets: replaced.transferredTickets,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await db.rfidCard.findUnique({ where: { id: params.id } });
  await logAudit(admin.id, "UPDATE", "RfidCard", params.id, { action: parsed.data.action });

  return NextResponse.json({ ok: true, card: updated });
}
