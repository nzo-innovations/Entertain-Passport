import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VenueProgramSchedule } from "@/components/venues/venue-program-schedule";
import { VenuePostItem } from "@/components/venues/venue-post-item";
import { PLACES_LABEL } from "@/lib/config";
import { getVenueDetailBySlug, FALLBACK_COVER } from "@/lib/venues";
import { VENUE_KIND_LABELS, type VenueKind } from "@/lib/types";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const venue = await getVenueDetailBySlug(params.slug);
  if (!venue) return { title: "Venue not found" };
  return {
    title: `${venue.name} - ${PLACES_LABEL}`,
    description: venue.description ?? `What's on at ${venue.name} in ${venue.city}.`,
  };
}

export default async function VenueDetailPage({ params }: { params: { slug: string } }) {
  const venue = await getVenueDetailBySlug(params.slug);
  if (!venue) notFound();

  const kindLabel = venue.kind ? VENUE_KIND_LABELS[venue.kind as VenueKind] ?? venue.kind : "Venue";
  const cover = venue.coverImageUrl ?? FALLBACK_COVER;

  return (
    <div className="pb-24">
      <div className="relative h-[240px] sm:h-[320px]">
        <Image src={cover} alt={venue.name} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container relative -mt-24 space-y-12 sm:-mt-28">
        <header className="max-w-3xl">
          <Badge variant="brand">{kindLabel}</Badge>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{venue.name}</h1>
          {venue.organization && (
            <p className="mt-2 text-sm text-muted-foreground">By {venue.organization.name}</p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {[venue.address, venue.line2, venue.city, venue.district].filter(Boolean).join(", ")}
            </span>
            {venue.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {venue.phone}
              </span>
            )}
          </p>
          {venue.description && (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{venue.description}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {venue.mapUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={venue.mapUrl} target="_blank" rel="noopener noreferrer">
                  Open in Maps
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {venue.website && (
              <Button variant="outline" size="sm" asChild>
                <a href={venue.website} target="_blank" rel="noopener noreferrer">
                  Website
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </header>

        {venue.posts.length > 0 && (
          <section id="updates">
            <h2 className="font-display text-2xl font-semibold">News &amp; updates</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest from {venue.name}. Tap a post to read more - external links appear when provided.
            </p>
            <div className="mt-6 space-y-3">
              {venue.posts.map((post) => (
                <VenuePostItem
                  key={post.id}
                  post={{
                    id: post.id,
                    title: post.title,
                    body: post.body,
                    imageUrl: post.imageUrl,
                    detailLink: post.detailLink,
                    publishedAt: post.publishedAt,
                    venueName: venue.name,
                    venueSlug: venue.slug!,
                    city: venue.city,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <VenueProgramSchedule programs={venue.programs} />
        </section>
      </div>
    </div>
  );
}
