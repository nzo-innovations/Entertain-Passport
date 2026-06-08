import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createGateStaffAccount, GateStaffServiceError, listAllGateStaff } from "@/lib/gate-staff";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
});

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await listAllGateStaff();
  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide organization, name, valid email and a 6+ char password." }, { status: 400 });
  }

  try {
    const member = await createGateStaffAccount({
      ...parsed.data,
      actorId: admin.id,
    });
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    if (err instanceof GateStaffServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
