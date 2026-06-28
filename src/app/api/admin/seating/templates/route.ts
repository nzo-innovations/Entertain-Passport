import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  createLayoutTemplate,
  listLayoutTemplates,
  seedSystemLayoutTemplates,
} from "@/lib/seating/template-service";
import { parseLayoutJson } from "@/lib/seating/layout-utils";
import type { SeatLayoutDocument } from "@/lib/seating/types";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await listLayoutTemplates();
  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      isSystem: t.isSystem,
      organizationId: t.organizationId,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

const createSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  layout: z.custom<SeatLayoutDocument>(),
});

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template data." }, { status: 400 });
  }

  const tpl = await createLayoutTemplate({
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description,
    layout: parsed.data.layout,
    isSystem: false,
  });

  return NextResponse.json({ ok: true, template: { id: tpl.id, slug: tpl.slug } });
}

/** Ensures system templates exist (idempotent). */
export async function PUT() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await seedSystemLayoutTemplates();
  return NextResponse.json({ ok: true });
}
