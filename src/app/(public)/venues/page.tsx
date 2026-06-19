import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VenueCard } from "@/components/venues/venue-card";
import { PlacesFilterBar } from "@/components/venues/places-filter-bar";
import { getPlacesFilterMeta, getPublishedVenueCards, type PlacesFilter } from "@/lib/venues";
import { PLACES_LABEL, ROUTES } from "@/lib/config";

export const metadata = {
  title: `${PLACES_LABEL} — Pubs, cafés, clubs & more`,
  description:
    "Browse published pubs, restaurants, coffee shops, clubs and dating spots. Filter by city, type, live music and ticketed nights.",
};

export const revalidate = 60;

function parseFilters(searchParams: Record<string, string | undefined>): PlacesFilter {
  const tagSlugs = searchParams.tags?.split(",").filter(Boolean);
  return {
    search: searchParams.q,
    kind: searchParams.kind,
    mainCategorySlug: searchParams.main,
    subCategorySlug: searchParams.sub,
    tagSlugs: tagSlugs?.length ? tagSlugs : undefined,
    city: searchParams.city,
    district: searchParams.district,
    live: searchParams.live === "1",
    tickets: searchParams.tickets === "1",
    sort: (searchParams.sort as PlacesFilter["sort"]) ?? "name",
  };
}

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const [venues, meta] = await Promise.all([
    getPublishedVenueCards(filters),
    getPlacesFilterMeta({ city: filters.city, kind: filters.kind, mainCategorySlug: filters.mainCategorySlug }),
  ]);

  const hasActiveFilters = !!(
    filters.search ||
    filters.kind ||
    filters.mainCategorySlug ||
    filters.subCategorySlug ||
    filters.tagSlugs?.length ||
    filters.city ||
    filters.district ||
    filters.live ||
    filters.tickets ||
    (filters.sort && filters.sort !== "name")
  );

  return (
    <div className="space-y-10 pb-24">
      <section className="container pt-10 sm:pt-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{PLACES_LABEL}</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Find pubs, cafés, clubs &amp;{" "}
            <span className="gradient-text">places to meet</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Only published listings from verified company owners — weekly live music, hangout info and
            special ticketed nights.
          </p>
        </div>
      </section>

      <section className="container space-y-6">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl border bg-muted/30" />}>
          <PlacesFilterBar meta={meta} resultCount={venues.length} />
        </Suspense>

        {venues.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">
              {hasActiveFilters ? "No places match these filters" : "No published places yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try clearing filters or searching a different city or type."
                : "Check back soon — new pubs, cafés and clubs are added by local owners."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-6" asChild>
                <Link href="/venues">Clear all filters</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <VenueCard key={v.slug} venue={v} />
            ))}
          </div>
        )}
      </section>

      <section className="container">
        <div className="rounded-3xl border bg-card p-8 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">For company owners</p>
            <h2 className="mt-2 font-display text-xl font-semibold sm:text-2xl">Publish your pub, café or club</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up or sign in on the <strong className="font-medium text-foreground">organizer portal</strong> as
              a <strong className="font-medium text-foreground">Company / Venue Owner</strong>. Manage your place,
              weekly program and ticketed events from one account.
            </p>
          </div>
          <Button variant="brand" size="lg" className="mt-6 shrink-0 sm:mt-0" asChild>
            <Link href={ROUTES.organizerLogin}>
              Company owner sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
