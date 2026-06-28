import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { registerNfcCard, assignNfcCard, unassignNfcCard, blockNfcCard, replaceNfcCard } from "@/lib/nfc/nfc-service";

const schema = z.object({
  uid: z.string().trim().min(4).max(64),
  passportNo: z.string().trim().max(40).optional().or(z.literal("")),
  label: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().optional(),
  orderId: z.string().optional(),
  reprogramCardId: z.string().optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid card data." }, { status: 400 });

  try {
    const result = await registerNfcCard({
      cardUid: parsed.data.uid,
      label: parsed.data.label || undefined,
      email: parsed.data.email,
      orderId: parsed.data.orderId,
      reprogramCardId: parsed.data.reprogramCardId,
      programmedById: admin.id,
    });
    return NextResponse.json({
      ok: true,
      card: result.card,
      tagPayload: result.tagPayload,
      cardBlock: result.cardBlock,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
