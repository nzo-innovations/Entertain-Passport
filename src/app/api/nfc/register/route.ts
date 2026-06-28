import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { registerNfcCard } from "@/lib/nfc/nfc-service";

const schema = z.object({
  cardUid: z.string().trim().min(4).max(64),
  label: z.string().trim().max(80).optional(),
  email: z.string().trim().email().optional(),
  userId: z.string().optional(),
  orderId: z.string().optional(),
  reprogramCardId: z.string().optional(),
});

/** Program NFC tag with secure HMAC-signed identity payload. Super Admin only. */
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ status: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "DENY", reason: "Invalid registration payload." }, { status: 400 });
  }

  try {
    const result = await registerNfcCard({
      ...parsed.data,
      programmedById: admin.id,
    });
    return NextResponse.json({
      status: "OK",
      reason: "NFC passport registered.",
      card: result.card,
      tagPayload: result.tagPayload,
      cardBlock: result.cardBlock,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ status: "DENY", reason: message }, { status: 409 });
  }
}
