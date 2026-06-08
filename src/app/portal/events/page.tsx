import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOrganizerEvents } from "@/lib/permissions";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import { CalendarPlus } from "lucide-react";

export default async function PortalEventsPage() {
  const session = await getSession();
  if (!session) return null;

  const events = await getOrganizerEvents(session.id, session.role);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">My events</h1>
          <p className="text-sm text-muted-foreground">
            Submit for review → Super Admin approves → visible to customers.
          </p>
        </div>
        <Button variant="brand" asChild>
          <Link href="/portal/events/new">
            <CalendarPlus className="h-4 w-4" />
            New show
          </Link>
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Approval</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((e) => {
              const revenue = e.packages.reduce((s, p) => s + p.price * p.qtySold, 0);
              return (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.category.name}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.organization.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatEventDate(e.startsAt)}</td>
                  <td className="px-4 py-3">
                    <ApprovalBadge status={e.approvalStatus} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(revenue / 100)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/portal/events/${e.id}`} className="text-xs font-medium text-primary hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
