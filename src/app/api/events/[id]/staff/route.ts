import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageEvent, computeStaffBilling } from "@/lib/permissions";
import { EventStaffRole } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await canManageEvent(session.id, params.id, session.role);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, role } = (await req.json()) as { userId?: string; role?: string };
    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role required" }, { status: 400 });
    }

    const settings = await db.platformSettings.findUnique({ where: { id: "default" } });
    const freeLimit = settings?.freeStaffPerEvent ?? 2;

    const existingCount = await db.eventStaff.count({ where: { eventId: params.id } });
    const isBillable = existingCount >= freeLimit;

    const staff = await db.eventStaff.create({
      data: {
        eventId: params.id,
        userId,
        role: role as string,
        isBillable,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const billing = computeStaffBilling(existingCount + 1, freeLimit, settings?.extraStaffMonthlyFee ?? 1500);

    return NextResponse.json({ ok: true, staff, billing });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add staff" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await canManageEvent(session.id, params.id, session.role);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { staffId } = (await req.json()) as { staffId?: string };
    if (!staffId) return NextResponse.json({ error: "staffId required" }, { status: 400 });

    await db.eventStaff.delete({ where: { id: staffId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove staff" }, { status: 400 });
  }
}
