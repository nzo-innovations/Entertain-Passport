import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { listPassportBatches } from "@/lib/passport/passport-inventory-service";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const batches = await listPassportBatches();
  return NextResponse.json({ batches });
}
