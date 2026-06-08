import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";

export type EventCardData = {
  slug: string;
  title: string;
  shortDescription?: string | null;
  primaryImage: string;
  category: string;
  startsAt: Date | string;
  venue: string;
  city: string;
  fromPrice: number; // cents
  totalSeats: number;
  soldSeats: number;
  featured?: boolean;
};

export function EventCard({ event, variant = "grid" }: { event: EventCardData; variant?: "grid" | "wide" }) {
  const sellPct = event.totalSeats > 0 ? Math.round((event.soldSeats / event.totalSeats) * 100) : 0;
  const trending = sellPct > 30;
  const lowAvail = sellPct > 75;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={event.primaryImage}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant="brand" className="backdrop-blur">
            {event.category}
          </Badge>
          {event.featured && (
            <Badge variant="warning" className="backdrop-blur">
              Featured
            </Badge>
          )}
          {trending && !lowAvail && (
            <Badge variant="success" className="backdrop-blur">
              <TrendingUp className="mr-1 h-3 w-3" />
              Trending
            </Badge>
          )}
          {lowAvail && (
            <Badge variant="live" className="backdrop-blur">
              Almost gone
            </Badge>
          )}
        </div>

        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {formatEventDate(event.startsAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight font-display group-hover:text-primary">
          {event.title}
        </h3>
        {event.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{event.shortDescription}</p>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">
            {event.venue} · {event.city}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
            <p className="text-lg font-bold leading-none">
              {formatCurrency(event.fromPrice / 100)}
            </p>
          </div>
          <span className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
            View tickets
          </span>
        </div>
      </div>
    </Link>
  );
}
