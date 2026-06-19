import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  module: z.enum(["SHOWS", "PLACES"]).default("SHOWS"),
  parentId: z.string().nullable().optional(),
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
  const exists = await db.category.findUnique({
    where: { module_slug: { module: parsed.data.module, slug } },
  });
  if (exists) {
    return NextResponse.json({ error: "A category with that slug already exists in this module." }, { status: 409 });
  }

  if (parsed.data.parentId) {
    const parent = await db.category.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.module !== parsed.data.module) {
      return NextResponse.json({ error: "Invalid parent category." }, { status: 400 });
    }
  }

  const category = await db.category.create({
    data: {
      name: parsed.data.name,
      slug,
      module: parsed.data.module,
      parentId: parsed.data.parentId || null,
      iconKey: parsed.data.iconKey || null,
    },
  });
  await logAudit(admin.id, "CREATE", "Category", category.id, { name: category.name, module: category.module });

  return NextResponse.json({ ok: true, category });
}
