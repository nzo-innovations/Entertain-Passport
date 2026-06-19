import { NextResponse } from "next/server";
import { getSubcategories } from "@/lib/catalog";

export async function GET(req: Request) {
  const mainId = new URL(req.url).searchParams.get("mainId");
  if (!mainId) return NextResponse.json({ error: "mainId required" }, { status: 400 });
  const subcategories = await getSubcategories(mainId);
  return NextResponse.json({ subcategories });
}
