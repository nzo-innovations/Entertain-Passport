import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { CategoryStrip } from "@/components/marketing/category-strip";
import { ValueProps } from "@/components/marketing/value-props";
import { OrganizerCTA } from "@/components/marketing/organizer-cta";
import { EventGrid } from "@/components/events/event-grid";
import { getCategoriesWithCounts, getEventCards } from "@/lib/events";

export const revalidate = 60;

export default async function HomePage() {
  const [featured, upcoming, categories] = await Promise.all([
    getEventCards({ featured: true, limit: 4 }),
    getEventCards({ limit: 8 }),
    getCategoriesWithCounts(),
  ]);

  const heroImages = featured.length
    ? featured.map((e) => e.primaryImage)
    : upcoming.slice(0, 4).map((e) => e.primaryImage);

  return (
    <div className="space-y-16 pb-20 sm:space-y-24">
      <Hero heroImages={heroImages} />

      <ValueProps />

      <section className="container">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Featured
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
              Tonight&apos;s headliners
            </h2>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            All shows <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6">
          <EventGrid events={featured} />
        </div>
      </section>

      <CategoryStrip items={categories} />

      <section className="container">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            Upcoming gigs &amp; sets
          </h2>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6">
          <EventGrid events={upcoming} />
        </div>
      </section>

      <OrganizerCTA />
    </div>
  );
}
