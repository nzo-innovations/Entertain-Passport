import Image from "next/image";
import Link from "next/link";
import { MapPin, Music2, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VENUE_KIND_LABELS, type VenueKind } from "@/lib/types";
import type { VenueCardData } from "@/lib/venues";

export function VenueCard({ venue }: { venue: VenueCardData }) {
  const kindLabel = venue.kind ? VENUE_KIND_LABELS[venue.kind as VenueKind] ?? venue.kind : "Venue";

  return (
    <Link
      href={`/venues/${venue.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={venue.coverImageUrl ?? ""}
          alt={venue.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge variant="brand" className="backdrop-blur">
            {kindLabel}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-lg font-semibold leading-tight group-hover:text-primary">{venue.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {venue.city}
          {venue.district ? ` · ${venue.district}` : ""}
        </p>
        {venue.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{venue.description}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {venue.programCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Music2 className="h-3 w-3" />
              {venue.programCount} weekly {venue.programCount === 1 ? "night" : "nights"}
            </span>
          )}
          {venue.upcomingEventCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Ticket className="h-3 w-3" />
              {venue.upcomingEventCount} ticketed {venue.upcomingEventCount === 1 ? "show" : "shows"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
