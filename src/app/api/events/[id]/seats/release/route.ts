import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { releaseUserSeatHold } from "@/lib/seating/seat-hold-service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await releaseUserSeatHold(params.id, userId);
  return NextResponse.json({ ok: true });
}
