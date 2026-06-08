import Link from "next/link";
import { CalendarPlus, Eye, Pencil } from "lucide-react";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await db.event.findMany({
    include: { category: true, venue: true, packages: true, organization: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">{events.length} total · manage publishing &amp; pricing.</p>
        </div>
        <Button variant="brand" asChild>
          <Link href="/admin/events/new">
            <CalendarPlus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Organizer</th>
              <th className="px-4 py-3 text-left">Approval</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Sold</th>
              <th className="px-4 py-3 text-right">Capacity</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((e) => {
              const sold = e.packages.reduce((s, p) => s + p.qtySold, 0);
              const total = e.packages.reduce((s, p) => s + p.qtyTotal, 0);
              const revenue = e.packages.reduce((s, p) => s + p.price * p.qtySold, 0);
              return (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="max-w-md px-4 py-3">
                    <p className="line-clamp-1 font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.category.name} · {e.venue.name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.organization.name}</td>
                  <td className="px-4 py-3">
                    <ApprovalBadge status={e.approvalStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        e.status === "PUBLISHED"
                          ? "success"
                          : e.status === "DRAFT"
                          ? "outline"
                          : "warning"
                      }
                    >
                      {e.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatEventDate(e.startsAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{sold.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(revenue / 100)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title="View public page">
                        <Link href={`/events/${e.slug}`} target="_blank">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Manage event">
                        <Link href={`/admin/events/${e.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
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
