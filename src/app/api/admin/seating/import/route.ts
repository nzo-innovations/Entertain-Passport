import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createLayoutTemplate } from "@/lib/seating/template-service";
import type { SeatLayoutDocument } from "@/lib/seating/types";

const schema = z.object({
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

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import payload." }, { status: 400 });
  }

  if (parsed.data.layout.version !== 1) {
    return NextResponse.json({ error: "Unsupported layout version." }, { status: 400 });
  }

  const tpl = await createLayoutTemplate({
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description,
    layout: parsed.data.layout,
  });

  return NextResponse.json({ ok: true, template: { id: tpl.id, slug: tpl.slug } });
}
