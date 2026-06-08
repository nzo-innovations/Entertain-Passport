import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGateStaffAccount, GateStaffServiceError } from "@/lib/gate-staff";
import { isCreatorRole } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
});

async function ownedOrg(userId: string) {
  return db.organization.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreatorRole(session.role)) {
    return NextResponse.json({ error: "Only organization owners can add gate staff." }, { status: 403 });
  }

  const org = await ownedOrg(session.id);
  if (!org) return NextResponse.json({ error: "No organization found." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a name, valid email and a 6+ char password." }, { status: 400 });
  }

  try {
    const member = await createGateStaffAccount({
      organizationId: org.id,
      actorId: session.id,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    if (err instanceof GateStaffServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
