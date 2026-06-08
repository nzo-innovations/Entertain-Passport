import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getGateEventsForUser, getEventCheckinStats } from "@/lib/gate";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GateHomePage() {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  const events = await getGateEventsForUser(session.id, session.role);
  const withStats = await Promise.all(
    events.map(async (e) => ({ event: e, stats: await getEventCheckinStats(e.id) }))
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Your assigned events</h1>
        <p className="text-sm text-muted-foreground">
          Tap an event to open the check-in console. You can only check in tickets
          for events you&apos;re assigned to.
        </p>
      </header>

      {withStats.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          No events assigned to you yet. Your event manager will add you to an event.
        </p>
      ) : (
        <ul className="space-y-3">
          {withStats.map(({ event, stats }) => (
            <li key={event.id}>
              <Link
                href={`/gate/${event.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold">{event.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatEventDate(event.startsAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {event.venue.name}
                    </span>
                  </p>
                  <p className="mt-2 text-xs font-medium">
                    <span className="text-emerald-600">{stats.checkedIn} in</span>
                    <span className="text-muted-foreground"> · {stats.pending} pending</span>
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
