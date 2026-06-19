import { Suspense } from "react";
import { FilterBar } from "@/components/events/filter-bar";
import { EventGrid } from "@/components/events/event-grid";
import { getShowsCategoryTreeWithCounts, getEventCards, type EventCardFilter } from "@/lib/events";
import { getTagsForModule, CatalogModule } from "@/lib/catalog";
import { buildCategoryTagsMap, SHOWS_MAIN_SLUGS } from "@/lib/category-tags";

export const revalidate = 60;

function parseFilters(searchParams?: Record<string, string | undefined>): EventCardFilter {
  const tagSlugs = searchParams?.tags?.split(",").filter(Boolean);
  return {
    categorySlug: searchParams?.category,
    mainCategorySlug: searchParams?.main ?? searchParams?.category,
    subCategorySlug: searchParams?.sub,
    tagSlugs: tagSlugs?.length ? tagSlugs : undefined,
    search: searchParams?.q,
    limit: 60,
  };
}

export default async function EventsBrowsePage({
  searchParams,
}: {
  searchParams?: { category?: string; main?: string; sub?: string; tags?: string; q?: string };
}) {
  const filters = parseFilters(searchParams);
  const [events, categoryTree, allTags] = await Promise.all([
    getEventCards(filters),
    getShowsCategoryTreeWithCounts(),
    getTagsForModule(CatalogModule.SHOWS),
  ]);

  const tagRows = allTags.map((t) => ({ slug: t.slug, name: t.name }));
  const categoryTags = buildCategoryTagsMap(CatalogModule.SHOWS, [...SHOWS_MAIN_SLUGS], tagRows);

  const mainSlug = searchParams?.main ?? searchParams?.category;
  const main = categoryTree.find((c) => c.slug === mainSlug);
  const sub = main?.subs.find((s) => s.slug === searchParams?.sub);

  const heading = searchParams?.q
    ? `Results for \u201c${searchParams.q}\u201d`
    : sub
    ? `${main?.name} · ${sub.name}`
    : main
    ? main.name
    : "All events";

  return (
    <div className="container space-y-8 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Discover</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{heading}</h1>
        <p className="text-muted-foreground">
          {events.length} {events.length === 1 ? "event" : "events"} matching your selection.
        </p>
      </header>

      <Suspense fallback={<div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />}>
        <FilterBar categoryTree={categoryTree} categoryTags={categoryTags} />
      </Suspense>

      <EventGrid
        events={events}
        emptyState={
          <div className="space-y-2">
            <p className="text-base font-medium">No events match those filters yet.</p>
            <p>Try clearing the filters or searching for something else.</p>
          </div>
        }
      />
    </div>
  );
}
