import { PLACES_MAIN_SLUGS } from "./category-tags";
import { db } from "./db";
import { slugify } from "./utils";
import { unstable_cache } from "next/cache";
import { ApprovalStatus, EventStatus, OrgMemberRole, UserRole, VENUE_KIND_LABELS, isCreatorRole } from "./types";
import type { SessionUser } from "./auth";

export const publicVenueWhere = {
  isPublished: true,
  slug: { not: null },
  organizationId: { not: null },
};

export type VenueCardData = {
  slug: string;
  name: string;
  kind: string | null;
  city: string;
  district: string | null;
  coverImageUrl: string | null;
  description: string | null;
  programCount: number;
  upcomingEventCount: number;
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&q=80";

export async function uniqueVenueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || `venue-${Date.now()}`;
  let slug = base;
  for (let i = 1; ; i++) {
    const existing = await db.venue.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
}

export type PlacesFilter = {
  kind?: string;
  mainCategorySlug?: string;
  subCategorySlug?: string;
  tagSlugs?: string[];
  city?: string;
  district?: string;
  search?: string;
  /** Has published weekly / one-off program entries */
  live?: boolean;
  /** Has upcoming approved ticketed events */
  tickets?: boolean;
  sort?: "name" | "programs" | "events";
};

export type PlacesFilterMeta = {
  total: number;
  kinds: { value: string; label: string; count: number }[];
  mains: { slug: string; name: string; count: number }[];
  tags: { slug: string; name: string; count: number }[];
  cities: { city: string; count: number }[];
  districts: { district: string; count: number }[];
};

const upcomingEventWhere = {
  status: EventStatus.PUBLISHED,
  approvalStatus: ApprovalStatus.APPROVED,
  startsAt: { gte: new Date() },
};

export async function getPlacesFilterMeta(active?: {
  city?: string;
  kind?: string;
  mainCategorySlug?: string;
}): Promise<PlacesFilterMeta> {
  const baseWhere = {
    ...publicVenueWhere,
    ...(active?.city ? { city: { equals: active.city, mode: "insensitive" as const } } : {}),
    ...(active?.kind ? { kind: active.kind } : {}),
    ...(active?.mainCategorySlug
      ? {
          OR: [
            { placesMainCategory: { slug: active.mainCategorySlug } },
            { placesSubCategory: { parent: { slug: active.mainCategorySlug } } },
          ],
        }
      : {}),
  };

  const [venues, mains, tags] = await Promise.all([
    db.venue.findMany({
      where: baseWhere,
      select: {
        kind: true,
        city: true,
        district: true,
        placesMainCategoryId: true,
        placesMainCategory: { select: { slug: true, name: true } },
        tags: { select: { tag: { select: { slug: true, name: true } } } },
        _count: {
          select: {
            programs: { where: { isPublished: true } },
            events: { where: upcomingEventWhere },
          },
        },
      },
    }),
    db.category.findMany({
      where: { module: "PLACES", parentId: null, slug: { in: [...PLACES_MAIN_SLUGS] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
    db.tag.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } }),
  ]);

  const kindMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const districtMap = new Map<string, number>();
  const mainMap = new Map<string, number>();
  const tagMap = new Map<string, number>();

  for (const v of venues) {
    const k = v.kind ?? "OTHER";
    kindMap.set(k, (kindMap.get(k) ?? 0) + 1);
    cityMap.set(v.city, (cityMap.get(v.city) ?? 0) + 1);
    if (v.district && (!active?.city || v.city.toLowerCase() === active.city.toLowerCase())) {
      districtMap.set(v.district, (districtMap.get(v.district) ?? 0) + 1);
    }
    if (v.placesMainCategory) {
      mainMap.set(v.placesMainCategory.slug, (mainMap.get(v.placesMainCategory.slug) ?? 0) + 1);
    }
    for (const t of v.tags) {
      tagMap.set(t.tag.slug, (tagMap.get(t.tag.slug) ?? 0) + 1);
    }
  }

  return {
    total: venues.length,
    kinds: Array.from(kindMap.entries())
      .map(([value, count]) => ({
        value,
        label: VENUE_KIND_LABELS[value as keyof typeof VENUE_KIND_LABELS] ?? value,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    mains: mains.map((m) => ({
      slug: m.slug,
      name: m.name,
      count: mainMap.get(m.slug) ?? 0,
    })),
    tags: tags.map((t) => ({
      slug: t.slug,
      name: t.name,
      count: tagMap.get(t.slug) ?? 0,
    })),
    cities: Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
    districts: Array.from(districtMap.entries())
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => a.district.localeCompare(b.district)),
  };
}

export async function getPublishedVenueCards(filter?: PlacesFilter): Promise<VenueCardData[]> {
  const key = filter && Object.keys(filter).length > 0 ? JSON.stringify(filter) : "all";
  return cachedVenueCards(key);
}

async function fetchPublishedVenueCards(filter?: PlacesFilter): Promise<VenueCardData[]> {
  const venues = await db.venue.findMany({
    where: {
      ...publicVenueWhere,
      ...(filter?.kind ? { kind: filter.kind } : {}),
      ...(filter?.mainCategorySlug
        ? {
            OR: [
              { placesMainCategory: { slug: filter.mainCategorySlug } },
              { placesSubCategory: { parent: { slug: filter.mainCategorySlug } } },
            ],
          }
        : {}),
      ...(filter?.subCategorySlug ? { placesSubCategory: { slug: filter.subCategorySlug } } : {}),
      ...(filter?.tagSlugs?.length
        ? {
            AND: filter.tagSlugs.map((slug) => ({
              tags: { some: { tag: { slug } } },
            })),
          }
        : {}),
      ...(filter?.city ? { city: { equals: filter.city, mode: "insensitive" as const } } : {}),
      ...(filter?.district
        ? { district: { equals: filter.district, mode: "insensitive" as const } }
        : {}),
      ...(filter?.live ? { programs: { some: { isPublished: true } } } : {}),
      ...(filter?.tickets ? { events: { some: upcomingEventWhere } } : {}),
      ...(filter?.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" as const } },
              { description: { contains: filter.search, mode: "insensitive" as const } },
              { city: { contains: filter.search, mode: "insensitive" as const } },
              { district: { contains: filter.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      _count: {
        select: {
          programs: { where: { isPublished: true } },
          events: { where: upcomingEventWhere },
        },
      },
    },
    orderBy:
      filter?.sort === "programs"
        ? [{ programs: { _count: "desc" } }, { name: "asc" }]
        : filter?.sort === "events"
        ? [{ events: { _count: "desc" } }, { name: "asc" }]
        : [{ name: "asc" }],
  });

  return venues.map((v) => ({
    slug: v.slug!,
    name: v.name,
    kind: v.kind,
    city: v.city,
    district: v.district,
    coverImageUrl: v.coverImageUrl ?? FALLBACK_COVER,
    description: v.description,
    programCount: v._count.programs,
    upcomingEventCount: v._count.events,
  }));
}

const cachedVenueCards = unstable_cache(
  async (key: string) => fetchPublishedVenueCards(key === "all" ? undefined : (JSON.parse(key) as PlacesFilter)),
  ["venue-cards"],
  { revalidate: 60, tags: ["venues"] }
);

export async function getVenueDetailBySlug(slug: string) {
  const venue = await db.venue.findFirst({
    where: {
      slug,
      isPublished: true,
      organizationId: { not: null },
    },
    include: {
      organization: { select: { id: true, name: true, slug: true, type: true } },
      programs: {
        where: { isPublished: true },
        orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }],
      },
      events: {
        where: {
          status: EventStatus.PUBLISHED,
          approvalStatus: ApprovalStatus.APPROVED,
          startsAt: { gte: new Date() },
        },
        include: {
          primaryImage: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          category: true,
          packages: { orderBy: { price: "asc" }, take: 1 },
        },
        orderBy: { startsAt: "asc" },
        take: 12,
      },
    },
  });
  return venue;
}

export async function getOrgVenueForUser(userId: string) {
  const org = await db.organization.findFirst({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, name: true },
  });
  if (!org) return null;

  const venue = await db.venue.findFirst({
    where: { organizationId: org.id },
    include: {
      programs: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }] },
      _count: { select: { events: true } },
    },
  });

  return { org, venue };
}

export async function canManageVenue(userId: string, venueId: string, userRole?: string) {
  if (userRole === UserRole.SUPER_ADMIN) return true;

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: {
      organization: {
        select: {
          ownerId: true,
          members: { where: { userId }, select: { role: true } },
        },
      },
    },
  });
  if (!venue?.organization) return false;
  if (venue.organization.ownerId === userId) return true;
  const membership = venue.organization.members[0];
  return membership?.role === OrgMemberRole.OWNER || membership?.role === OrgMemberRole.ADMIN;
}

export async function canManageOrgVenue(user: SessionUser) {
  if (!isCreatorRole(user.role) && user.role !== UserRole.SUPER_ADMIN) return false;
  const row = await getOrgVenueForUser(user.id);
  if (!row) return false;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if (user.role === UserRole.BUSINESS_OWNER) return true;
  // Legacy accounts may still have role ORGANIZER with a BUSINESS_OWNER org.
  return row.org.type === "BUSINESS_OWNER";
}

export { FALLBACK_COVER };
