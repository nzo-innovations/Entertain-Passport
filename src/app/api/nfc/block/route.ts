import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { blockNfcCard } from "@/lib/nfc/nfc-service";
import type { NfcBlockMode } from "@/lib/nfc/types";

const schema = z.object({
  cardId: z.string().min(1),
  mode: z.enum(["temporary", "permanent"]),
});

/** Temporarily block (BLOCKED) or permanently decline (LOST) an NFC passport. */
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ status: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "DENY", reason: "Invalid block request." }, { status: 400 });
  }

  try {
    const result = await blockNfcCard({
      cardId: parsed.data.cardId,
      mode: parsed.data.mode as NfcBlockMode,
      actorId: admin.id,
    });
    return NextResponse.json({
      status: "OK",
      reason: parsed.data.mode === "permanent" ? "Card permanently declined." : "Card temporarily blocked.",
      card: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Block failed.";
    return NextResponse.json({ status: "DENY", reason: message }, { status: 404 });
  }
}
