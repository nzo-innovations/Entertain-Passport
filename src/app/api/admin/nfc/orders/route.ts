import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { listPendingPassportOrders } from "@/lib/nfc/analytics";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await listPendingPassportOrders();
  return NextResponse.json({ orders });
}
