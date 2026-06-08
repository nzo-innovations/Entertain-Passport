import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { deleteGateStaffAccount, GateStaffServiceError, updateGateStaffAccount } from "@/lib/gate-staff";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(6).max(72).optional(),
});

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  try {
    await updateGateStaffAccount({
      userId: params.userId,
      name: parsed.data.name,
      password: parsed.data.password,
      actorId: admin.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateStaffServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteGateStaffAccount({
      userId: params.userId,
      actorId: admin.id,
      removeEntireAccount: true,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateStaffServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
