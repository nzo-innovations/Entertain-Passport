import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  eventId: z.string().min(1),
  thresholdType: z.enum(["TICKETS_SOLD", "PERCENT_SOLD", "REVENUE"]),
  thresholdValue: z.number().int().min(1),
  channel: z.enum(["email", "sms"]).default("email"),
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
    return NextResponse.json({ error: "Invalid alert data." }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const alert = await db.adminAlert.create({ data: parsed.data });
  await logAudit(admin.id, "CREATE", "AdminAlert", alert.id, parsed.data);

  return NextResponse.json({ ok: true, alert });
}
