import { EventCard, type EventCardData } from "./event-card";

export function EventGrid({
  events,
  emptyState,
}: {
  events: EventCardData[];
  emptyState?: React.ReactNode;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        {emptyState ?? "No events found."}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {events.map((e) => (
        <EventCard key={e.slug} event={e} />
      ))}
    </div>
  );
}
