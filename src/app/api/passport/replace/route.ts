import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { replacePassportInventory } from "@/lib/passport/nfc-programming-service";

const schema = z.object({
  oldPublicPassportNumber: z.string().min(10),
  newPublicPassportNumber: z.string().min(10),
  nfcUid: z.string().trim().min(4).max(64),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid replace request." }, { status: 400 });
  }

  try {
    const result = await replacePassportInventory({ ...parsed.data, actorId: admin.id });
    return NextResponse.json({
      ok: true,
      tagPayload: result.tagPayload,
      programmingId: result.programmingId,
      rfidCardId: result.rfidCardId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Replace failed.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
