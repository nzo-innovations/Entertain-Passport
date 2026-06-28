import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { generatePassportBatch } from "@/lib/passport/passport-inventory-service";
import { PASSPORT_BATCH_CARD_TYPES } from "@/lib/passport/types";

const schema = z.object({
  batchCode: z.string().trim().min(2).max(40),
  cardType: z.enum(PASSPORT_BATCH_CARD_TYPES),
  issueYear: z.number().int().min(20).max(99),
  quantity: z.number().int().min(1).max(5000),
  initialStatus: z.enum(["GENERATED", "AVAILABLE"]).optional(),
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
    return NextResponse.json({ error: "Invalid batch parameters." }, { status: 400 });
  }

  try {
    const result = await generatePassportBatch({
      ...parsed.data,
      generatedById: admin.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch generation failed.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
