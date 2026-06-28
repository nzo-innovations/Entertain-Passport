import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TicketCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getEventCheckinStats } from "@/lib/gate";
import { GateConsole } from "@/components/gate/gate-console";
import { Button } from "@/components/ui/button";
import { formatEventDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GateEventPage({ params }: { params: { eventId: string } }) {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  // Hard scope: gate staff can only open events they are assigned to.
  const allowed = await canScanEventTickets(session.id, params.eventId, session.role);
  if (!allowed) notFound();

  const event = await db.event.findUnique({
    where: { id: params.eventId },
    include: { venue: true },
  });
  if (!event) notFound();

  const stats = await getEventCheckinStats(event.id);

  return (
    <div className="space-y-5">
      <Link href="/gate" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My events
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatEventDateLong(event.startsAt)} · {event.venue.name}
          </p>
        </div>
        {event.physicalTicketsEnabled && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/gate/${event.id}/tickets`}>
              <TicketCheck className="h-4 w-4" /> Physical tickets
            </Link>
          </Button>
        )}
      </header>

      <GateConsole
        eventId={event.id}
        eventTitle={event.title}
        venueName={event.venue.name}
        initialStats={stats}
      />
    </div>
  );
}
