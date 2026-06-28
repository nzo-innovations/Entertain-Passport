import Link from "next/link";
import { ArrowRight, Clock, ScanLine, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getOrganizerEvents } from "@/lib/permissions";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ApprovalStatus } from "@/lib/types";
import { formatEventDate } from "@/lib/format";
import { db } from "@/lib/db";
import { canScanEventTickets } from "@/lib/permissions";

export default async function PortalDashboard() {
  const session = await getSession();
  if (!session) return null;

  const events = await getOrganizerEvents(session.id, session.role);
  const orgs = await db.organization.findMany({
    where: {
      OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }],
    },
  });

  const pending = events.filter((e) => e.approvalStatus === ApprovalStatus.PENDING_REVIEW);
  const approved = events.filter((e) => e.approvalStatus === ApprovalStatus.APPROVED);
  const totalRevenue = events.reduce(
    (s, e) => s + e.packages.reduce((p, pk) => p + pk.price * pk.qtySold, 0),
    0
  );
  const totalSold = events.reduce(
    (s, e) => s + e.packages.reduce((p, pk) => p + pk.qtySold, 0),
    0
  );

  const gateEvents = [];
  for (const e of events.filter((ev) => ev.approvalStatus === ApprovalStatus.APPROVED)) {
    if (await canScanEventTickets(session.id, e.id, session.role)) {
      gateEvents.push(e);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-2xl font-bold">Welcome back, {session.name?.split(" ")[0]}</h2>
        <p className="text-sm text-muted-foreground">
          Manage your shows, track approval status, assign door staff, and verify entry on event day.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Your organizations", value: orgs.length.toString() },
          { label: "Total events", value: events.length.toString() },
          { label: "Tickets sold", value: totalSold.toLocaleString() },
          { label: "Revenue", value: formatCurrency(totalRevenue / 100) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>

      {pending.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">{pending.length} event(s) awaiting platform approval</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            nZO Super Admin will review before they appear on the public site.
          </p>
        </section>
      )}

      {gateEvents.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScanLine className="h-5 w-5 text-primary" />
            Event-day scanner
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify attendees by NIC, passport number or Entertain Passport card at the entrance.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {gateEvents.slice(0, 3).map((e) => (
              <Button key={e.id} variant="brand" size="sm" asChild>
                <Link href={`/portal/events/${e.id}/scan`}>Open gate - {e.title}</Link>
              </Button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold">Your events</h3>
          <Link href="/portal/events" className="text-sm text-primary hover:underline">
            View all <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Approval</th>
                <th className="px-4 py-3 text-right">Sold</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.slice(0, 8).map((e) => {
                const sold = e.packages.reduce((s, p) => s + p.qtySold, 0);
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{e.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatEventDate(e.startsAt)}</td>
                    <td className="px-4 py-3">
                      <ApprovalBadge status={e.approvalStatus} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{sold}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/portal/events/${e.id}`} className="text-xs text-primary hover:underline">
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
