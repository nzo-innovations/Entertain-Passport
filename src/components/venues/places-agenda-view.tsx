import Link from "next/link";
import { CalendarDays, MapPin, Music2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VenuePostItem } from "@/components/venues/venue-post-item";
import type { PlacesAgendaResult } from "@/lib/places-agenda";

type Props = {
  agenda: PlacesAgendaResult;
  venueCount: number;
};

export function PlacesAgendaView({ agenda, venueCount }: Props) {
  const daysWithItems = agenda.days.filter((d) => d.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-primary" />
            {agenda.rangeLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {agenda.totalItems === 0
              ? `Nothing listed in the next 7 days across ${venueCount} ${venueCount === 1 ? "place" : "places"}.`
              : `${agenda.totalItems} ${agenda.totalItems === 1 ? "listing" : "listings"} across ${venueCount} ${venueCount === 1 ? "place" : "places"} - scroll to scan the week.`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Tap a post to read more · links open when provided</p>
      </div>

      {daysWithItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <Music2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium">Nothing scheduled this week</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing filters, switching to Places view, or check individual venue pages.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {agenda.days.map((day) =>
            day.items.length === 0 ? null : (
              <section key={day.dateKey}>
                <h2 className="font-display text-lg font-semibold sm:text-xl">{day.label}</h2>
                <ul className="mt-3 space-y-2">
                  {day.items.map((item) => (
                    <li key={item.id}>
                      {item.kind === "post" ? (
                        <VenuePostItem
                          variant="agenda"
                          post={{
                            id: item.id,
                            title: item.title,
                            body: item.body ?? "",
                            imageUrl: item.imageUrl,
                            detailLink: item.detailLink,
                            publishedAt: item.startAt,
                            venueName: item.venueName,
                            venueSlug: item.venueSlug,
                            city: item.city,
                          }}
                        />
                      ) : (
                        <ProgramAgendaRow item={item} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ProgramAgendaRow({ item }: { item: PlacesAgendaResult["days"][number]["items"][number] }) {
  return (
    <div className="group flex items-stretch gap-3 rounded-xl border bg-card px-3 py-3 transition-colors hover:border-primary/30 sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={item.href}
              className="font-semibold leading-snug hover:text-primary group-hover:text-primary"
            >
              {item.title}
            </Link>
            {item.badge && (
              <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium">
                <Music2 className="mr-1 h-3 w-3" />
                {item.badge}
              </Badge>
            )}
          </div>
          {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
        </div>

        <div className="flex shrink-0 flex-col text-sm sm:items-end sm:text-right">
          <Link
            href={`/venues/${item.venueSlug}`}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {item.venueName}
          </Link>
          <p className="text-muted-foreground">
            {item.timeLabel}
            {item.city ? ` · ${item.city}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
