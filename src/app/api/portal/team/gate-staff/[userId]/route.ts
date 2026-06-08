import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteGateStaffAccount, GateStaffServiceError, updateGateStaffAccount } from "@/lib/gate-staff";
import { isCreatorRole } from "@/lib/types";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(6).max(72).optional(),
});

async function ownedOrg(userId: string) {
  return db.organization.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
}

async function guard(sessionId: string, role: string | undefined, targetUserId: string) {
  if (!isCreatorRole(role)) return null;
  const org = await ownedOrg(sessionId);
  if (!org) return null;
  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: targetUserId } },
  });
  if (!member) return null;
  return org;
}

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await guard(session.id, session.role, params.userId);
  if (!org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  try {
    await updateGateStaffAccount({
      userId: params.userId,
      name: parsed.data.name,
      password: parsed.data.password,
      actorId: session.id,
      orgId: org.id,
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await guard(session.id, session.role, params.userId);
  if (!org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await deleteGateStaffAccount({
      userId: params.userId,
      organizationId: org.id,
      actorId: session.id,
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
