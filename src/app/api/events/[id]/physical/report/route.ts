import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import {
  getPhysicalReport,
  getRemainingVsSold,
  PhysicalTicketError,
} from "@/lib/physical-tickets";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Income reports are restricted to event managers / org admins / Super Admin.
  if (!(await canManageEvent(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [report, breakdown] = await Promise.all([
      getPhysicalReport(params.id),
      getRemainingVsSold(params.id),
    ]);
    return NextResponse.json({ report, breakdown });
  } catch (err) {
    if (err instanceof PhysicalTicketError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't build the report." }, { status: 500 });
  }
}
