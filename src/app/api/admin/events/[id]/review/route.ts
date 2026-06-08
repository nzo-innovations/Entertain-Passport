import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { reviewEvent } from "@/lib/permissions";
import { ApprovalStatus } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireSuperAdmin();
    const { decision, note } = (await req.json()) as {
      decision?: string;
      note?: string;
    };

    if (
      !decision ||
      !(
        [
          ApprovalStatus.APPROVED,
          ApprovalStatus.REJECTED,
          ApprovalStatus.CHANGES_REQUESTED,
        ] as string[]
      ).includes(decision)
    ) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    await reviewEvent(
      params.id,
      decision as "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
      admin.id,
      note
    );

    revalidateTag("events");

    return NextResponse.json({ ok: true, decision });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Review failed";
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
