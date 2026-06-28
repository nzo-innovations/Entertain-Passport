import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { blockPassportInventory } from "@/lib/passport/nfc-programming-service";

const schema = z.object({
  publicPassportNumber: z.string().min(10),
  mode: z.enum(["temporary", "permanent", "damaged"]),
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
    return NextResponse.json({ error: "Invalid block request." }, { status: 400 });
  }

  try {
    const result = await blockPassportInventory({ ...parsed.data, actorId: admin.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Block failed.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
