import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarPlus,
  Eye,
  Sparkles,
  TicketCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/admin/stat-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { db } from "@/lib/db";
import { formatCurrency, formatCompact } from "@/lib/utils";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [events, packages, totalUsers] = await Promise.all([
    db.event.findMany({
      where: { status: "PUBLISHED" },
      include: {
        primaryImage: true,
        venue: true,
        category: true,
        packages: true,
      },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
    db.ticketPackage.findMany(),
    db.user.count(),
  ]);

  const totalRevenue = packages.reduce((s, p) => s + p.price * p.qtySold, 0);
  const totalTickets = packages.reduce((s, p) => s + p.qtySold, 0);
  const totalCapacity = packages.reduce((s, p) => s + p.qtyTotal, 0);

  const chart = Array.from({ length: 14 }).map((_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (13 - i));
    const wave = Math.sin(i / 2) * 0.4 + 0.6;
    return {
      day: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tickets: Math.round(60 + 60 * wave + Math.random() * 20),
      revenue: Math.round((600 + 600 * wave + Math.random() * 200)),
    };
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Welcome back</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Your platform is humming.{" "}
            <span className="gradient-text">{formatCompact(totalTickets)} tickets</span> sold this week.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Manage events, watch sales in real time, configure alerts, and onboard new organizers
            from one place.
          </p>
        </div>
        <Button variant="brand" size="lg" asChild>
          <Link href="/admin/events/new">
            <CalendarPlus className="h-4 w-4" />
            Publish new event
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue (30d)"
          value={formatCurrency(totalRevenue / 100)}
          delta={12.4}
          hint="vs. last 30 days"
          icon={BadgeDollarSign}
        />
        <StatCard
          label="Tickets sold"
          value={formatCompact(totalTickets)}
          delta={8.1}
          hint="across all events"
          icon={TicketCheck}
        />
        <StatCard
          label="Sell-through"
          value={`${totalCapacity ? Math.round((totalTickets / totalCapacity) * 100) : 0}%`}
          delta={3.6}
          hint="capacity utilized"
          icon={Sparkles}
        />
        <StatCard label="Active customers" value={formatCompact(totalUsers)} delta={5.2} hint="this month" icon={Users} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Sales over time</h3>
              <p className="text-sm text-muted-foreground">Last 14 days · tickets &amp; revenue</p>
            </div>
            <Badge variant="success">Live</Badge>
          </div>
          <div className="mt-4">
            <SalesChart data={chart} />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-end justify-between">
            <h3 className="font-display text-lg font-semibold">Threshold alerts</h3>
            <Badge variant="warning">3 active</Badge>
          </div>
          <ul className="mt-4 space-y-3">
            {events.slice(0, 3).map((e) => {
              const sold = e.packages.reduce((s, p) => s + p.qtySold, 0);
              const total = e.packages.reduce((s, p) => s + p.qtyTotal, 0);
              const pct = total > 0 ? Math.round((sold / total) * 100) : 0;
              return (
                <li key={e.id} className="rounded-xl border bg-background/40 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p className="line-clamp-1 flex-1 text-sm font-semibold">{e.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Threshold: 1,000 tickets &mdash; currently at {sold} ({pct}%)
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full gradient-brand transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/admin/alerts"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Manage alerts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold">Your upcoming events</h3>
          <Link
            href="/admin/events"
            className="text-sm font-medium text-primary hover:underline"
          >
            See all
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Venue</th>
                <th className="px-4 py-3 text-right">Sold</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => {
                const sold = e.packages.reduce((s, p) => s + p.qtySold, 0);
                const revenue = e.packages.reduce((s, p) => s + p.price * p.qtySold, 0);
                return (
                  <tr key={e.id} className="transition-colors hover:bg-muted/30">
                    <td className="max-w-xs px-4 py-3">
                      <p className="line-clamp-1 font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.category.name}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatEventDate(e.startsAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.venue.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sold.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(revenue / 100)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/events/${e.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Eye className="h-3 w-3" />
                        View
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
