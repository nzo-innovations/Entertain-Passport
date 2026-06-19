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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const existing = await db.category.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const slug = slugify(parsed.data.name);
  const clash = await db.category.findFirst({
    where: { module: existing.module, slug, NOT: { id: params.id } },
  });
  if (clash) {
    return NextResponse.json({ error: "Another category already uses that name." }, { status: 409 });
  }

  const category = await db.category.update({
    where: { id: params.id },
    data: { name: parsed.data.name, slug, iconKey: parsed.data.iconKey || null },
  });
  await logAudit(admin.id, "UPDATE", "Category", category.id, { name: category.name });

  return NextResponse.json({ ok: true, category });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventCount = await db.event.count({ where: { categoryId: params.id } });
  const venueCount = await db.venue.count({
    where: { OR: [{ placesMainCategoryId: params.id }, { placesSubCategoryId: params.id }] },
  });
  const childCount = await db.category.count({ where: { parentId: params.id } });
  if (eventCount > 0 || venueCount > 0 || childCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: in use by ${eventCount} event(s), ${venueCount} venue(s), ${childCount} subcategory(ies).`,
      },
      { status: 409 }
    );
  }

  await db.category.delete({ where: { id: params.id } });
  await logAudit(admin.id, "DELETE", "Category", params.id);

  return NextResponse.json({ ok: true });
}
