import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { heartbeatSeatHold } from "@/lib/seating/seat-hold-service";
import { SEAT_HOLD_PHASE } from "@/lib/seating/constants";

const schema = z.object({
  phase: z.enum(["SELECTING", "CHECKOUT", "IDLE"]).default("SELECTING"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid heartbeat." }, { status: 400 });
  }

  const seating = await heartbeatSeatHold(
    params.id,
    userId,
    parsed.data.phase ?? SEAT_HOLD_PHASE.SELECTING
  );
  return NextResponse.json({ ok: true, seating });
}
