import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { buildSeatMapStatus } from "@/lib/seating/seat-hold-service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  const status = await buildSeatMapStatus(params.id, userId);
  if (!status) {
    return NextResponse.json({ seating: null });
  }
  return NextResponse.json({ seating: status });
}
