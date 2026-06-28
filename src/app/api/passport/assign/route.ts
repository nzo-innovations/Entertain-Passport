import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { assignPassportByPrimaryId } from "@/lib/passport/passport-assignment-service";

const schema = z.object({
  publicPassportNumber: z.string().min(10),
  primaryIdType: z.enum(["NIC", "PASSPORT"]),
  primaryIdValue: z.string().min(5),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignment payload." }, { status: 400 });
  }

  try {
    const result = await assignPassportByPrimaryId({ ...parsed.data, actorId: admin.id });
    return NextResponse.json({ ok: true, status: "ASSIGNED", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assignment failed.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
