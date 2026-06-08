import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["assign", "unassign", "block", "activate", "lost"]),
  email: z.string().trim().email().optional(),
  label: z.string().trim().max(80).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const card = await db.rfidCard.findUnique({ where: { id: params.id } });
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) data.label = parsed.data.label || null;

  switch (parsed.data.action) {
    case "assign": {
      if (!parsed.data.email) return NextResponse.json({ error: "Email required to assign." }, { status: 400 });
      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (!user) return NextResponse.json({ error: "No user with that email." }, { status: 404 });
      data.assignedUserId = user.id;
      data.assignedAt = new Date();
      data.status = "ACTIVE";
      break;
    }
    case "unassign":
      data.assignedUserId = null;
      data.assignedAt = null;
      data.status = "UNASSIGNED";
      break;
    case "block":
      data.status = "BLOCKED";
      break;
    case "lost":
      data.status = "LOST";
      break;
    case "activate":
      if (!card.assignedUserId)
        return NextResponse.json({ error: "Assign the card to a user first." }, { status: 400 });
      data.status = "ACTIVE";
      break;
  }

  const updated = await db.rfidCard.update({ where: { id: params.id }, data });
  await logAudit(admin.id, "UPDATE", "RfidCard", params.id, { action: parsed.data.action });

  return NextResponse.json({ ok: true, card: updated });
}
