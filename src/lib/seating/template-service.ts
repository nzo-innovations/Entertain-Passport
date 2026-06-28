import { db } from "@/lib/db";
import { SYSTEM_TEMPLATES } from "./templates";
import { serializeLayout } from "./layout-utils";
import type { SeatLayoutDocument } from "./types";

export async function seedSystemLayoutTemplates() {
  for (const tpl of SYSTEM_TEMPLATES) {
    await db.venueLayoutTemplate.upsert({
      where: { slug: tpl.slug },
      create: {
        slug: tpl.slug,
        name: tpl.name,
        description: tpl.description,
        layoutJson: serializeLayout(tpl.layout),
        isSystem: true,
      },
      update: {
        name: tpl.name,
        description: tpl.description,
        layoutJson: serializeLayout(tpl.layout),
        isSystem: true,
      },
    });
  }
}

export async function listLayoutTemplates(opts?: { organizationId?: string | null }) {
  await seedSystemLayoutTemplates();
  if (opts?.organizationId) {
    return db.venueLayoutTemplate.findMany({
      where: {
        OR: [{ isSystem: true }, { organizationId: opts.organizationId }],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }
  return db.venueLayoutTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function getLayoutTemplate(id: string) {
  return db.venueLayoutTemplate.findUnique({ where: { id } });
}

export async function createLayoutTemplate(data: {
  slug: string;
  name: string;
  description?: string;
  layout: SeatLayoutDocument;
  organizationId?: string | null;
  isSystem?: boolean;
}) {
  return db.venueLayoutTemplate.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description,
      layoutJson: serializeLayout(data.layout),
      organizationId: data.organizationId ?? null,
      isSystem: data.isSystem ?? false,
    },
  });
}

export async function updateLayoutTemplate(
  id: string,
  data: Partial<{ name: string; description: string; layout: SeatLayoutDocument; slug: string }>
) {
  return db.venueLayoutTemplate.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.layout !== undefined ? { layoutJson: serializeLayout(data.layout) } : {}),
    },
  });
}

export async function duplicateLayoutTemplate(id: string, newSlug: string, newName: string) {
  const src = await db.venueLayoutTemplate.findUnique({ where: { id } });
  if (!src) throw new Error("Template not found");
  return db.venueLayoutTemplate.create({
    data: {
      slug: newSlug,
      name: newName,
      description: src.description,
      layoutJson: src.layoutJson,
      isSystem: false,
      organizationId: src.organizationId,
    },
  });
}

export async function deleteLayoutTemplate(id: string) {
  const tpl = await db.venueLayoutTemplate.findUnique({ where: { id } });
  if (!tpl) throw new Error("Template not found");
  if (tpl.isSystem) throw new Error("System templates cannot be deleted");
  return db.venueLayoutTemplate.delete({ where: { id } });
}

export function exportTemplateJson(layoutJson: string) {
  return JSON.parse(layoutJson) as SeatLayoutDocument;
}
