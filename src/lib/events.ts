import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { ApprovalStatus, EventStatus } from "./types";
import type { EventCardData } from "@/components/events/event-card";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80";

/** Only events approved by super admin and published are visible to customers. */
export const publicEventWhere = {
  status: EventStatus.PUBLISHED,
  approvalStatus: ApprovalStatus.APPROVED,
};

export type EventCardFilter = {
  categorySlug?: string;
  mainCategorySlug?: string;
  subCategorySlug?: string;
  tagSlugs?: string[];
  featured?: boolean;
  search?: string;
  limit?: number;
};

/** Lean card query — only fields needed for listing UI. */
async function fetchEventCards(filter?: EventCardFilter): Promise<EventCardData[]> {
  const events = await db.event.findMany({
    where: {
      ...publicEventWhere,
      ...(filter?.featured ? { featured: true } : {}),
      ...(filter?.categorySlug
        ? {
            OR: [
              { category: { slug: filter.categorySlug } },
              { category: { parent: { slug: filter.categorySlug } } },
            ],
          }
        : {}),
      ...(filter?.mainCategorySlug
        ? {
            OR: [
              { category: { slug: filter.mainCategorySlug, parentId: null } },
              { category: { parent: { slug: filter.mainCategorySlug } } },
            ],
          }
        : {}),
      ...(filter?.subCategorySlug ? { category: { slug: filter.subCategorySlug } } : {}),
      ...(filter?.tagSlugs?.length
        ? {
            AND: filter.tagSlugs.map((slug) => ({
              tags: { some: { tag: { slug } } },
            })),
          }
        : {}),
      ...(filter?.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" as const } },
              { shortDescription: { contains: filter.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      slug: true,
      title: true,
      shortDescription: true,
      startsAt: true,
      featured: true,
      primaryImage: { select: { url: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      category: { select: { name: true } },
      venue: { select: { name: true, city: true } },
      packages: { select: { price: true, qtyTotal: true, qtySold: true }, orderBy: { price: "asc" } },
    },
    orderBy: [{ featured: "desc" }, { startsAt: "asc" }],
    take: filter?.limit ?? 24,
  });

  return events.map((e) => {
    const totalSeats = e.packages.reduce((s, p) => s + p.qtyTotal, 0);
    const soldSeats = e.packages.reduce((s, p) => s + p.qtySold, 0);
    const fromPrice = e.packages[0]?.price ?? 0;
    const img = e.primaryImage?.url ?? e.images[0]?.url ?? FALLBACK_IMG;
    return {
      slug: e.slug,
      title: e.title,
      shortDescription: e.shortDescription,
      primaryImage: img,
      category: e.category.name,
      startsAt: e.startsAt,
      venue: e.venue.name,
      city: e.venue.city,
      fromPrice,
      totalSeats,
      soldSeats,
      featured: e.featured,
    };
  });
}

const cachedEventCards = unstable_cache(
  async (key: string) => fetchEventCards(key === "all" ? undefined : (JSON.parse(key) as EventCardFilter)),
  ["event-cards"],
  { revalidate: 60, tags: ["events"] }
);

export async function getEventCards(filter?: EventCardFilter): Promise<EventCardData[]> {
  const key = filter ? JSON.stringify(filter) : "all";
  return cachedEventCards(key);
}

import { SHOWS_MAIN_SLUGS } from "./category-tags";

async function fetchCategoriesWithCounts() {
  const cats = await db.category.findMany({
    where: { module: "SHOWS", parentId: null, slug: { in: [...SHOWS_MAIN_SLUGS] } },
    select: {
      name: true,
      slug: true,
      iconKey: true,
      children: {
        select: {
          name: true,
          slug: true,
          _count: { select: { events: { where: publicEventWhere } } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      _count: { select: { events: { where: publicEventWhere } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return cats.map((c) => {
    const subCount = c.children.reduce((s, ch) => s + ch._count.events, 0);
    return {
      name: c.name,
      slug: c.slug,
      iconKey: c.iconKey,
      count: c._count.events + subCount,
    };
  });
}

export type ShowsCategoryTreeItem = {
  name: string;
  slug: string;
  iconKey: string | null;
  count: number;
  subs: { name: string; slug: string; count: number }[];
};

async function fetchShowsCategoryTreeWithCounts(): Promise<ShowsCategoryTreeItem[]> {
  const cats = await db.category.findMany({
    where: { module: "SHOWS", parentId: null, slug: { in: [...SHOWS_MAIN_SLUGS] } },
    select: {
      name: true,
      slug: true,
      iconKey: true,
      children: {
        select: {
          name: true,
          slug: true,
          _count: { select: { events: { where: publicEventWhere } } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      _count: { select: { events: { where: publicEventWhere } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return cats.map((c) => {
    const subs = c.children.map((ch) => ({
      name: ch.name,
      slug: ch.slug,
      count: ch._count.events,
    }));
    const subCount = subs.reduce((s, ch) => s + ch.count, 0);
    return {
      name: c.name,
      slug: c.slug,
      iconKey: c.iconKey,
      count: c._count.events + subCount,
      subs,
    };
  });
}

const cachedCategoryTree = unstable_cache(fetchShowsCategoryTreeWithCounts, ["shows-category-tree"], {
  revalidate: 120,
  tags: ["events", "categories"],
});

const cachedCategories = unstable_cache(fetchCategoriesWithCounts, ["event-categories"], {
  revalidate: 120,
  tags: ["events", "categories"],
});

export async function getCategoriesWithCounts() {
  return cachedCategories();
}

export async function getShowsCategoryTreeWithCounts() {
  return cachedCategoryTree();
}

async function fetchEventBySlug(slug: string, includeUnpublished: boolean) {
  const event = await db.event.findFirst({
    where: {
      slug,
      ...(includeUnpublished ? {} : publicEventWhere),
    },
    include: {
      primaryImage: true,
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
      venue: true,
      organization: { select: { id: true, name: true, slug: true } },
      packages: { orderBy: { sortOrder: "asc" } },
      partners: true,
    },
  });
  if (!event) return null;

  const social = event.socialLinksJson ? safeJSON<Record<string, string>>(event.socialLinksJson, {}) : {};

  return {
    ...event,
    socialLinks: social,
    packages: event.packages.map((p) => ({
      ...p,
      perks: safeJSON<string[]>(p.perksJson, []),
    })),
  };
}

const cachedPublicEventBySlug = unstable_cache(
  async (slug: string) => fetchEventBySlug(slug, false),
  ["event-by-slug"],
  { revalidate: 60, tags: ["events"] }
);

export async function getEventBySlug(slug: string, options?: { includeUnpublished?: boolean }) {
  if (options?.includeUnpublished) {
    return fetchEventBySlug(slug, true);
  }
  return cachedPublicEventBySlug(slug);
}

/** Invalidate public event caches after admin approval or publish. */
export function revalidateEventCaches() {
  // Call from admin API routes via revalidateTag('events') when wired.
}

function safeJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Per-request dedupe for hot paths (same render / API handler). */
export const getEventCardsRequest = cache(getEventCards);
