import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Calendar, ExternalLink, Mail, MapPin, Phone, Ticket, User } from "lucide-react";
import { getSession, requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventToEditInitial } from "@/lib/event-update";
import { EventEditForm } from "@/components/events/event-edit-form";
import { PhysicalTicketManager } from "@/components/tickets/physical-ticket-manager";
import { PhysicalTicketReport } from "@/components/tickets/physical-ticket-report";
import { ReviewEventActions } from "@/components/admin/review-event-actions";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { Button } from "@/components/ui/button";
import { ApprovalStatus, EventStatus, ORG_TYPE_LABELS, type OrgType } from "@/lib/types";
import { formatEventDateLong } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminEventDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  try {
    await requireSuperAdmin();
  } catch {
    redirect(session ? "/portal" : "/login");
  }

  const [event, categories] = await Promise.all([
    db.event.findUnique({
      where: { id: params.id },
      include: {
        organization: { include: { owner: { select: { id: true, name: true, email: true, phone: true } } } },
        category: true,
        venue: true,
        packages: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        approvalLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!event) notFound();

  const isPending = event.approvalStatus === ApprovalStatus.PENDING_REVIEW;
  const isLive = event.approvalStatus === ApprovalStatus.APPROVED && event.status === EventStatus.PUBLISHED;
  const owner = event.organization.owner;
  const totalSold = event.packages.reduce((s, p) => s + p.qtySold, 0);
  const totalCapacity = event.packages.reduce((s, p) => s + p.qtyTotal, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ApprovalBadge status={event.approvalStatus} />
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{event.status}</span>
          {isLive && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
              Live
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl font-bold">{event.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" /> {formatEventDateLong(event.startsAt)}
          <span>·</span>
          <MapPin className="h-4 w-4" /> {event.venue.name}, {event.venue.city}
        </p>
        <div className="flex flex-wrap gap-2">
          {isLive && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/events/${event.slug}`} target="_blank">
                <ExternalLink className="h-4 w-4" /> View public page
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Creator / organization profile + contact */}
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Event creator</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Link href={`/admin/organizations/${event.organization.id}`} className="font-medium text-primary hover:underline">
                {event.organization.name}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {ORG_TYPE_LABELS[event.organization.type as OrgType] ?? event.organization.type}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> {owner.name ?? "-"}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${owner.email}`} className="text-primary hover:underline">
                {owner.email}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {owner.phone ? (
                <a href={`tel:${owner.phone}`} className="text-primary hover:underline">
                  {owner.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">No phone on file</span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Sales snapshot */}
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Ticket className="h-5 w-5 text-primary" /> Tickets
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalSold.toLocaleString()} / {totalCapacity.toLocaleString()} sold · commission {event.commissionPct}%
        </p>
        <ul className="mt-3 divide-y text-sm">
          {event.packages.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>{p.name}</span>
              <span className="text-muted-foreground">
                {formatMoney(p.price, event.currency)} · {p.qtySold}/{p.qtyTotal}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isPending && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="font-display text-lg font-semibold">Review</h2>
          <p className="mt-1 text-sm text-muted-foreground">This event is awaiting approval.</p>
          <div className="mt-3">
            <ReviewEventActions eventId={event.id} />
          </div>
        </section>
      )}

      {/* Physical ticket management + reporting (Super Admin: full control) */}
      <div className="space-y-6">
        <h2 className="font-display text-xl font-bold">Physical tickets</h2>
        <PhysicalTicketManager eventId={event.id} canConfigure />
        <PhysicalTicketReport eventId={event.id} />
      </div>

      {/* Full editor (super admin can change anything, including status & commission) */}
      <div>
        <h2 className="mb-3 font-display text-xl font-bold">Edit / manage</h2>
        <EventEditForm
          initial={eventToEditInitial(event)}
          categories={categories}
          isSuperAdmin
          canDelete
          redirectAfter={`/admin/events/${event.id}`}
          deleteRedirect="/admin/events"
        />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-lg font-semibold">Approval timeline</h3>
        <ol className="mt-4 space-y-3">
          {event.approvalLogs.map((log) => (
            <li key={log.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p>
                  <span className="font-medium">{log.fromStatus}</span>
                  {" -> "}
                  <span className="font-medium">{log.toStatus}</span>
                  {log.actor?.name && <span className="text-muted-foreground"> · by {log.actor.name}</span>}
                </p>
                {log.note && <p className="text-muted-foreground">{log.note}</p>}
                <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            </li>
          ))}
          {event.approvalLogs.length === 0 && <li className="text-muted-foreground">Not submitted yet.</li>}
        </ol>
      </section>
    </div>
  );
}
