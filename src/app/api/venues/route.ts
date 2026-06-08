import { NextResponse } from "next/server";
import { getPublishedVenueCards } from "@/lib/venues";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const search = searchParams.get("q") ?? undefined;

  const venues = await getPublishedVenueCards({ kind, city, search });
  return NextResponse.json({ venues });
}
