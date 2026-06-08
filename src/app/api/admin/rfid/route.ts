import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePassportNo } from "@/lib/rfid";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  uid: z.string().trim().min(4).max(64),
  passportNo: z.string().trim().max(40).optional().or(z.literal("")),
  label: z.string().trim().max(80).optional().or(z.literal("")),
});

// Program a new NFC/RFID Entertain Passport card.
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid card data." }, { status: 400 });

  const uidExists = await db.rfidCard.findUnique({ where: { uid: parsed.data.uid } });
  if (uidExists) return NextResponse.json({ error: "That card UID is already programmed." }, { status: 409 });

  let passportNo = parsed.data.passportNo?.trim() || generatePassportNo();
  // ensure uniqueness
  for (let i = 0; i < 5 && (await db.rfidCard.findUnique({ where: { passportNo } })); i++) {
    passportNo = generatePassportNo();
  }

  const card = await db.rfidCard.create({
    data: {
      uid: parsed.data.uid,
      passportNo,
      label: parsed.data.label || null,
      status: "UNASSIGNED",
      programmedById: admin.id,
    },
  });
  await logAudit(admin.id, "CREATE", "RfidCard", card.id, { uid: card.uid, passportNo });

  return NextResponse.json({ ok: true, card });
}
