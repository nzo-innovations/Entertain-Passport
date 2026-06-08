import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, ScanLine } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { SubmitEventButton } from "@/components/portal/submit-event-button";
import { EventStaffManager } from "@/components/portal/event-staff-manager";
import { CheckInManager } from "@/components/portal/check-in-manager";
import { ArtistTagger } from "@/components/portal/artist-tagger";
import { TicketCodeManager } from "@/components/portal/ticket-code-manager";
import { Button } from "@/components/ui/button";
import { ApprovalStatus, EventStatus } from "@/lib/types";
import { formatEventDateLong } from "@/lib/format";

export default async function PortalEventDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowed = await canManageEvent(session.id, params.id, session.role);
  if (!allowed) notFound();

  const event = await db.event.findUnique({
    where: { id: params.id },
    include: {
      organization: true,
      category: true,
      venue: true,
      packages: true,
      staff: { include: { user: { select: { id: true, name: true, email: true } } } },
      artists: { include: { organization: { select: { id: true, name: true } } } },
      approvalLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!event) notFound();

  const isMusic = /music|concert|festival|band|dj|gig/i.test(
    `${event.category.name} ${event.category.slug}`
  );

  const settings = await db.platformSettings.findUnique({ where: { id: "default" } });

  const workers = await db.user.findMany({
    where: {
      OR: [
        { orgMemberships: { some: { organizationId: event.organizationId } } },
        { id: event.organization.ownerId },
      ],
    },
    select: { id: true, name: true, email: true },
  });

  const canSubmit = (
    [
      ApprovalStatus.DRAFT,
      ApprovalStatus.CHANGES_REQUESTED,
      ApprovalStatus.REJECTED,
    ] as string[]
  ).includes(event.approvalStatus);

  const isLive =
    event.approvalStatus === ApprovalStatus.APPROVED && event.status === EventStatus.PUBLISHED;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/portal/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ApprovalBadge status={event.approvalStatus} />
          {isLive && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
              Live on public site
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl font-bold">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {event.organization.name} · {event.category.name} · {formatEventDateLong(event.startsAt)}
        </p>
        {event.reviewNote && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">Review feedback</p>
            <p className="mt-1 text-muted-foreground">{event.reviewNote}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canSubmit && <SubmitEventButton eventId={event.id} />}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/events/${event.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit event
            </Link>
          </Button>
          {isLive && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/events/${event.slug}`} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  View public page
                </Link>
              </Button>
              <Button variant="brand" size="sm" asChild>
                <Link href={`/portal/events/${event.id}/scan`}>
                  <ScanLine className="h-4 w-4" />
                  Open scanner
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <EventStaffManager
        eventId={event.id}
        staff={event.staff}
        availableWorkers={workers}
        extraFeeCents={settings?.extraStaffMonthlyFee ?? 1500}
      />

      {isMusic && (
        <ArtistTagger
          eventId={event.id}
          initial={event.artists.map((a) => ({
            eventArtistId: a.id,
            id: a.organization.id,
            name: a.organization.name,
          }))}
        />
      )}

      <TicketCodeManager eventId={event.id} />

      <CheckInManager eventId={event.id} />

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-lg font-semibold">Approval timeline</h3>
        <ol className="mt-4 space-y-3">
          {event.approvalLogs.map((log) => (
            <li key={log.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p>
                  <span className="font-medium">{log.fromStatus}</span>
                  {" → "}
                  <span className="font-medium">{log.toStatus}</span>
                  {log.actor?.name && (
                    <span className="text-muted-foreground"> · by {log.actor.name}</span>
                  )}
                </p>
                {log.note && <p className="text-muted-foreground">{log.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
          {event.approvalLogs.length === 0 && (
            <li className="text-muted-foreground">Not submitted yet.</li>
          )}
        </ol>
      </section>
    </div>
  );
}
