import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { searchCardsWithUsage } from "@/lib/loyalty/usage";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const cards = await searchCardsWithUsage(q);
  return NextResponse.json({ cards });
}
