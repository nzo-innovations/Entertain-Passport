import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrgVenue, getOrgVenueForUser, uniqueVenueSlug } from "@/lib/venues";
import { VenueKind } from "@/lib/types";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional(),
  kind: z.enum([
    VenueKind.PUB,
    VenueKind.RESTAURANT,
    VenueKind.CLUB,
    VenueKind.LOUNGE,
    VenueKind.COFFEE_SHOP,
    VenueKind.DATING_SPOT,
    VenueKind.OTHER,
  ]),
  address: z.string().trim().min(2).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  district: z.string().trim().max(80).optional(),
  province: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  mapUrl: z.string().trim().url().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().url().optional().or(z.literal("")),
  coverImageUrl: z.string().trim().url().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(0).max(100000).optional(),
  isPublished: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Venue management is for company / venue owners." }, { status: 403 });
  }

  const row = await getOrgVenueForUser(session.id);
  return NextResponse.json({ org: row?.org ?? null, venue: row?.venue ?? null });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Venue management is for company / venue owners." }, { status: 403 });
  }

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the venue details and try again." }, { status: 400 });
  }

  const org = await db.organization.findFirst({
    where: { OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }] },
    orderBy: { createdAt: "asc" },
  });
  if (!org || org.type !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "No business owner organization found." }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await db.venue.findFirst({ where: { organizationId: org.id } });
  const slug = existing?.slug ?? (await uniqueVenueSlug(data.name));

  const payload = {
    name: data.name,
    slug,
    description: data.description || null,
    kind: data.kind,
    address: data.address,
    line2: data.line2 || null,
    city: data.city,
    district: data.district || null,
    province: data.province || null,
    country: data.country || "Sri Lanka",
    mapUrl: data.mapUrl || null,
    phone: data.phone || null,
    website: data.website || null,
    coverImageUrl: data.coverImageUrl || null,
    capacity: data.capacity ?? 0,
    isPublished: data.isPublished ?? existing?.isPublished ?? false,
    organizationId: org.id,
  };

  const venue = existing
    ? await db.venue.update({ where: { id: existing.id }, data: payload })
    : await db.venue.create({ data: payload });

  revalidateTag("venues");

  return NextResponse.json({ venue });
}
