import { cache } from "react";
import { db } from "./db";
import { CatalogModule, PLACES_MAIN_SLUGS, SHOWS_MAIN_SLUGS } from "./category-tags";

export { CatalogModule } from "./category-tags";
export type CatalogModule = import("./category-tags").CatalogModuleName;

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  iconKey: string | null;
  parentId: string | null;
  children: CategoryNode[];
};

export type FlatCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

function buildTree(
  rows: Array<{
    id: string;
    name: string;
    slug: string;
    iconKey: string | null;
    parentId: string | null;
    sortOrder: number;
  }>
): CategoryNode[] {
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(r);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  function walk(parentId: string | null): CategoryNode[] {
    return (byParent.get(parentId) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      iconKey: r.iconKey,
      parentId: r.parentId,
      children: walk(r.id),
    }));
  }
  return walk(null);
}

export const getCategoryTree = cache(async (module: CatalogModule) => {
  const rows = await db.category.findMany({
    where: { module },
    select: { id: true, name: true, slug: true, iconKey: true, parentId: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return buildTree(rows);
});

export const getMainCategories = cache(async (module: CatalogModule) => {
  const allowed = module === CatalogModule.SHOWS ? [...SHOWS_MAIN_SLUGS] : [...PLACES_MAIN_SLUGS];
  return db.category.findMany({
    where: { module, parentId: null, slug: { in: allowed } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, iconKey: true },
  });
});

export async function getSubcategories(mainCategoryId: string) {
  return db.category.findMany({
    where: { parentId: mainCategoryId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

/** Leaf categories for legacy flat selects (sub if exists, else mains without children). */
export async function getShowsLeafCategories(): Promise<FlatCategory[]> {
  const tree = await getCategoryTree(CatalogModule.SHOWS);
  const out: FlatCategory[] = [];
  for (const main of tree) {
    if (main.children.length) {
      for (const sub of main.children) {
        out.push({ id: sub.id, name: `${main.name} · ${sub.name}`, slug: sub.slug, parentId: main.id, parentName: main.name });
      }
    } else {
      out.push({ id: main.id, name: main.name, slug: main.slug, parentId: null, parentName: null });
    }
  }
  return out;
}

export const getTagsForModule = cache(async (module: CatalogModule) => {
  const rows = await db.tag.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.filter((t) => {
    try {
      const mods = JSON.parse(t.modulesJson) as string[];
      return mods.includes(module);
    } catch {
      return true;
    }
  });
});

export function resolveLeafCategoryId(mainId: string, subId: string | null, subs: { id: string }[]): string {
  return subId && subs.some((s) => s.id === subId) ? subId : mainId;
}
