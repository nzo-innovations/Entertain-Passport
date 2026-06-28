import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { replaceNfcCard } from "@/lib/nfc/nfc-service";

const schema = z.object({
  oldCardId: z.string().min(1),
  newCardUid: z.string().trim().min(4).max(64),
  label: z.string().trim().max(80).optional(),
});

/** Mark old card LOST, issue new passportId + tag, transfer tickets. */
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ status: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "DENY", reason: "Invalid replace request." }, { status: 400 });
  }

  try {
    const result = await replaceNfcCard({
      oldCardId: parsed.data.oldCardId,
      newCardUid: parsed.data.newCardUid,
      label: parsed.data.label,
      actorId: admin.id,
    });
    return NextResponse.json({
      status: "OK",
      reason: "Replacement card issued; tickets preserved in backend.",
      card: result.card,
      tagPayload: result.tagPayload,
      cardBlock: result.cardBlock,
      transferredTickets: result.transferredTickets,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Replace failed.";
    return NextResponse.json({ status: "DENY", reason: message }, { status: 409 });
  }
}
