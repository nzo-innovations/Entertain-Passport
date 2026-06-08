import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageEvent } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const postSchema = z.object({ organizationId: z.string().min(1) });
const delSchema = z.object({ eventArtistId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageEvent(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

  const artist = await db.organization.findUnique({ where: { id: parsed.data.organizationId } });
  if (!artist) return NextResponse.json({ error: "Artist not found." }, { status: 404 });

  const link = await db.eventArtist.upsert({
    where: { eventId_organizationId: { eventId: params.id, organizationId: artist.id } },
    create: { eventId: params.id, organizationId: artist.id },
    update: {},
  });
  await logAudit(session.id, "ADD_ARTIST", "Event", params.id, { artistId: artist.id });

  return NextResponse.json({ ok: true, artist: { eventArtistId: link.id, id: artist.id, name: artist.name } });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageEvent(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = delSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "eventArtistId required" }, { status: 400 });

  await db.eventArtist.delete({ where: { id: parsed.data.eventArtistId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
