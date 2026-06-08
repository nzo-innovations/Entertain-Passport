import { NextResponse } from "next/server";
import { getVenueDetailBySlug } from "@/lib/venues";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const venue = await getVenueDetailBySlug(params.slug);
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ venue });
}
