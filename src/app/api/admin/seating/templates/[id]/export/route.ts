import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getLayoutTemplate } from "@/lib/seating/template-service";
import { parseLayoutJson } from "@/lib/seating/layout-utils";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tpl = await getLayoutTemplate(params.id);
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const layout = parseLayoutJson(tpl.layoutJson);
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    slug: tpl.slug,
    name: tpl.name,
    description: tpl.description,
    layout,
  });
}
