import { Suspense } from "react";
import { FilterBar } from "@/components/events/filter-bar";
import { EventGrid } from "@/components/events/event-grid";
import { getCategoriesWithCounts, getEventCards } from "@/lib/events";

export const revalidate = 60;

export default async function EventsBrowsePage({
  searchParams,
}: {
  searchParams?: { category?: string; q?: string };
}) {
  const [events, categories] = await Promise.all([
    getEventCards({
      categorySlug: searchParams?.category,
      search: searchParams?.q,
      limit: 60,
    }),
    getCategoriesWithCounts(),
  ]);

  const heading = searchParams?.q
    ? `Results for \u201c${searchParams.q}\u201d`
    : searchParams?.category
    ? `${categories.find((c) => c.slug === searchParams.category)?.name ?? "Events"}`
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

      <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl border bg-muted/30" />}>
        <FilterBar categories={categories} />
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
