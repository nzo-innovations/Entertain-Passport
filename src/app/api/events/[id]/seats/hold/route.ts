import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { holdSeatsForUser, SeatHoldError } from "@/lib/seating/seat-hold-service";
import { SEAT_HOLD_PHASE } from "@/lib/seating/constants";

const schema = z.object({
  seatExternalIds: z.array(z.string().min(1)).min(1),
  phase: z.enum(["SELECTING", "CHECKOUT", "IDLE"]).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to select seats." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid seat selection." }, { status: 400 });
  }

  try {
    const seating = await holdSeatsForUser(
      params.id,
      userId,
      parsed.data.seatExternalIds,
      parsed.data.phase ?? SEAT_HOLD_PHASE.SELECTING
    );
    return NextResponse.json({ ok: true, seating });
  } catch (err) {
    if (err instanceof SeatHoldError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("Seat hold failed", err);
    return NextResponse.json({ error: "Could not hold seats." }, { status: 500 });
  }
}
