import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getNfcAnalyticsSummary } from "@/lib/nfc/analytics";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const analytics = await getNfcAnalyticsSummary();
  return NextResponse.json(analytics);
}
