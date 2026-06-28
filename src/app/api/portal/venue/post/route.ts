import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrgVenue, canManageVenue, getOrgVenueForUser } from "@/lib/venues";

const optionalUrl = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const postSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(10).max(8000),
  imageUrl: optionalUrl,
  detailLink: optionalUrl,
  publishedAt: z.string().optional(),
  isPublished: z.boolean().optional(),
});

async function requireVenue(sessionId: string) {
  const row = await getOrgVenueForUser(sessionId);
  if (!row?.venue) return null;
  return row.venue;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const venue = await requireVenue(session.id);
  if (!venue) return NextResponse.json({ posts: [] });

  const posts = await db.venuePost.findMany({
    where: { venueId: venue.id },
    orderBy: [{ publishedAt: "desc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const venue = await requireVenue(session.id);
  if (!venue) {
    return NextResponse.json({ error: "Save your venue profile first." }, { status: 400 });
  }
  if (!(await canManageVenue(session.id, venue.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the post details." }, { status: 400 });
  }

  const data = parsed.data;
  const post = await db.venuePost.create({
    data: {
      venueId: venue.id,
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl || null,
      detailLink: data.detailLink || null,
      publishedAt: data.publishedAt ? new Date(`${data.publishedAt}T12:00:00`) : new Date(),
      isPublished: data.isPublished ?? true,
    },
  });

  return NextResponse.json({ post });
}
