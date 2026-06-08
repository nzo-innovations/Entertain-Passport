import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  iconKey: z.string().trim().max(40).optional().or(z.literal("")),
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
    return NextResponse.json({ error: "Invalid category data." }, { status: 400 });
  }

  const slug = slugify(parsed.data.name);
  const exists = await db.category.findFirst({ where: { OR: [{ slug }, { name: parsed.data.name }] } });
  if (exists) {
    return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
  }

  const category = await db.category.create({
    data: { name: parsed.data.name, slug, iconKey: parsed.data.iconKey || null },
  });
  await logAudit(admin.id, "CREATE", "Category", category.id, { name: category.name });

  return NextResponse.json({ ok: true, category });
}
