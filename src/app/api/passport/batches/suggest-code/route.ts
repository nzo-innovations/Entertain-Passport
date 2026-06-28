import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestPassportBatchCode } from "@/lib/passport/batch-code-suggest";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.passportBatch.findMany({ select: { batchCode: true } });
  const suggestion = await suggestPassportBatchCode(existing.map((b) => b.batchCode));

  return NextResponse.json(suggestion);
}
