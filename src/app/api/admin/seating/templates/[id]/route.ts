import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  deleteLayoutTemplate,
  duplicateLayoutTemplate,
  getLayoutTemplate,
  updateLayoutTemplate,
} from "@/lib/seating/template-service";
import { parseLayoutJson } from "@/lib/seating/layout-utils";
import type { SeatLayoutDocument } from "@/lib/seating/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tpl = await getLayoutTemplate(params.id);
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    template: {
      id: tpl.id,
      slug: tpl.slug,
      name: tpl.name,
      description: tpl.description,
      isSystem: tpl.isSystem,
      layout: parseLayoutJson(tpl.layoutJson),
    },
  });
}

const updateSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(500).optional(),
  layout: z.custom<SeatLayoutDocument>().optional(),
  duplicateAs: z.object({ slug: z.string(), name: z.string() }).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  if (parsed.data.duplicateAs) {
    const copy = await duplicateLayoutTemplate(
      params.id,
      parsed.data.duplicateAs.slug,
      parsed.data.duplicateAs.name
    );
    return NextResponse.json({ ok: true, template: { id: copy.id } });
  }

  const tpl = await updateLayoutTemplate(params.id, parsed.data);
  return NextResponse.json({ ok: true, template: { id: tpl.id } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteLayoutTemplate(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 }
    );
  }
}
