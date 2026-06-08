import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageEvent, submitEventForReview } from "@/lib/permissions";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await canManageEvent(session.id, params.id, session.role);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await submitEventForReview(params.id, session.id);
    return NextResponse.json({ ok: true, approvalStatus: "PENDING_REVIEW" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submit failed" },
      { status: 400 }
    );
  }
}
