import { NextResponse } from "next/server";
import { getMainCategories, getSubcategories, getTagsForModule, CatalogModule } from "@/lib/catalog";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const catalogModule =
    url.searchParams.get("module") === "PLACES" ? CatalogModule.PLACES : CatalogModule.SHOWS;
  const [mains, tags] = await Promise.all([
    getMainCategories(catalogModule),
    getTagsForModule(catalogModule),
  ]);
  return NextResponse.json({ module: catalogModule, mains, tags });
}
