import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

const schema = z.object({ name: z.string().trim().min(2).max(60) });

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tag." }, { status: 400 });

  const slug = slugify(parsed.data.name);
  const tag = await db.tag.upsert({
    where: { slug },
    create: { name: parsed.data.name, slug },
    update: { name: parsed.data.name },
  });
  await logAudit(admin.id, "CREATE", "Tag", tag.id, { name: tag.name });
  return NextResponse.json({ ok: true, tag });
}
