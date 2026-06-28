import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { listPassportInventory } from "@/lib/passport/passport-inventory-service";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const result = await listPassportInventory({
    status: url.searchParams.get("status") ?? undefined,
    batchId: url.searchParams.get("batchId") ?? undefined,
    cardType: url.searchParams.get("cardType") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1"),
    limit: Number(url.searchParams.get("limit") ?? "50"),
  });

  return NextResponse.json(result);
}
