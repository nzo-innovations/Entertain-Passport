import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrgVenue, canManageVenue, getOrgVenueForUser } from "@/lib/venues";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await getOrgVenueForUser(session.id);
  if (!row?.venue) return NextResponse.json({ error: "No venue" }, { status: 404 });

  const post = await db.venuePost.findFirst({
    where: { id: params.id, venueId: row.venue.id },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageVenue(session.id, row.venue.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.venuePost.delete({ where: { id: post.id } });
  return NextResponse.json({ ok: true });
}
