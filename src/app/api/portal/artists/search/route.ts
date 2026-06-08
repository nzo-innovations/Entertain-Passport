import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrgType } from "@/lib/types";

// Search artists already on the platform (artist + artist-manager orgs).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ artists: [] });

  const artists = await db.organization.findMany({
    where: {
      type: { in: [OrgType.ARTIST, OrgType.ARTIST_MANAGER] },
      name: { contains: q, mode: "insensitive" },
    },
    select: { id: true, name: true, type: true, logoUrl: true },
    take: 10,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ artists });
}
