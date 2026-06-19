import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/utils";

const db = new PrismaClient();

type MainDef = { name: string; slug: string; iconKey?: string; subs?: string[] };

const SHOWS: MainDef[] = [
  {
    name: "Concerts",
    slug: "concerts",
    iconKey: "music",
    subs: ["Classical", "Outdoor Saga", "Tribute Shows"],
  },
  {
    name: "Stage Drama",
    slug: "stage-drama",
    iconKey: "mic-2",
    subs: ["Sinhala", "English"],
  },
  {
    name: "Nightlife",
    slug: "nightlife",
    iconKey: "party-popper",
    subs: ["Club", "Pub", "DJ", "EDM", "Progressive", "Beach Party", "Ladies Nights"],
  },
  {
    name: "Lifestyle",
    slug: "lifestyle",
    iconKey: "star",
    subs: ["Restaurants", "Live Music Restaurants", "Dining", "High Tea"],
  },
  {
    name: "Sports & Games",
    slug: "sports-games",
    iconKey: "disc-3",
    subs: ["Big Match", "Bowling", "Indoor Cricket"],
  },
];

const PLACES: MainDef[] = [
  { name: "Hotels & Resorts", slug: "hotels-resorts", iconKey: "building", subs: ["Star Hotels", "Villas", "Cabana"] },
  { name: "Restaurants", slug: "restaurants", iconKey: "utensils" },
  { name: "Cafés", slug: "cafes", iconKey: "coffee" },
  { name: "Clubs & Pubs", slug: "clubs-pubs", iconKey: "party-popper" },
  { name: "Adventure", slug: "adventure", iconKey: "mountain" },
  { name: "Date Spots", slug: "date-spots", iconKey: "heart" },
  { name: "Day Out", slug: "day-out", iconKey: "sun" },
];

const TAGS = [
  "Live Music",
  "DJ",
  "Dancing",
  "Couple Friendly",
  "Romantic",
  "Family Friendly",
  "Outdoor",
  "Indoor",
  "Rooftop",
  "Beachfront",
  "Fine Dining",
  "Buffet",
  "High Tea",
  "Sports Screening",
  "Kids Friendly",
  "Pet Friendly",
  "Birthday Friendly",
  "Corporate Friendly",
  "Instagrammable",
  "Sunset View",
  "Parking Available",
  "Wheelchair Accessible",
];

async function upsertMain(module: string, main: MainDef, sortOrder: number) {
  const row = await db.category.upsert({
    where: { module_slug: { module, slug: main.slug } },
    create: {
      module,
      name: main.name,
      slug: main.slug,
      iconKey: main.iconKey ?? null,
      sortOrder,
      parentId: null,
    },
    update: {
      name: main.name,
      iconKey: main.iconKey ?? null,
      sortOrder,
    },
  });

  if (main.subs?.length) {
    for (let i = 0; i < main.subs.length; i++) {
      const subName = main.subs[i];
      const subSlug = slugify(subName);
      await db.category.upsert({
        where: { module_slug: { module, slug: subSlug } },
        create: {
          module,
          name: subName,
          slug: subSlug,
          parentId: row.id,
          sortOrder: i,
        },
        update: {
          name: subName,
          parentId: row.id,
          sortOrder: i,
        },
      });
    }
  }
  return row;
}

async function main() {
  const allowedShows = new Set<string>();
  for (const main of SHOWS) {
    allowedShows.add(main.slug);
    for (const sub of main.subs ?? []) allowedShows.add(slugify(sub));
  }
  const allowedPlaces = new Set<string>();
  for (const main of PLACES) {
    allowedPlaces.add(main.slug);
    for (const sub of main.subs ?? []) allowedPlaces.add(slugify(sub));
  }

  for (let i = 0; i < SHOWS.length; i++) {
    await upsertMain("SHOWS", SHOWS[i], i);
  }
  for (let i = 0; i < PLACES.length; i++) {
    await upsertMain("PLACES", PLACES[i], i);
  }

  for (let i = 0; i < TAGS.length; i++) {
    const name = TAGS[i];
    const slug = slugify(name);
    await db.tag.upsert({
      where: { slug },
      create: { name, slug, sortOrder: i },
      update: { name, sortOrder: i },
    });
  }

  // Remove SHOWS/PLACES categories not in the canonical list (skip if still referenced).
  for (const [module, allowed] of [
    ["SHOWS", allowedShows],
    ["PLACES", allowedPlaces],
  ] as const) {
    const stale = await db.category.findMany({
      where: { module, slug: { notIn: [...allowed] } },
      select: { id: true, slug: true, parentId: true },
    });
    for (const row of stale) {
      const [events, venuesMain, venuesSub, orgsMain, orgsSub, children] = await Promise.all([
        db.event.count({ where: { categoryId: row.id } }),
        db.venue.count({ where: { placesMainCategoryId: row.id } }),
        db.venue.count({ where: { placesSubCategoryId: row.id } }),
        db.organization.count({ where: { placesMainCategoryId: row.id } }),
        db.organization.count({ where: { placesSubCategoryId: row.id } }),
        db.category.count({ where: { parentId: row.id } }),
      ]);
      const inUse = events + venuesMain + venuesSub + orgsMain + orgsSub + children;
      if (inUse > 0) {
        console.warn(`[seed-catalog] skip delete ${module}/${row.slug} (${inUse} references)`);
        continue;
      }
      await db.category.delete({ where: { id: row.id } });
      console.log(`[seed-catalog] removed stale ${module}/${row.slug}`);
    }
  }

  // Demote orphaned SHOWS rows incorrectly at main level (parentId null but not in SHOWS mains).
  const showMainSlugs = new Set(SHOWS.map((m) => m.slug));
  const orphanMains = await db.category.findMany({
    where: { module: "SHOWS", parentId: null, slug: { notIn: [...showMainSlugs] } },
  });
  for (const row of orphanMains) {
    const events = await db.event.count({ where: { categoryId: row.id } });
    if (events > 0) {
      console.warn(`[seed-catalog] orphan main ${row.slug} has ${events} events — manual review needed`);
      continue;
    }
    await db.category.delete({ where: { id: row.id } });
    console.log(`[seed-catalog] removed orphan SHOWS main ${row.slug}`);
  }

  console.log("[seed-catalog] SHOWS mains:", SHOWS.length, "PLACES mains:", PLACES.length, "tags:", TAGS.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
