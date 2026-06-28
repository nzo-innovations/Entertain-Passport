export const CatalogModule = {
  SHOWS: "SHOWS",
  PLACES: "PLACES",
} as const;

export type CatalogModuleName = (typeof CatalogModule)[keyof typeof CatalogModule];

/** Canonical main-category slugs - used to filter DB rows and UI lists. */
export const SHOWS_MAIN_SLUGS = [
  "concerts",
  "stage-drama",
  "nightlife",
  "lifestyle",
  "sports-games",
] as const;

export const PLACES_MAIN_SLUGS = [
  "hotels-resorts",
  "restaurants",
  "cafes",
  "clubs-pubs",
  "adventure",
  "date-spots",
  "day-out",
] as const;

type TagRow = { slug: string; name: string };

/** Tag slugs suggested per main category (reusable for Shows & Places browse/filter UIs). */
const CATEGORY_TAG_SLUGS: Record<CatalogModuleName, Record<string, string[]>> = {
  SHOWS: {
    concerts: [
      "live-music",
      "outdoor",
      "indoor",
      "family-friendly",
      "romantic",
      "couple-friendly",
      "parking-available",
      "wheelchair-accessible",
      "instagrammable",
    ],
    "stage-drama": [
      "family-friendly",
      "couple-friendly",
      "indoor",
      "romantic",
      "parking-available",
      "wheelchair-accessible",
      "corporate-friendly",
    ],
    nightlife: [
      "dj",
      "dancing",
      "live-music",
      "couple-friendly",
      "romantic",
      "outdoor",
      "indoor",
      "rooftop",
      "beachfront",
      "birthday-friendly",
      "corporate-friendly",
      "instagrammable",
      "sunset-view",
      "parking-available",
      "wheelchair-accessible",
    ],
    lifestyle: [
      "fine-dining",
      "buffet",
      "high-tea",
      "live-music",
      "romantic",
      "couple-friendly",
      "family-friendly",
      "rooftop",
      "outdoor",
      "indoor",
      "birthday-friendly",
      "corporate-friendly",
      "parking-available",
      "wheelchair-accessible",
      "instagrammable",
    ],
    "sports-games": [
      "sports-screening",
      "outdoor",
      "indoor",
      "family-friendly",
      "kids-friendly",
      "birthday-friendly",
      "corporate-friendly",
      "parking-available",
      "wheelchair-accessible",
    ],
  },
  PLACES: {
    "hotels-resorts": [
      "romantic",
      "couple-friendly",
      "family-friendly",
      "outdoor",
      "beachfront",
      "sunset-view",
      "parking-available",
      "wheelchair-accessible",
      "pet-friendly",
      "instagrammable",
    ],
    restaurants: [
      "fine-dining",
      "buffet",
      "live-music",
      "romantic",
      "couple-friendly",
      "family-friendly",
      "rooftop",
      "outdoor",
      "indoor",
      "birthday-friendly",
      "corporate-friendly",
      "parking-available",
      "wheelchair-accessible",
    ],
    cafes: [
      "family-friendly",
      "couple-friendly",
      "outdoor",
      "indoor",
      "romantic",
      "parking-available",
      "wheelchair-accessible",
      "instagrammable",
    ],
    "clubs-pubs": [
      "dj",
      "dancing",
      "live-music",
      "couple-friendly",
      "birthday-friendly",
      "corporate-friendly",
      "parking-available",
      "wheelchair-accessible",
      "rooftop",
    ],
    adventure: [
      "outdoor",
      "family-friendly",
      "kids-friendly",
      "couple-friendly",
      "instagrammable",
      "parking-available",
      "pet-friendly",
    ],
    "date-spots": [
      "romantic",
      "couple-friendly",
      "rooftop",
      "beachfront",
      "sunset-view",
      "instagrammable",
      "fine-dining",
      "live-music",
    ],
    "day-out": [
      "family-friendly",
      "kids-friendly",
      "outdoor",
      "pet-friendly",
      "parking-available",
      "instagrammable",
    ],
  },
};

export function getTagsForMainCategory(
  module: CatalogModuleName,
  mainSlug: string,
  allTags: TagRow[]
): TagRow[] {
  const allowed = CATEGORY_TAG_SLUGS[module]?.[mainSlug];
  if (!allowed?.length) return [];
  const bySlug = new Map(allTags.map((t) => [t.slug, t]));
  return allowed.map((slug) => bySlug.get(slug)).filter(Boolean) as TagRow[];
}

export function buildCategoryTagsMap(
  module: CatalogModuleName,
  mainSlugs: string[],
  allTags: TagRow[]
): Record<string, TagRow[]> {
  return Object.fromEntries(
    mainSlugs.map((slug) => [slug, getTagsForMainCategory(module, slug, allTags)])
  );
}
