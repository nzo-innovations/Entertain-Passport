import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  exportPrintBatch,
  markBatchAvailable,
} from "@/lib/passport/passport-inventory-service";

const schema = z.object({
  batchId: z.string().min(1),
  markAvailable: z.boolean().optional(),
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
    return NextResponse.json({ error: "batchId required." }, { status: 400 });
  }

  try {
    if (parsed.data.markAvailable) {
      await markBatchAvailable(parsed.data.batchId, admin.id);
    }
    const csv = await exportPrintBatch(parsed.data.batchId);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="passport-batch-${parsed.data.batchId}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
