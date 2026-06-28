import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { resetPassportProgramming } from "@/lib/passport/nfc-programming-service";

const schema = z.object({
  publicPassportNumber: z.string().min(10),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ status: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "DENY", reason: "Invalid reset payload." }, { status: 400 });
  }

  try {
    const result = await resetPassportProgramming({
      ...parsed.data,
      actorId: admin.id,
    });
    return NextResponse.json({
      ...result,
      status: "OK",
      reason: "Programming reset - card is ASSIGNED again. Re-program when ready.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed.";
    return NextResponse.json({ status: "DENY", reason: message }, { status: 409 });
  }
}
