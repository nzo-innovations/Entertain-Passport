import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.adminAlert.delete({ where: { id: params.id } });
  await logAudit(admin.id, "DELETE", "AdminAlert", params.id);

  return NextResponse.json({ ok: true });
}
