"use client";

import * as React from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatMoney } from "@/lib/money";

type CategoryReport = {
  packageId: string;
  name: string;
  price: number;
  planned: number;
  configured: number;
  sold: number;
  available: number;
  voided: number;
  grossIncome: number;
  commission: number;
  netIncome: number;
};

type Report = {
  event: { id: string; title: string; currency: string; commissionPct: number; physicalTicketsEnabled: boolean };
  categories: CategoryReport[];
  totals: Omit<CategoryReport, "packageId" | "name" | "price">;
};

type Breakdown = { packageId: string; name: string; sold: string[]; available: string[] }[];

export function PhysicalTicketReport({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [report, setReport] = React.useState<Report | null>(null);
  const [breakdown, setBreakdown] = React.useState<Breakdown>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/physical/report`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't load report", description: json?.error, variant: "destructive" });
        return;
      }
      setReport(json.report);
      setBreakdown(json.breakdown ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await load();
  };

  const cur = report?.event.currency ?? "LKR";

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" /> Physical ticket report
        </h3>
        <Button variant="outline" size="sm" onClick={toggle}>
          {open ? "Hide" : "View report"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-6">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Building report…
            </p>
          )}

          {report && !loading && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Category</th>
                      <th className="px-2 py-2 text-right">Planned</th>
                      <th className="px-2 py-2 text-right">Configured</th>
                      <th className="px-2 py-2 text-right">Sold</th>
                      <th className="px-2 py-2 text-right">Remaining</th>
                      <th className="px-2 py-2 text-right">Gross</th>
                      <th className="px-2 py-2 text-right">Commission</th>
                      <th className="px-2 py-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.categories.map((c) => (
                      <tr key={c.packageId}>
                        <td className="px-2 py-2 font-medium">{c.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.planned}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.configured}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.sold}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.available}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(c.grossIncome, cur)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          -{formatMoney(c.commission, cur)}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">
                          {formatMoney(c.netIncome, cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="px-2 py-2">Overall</td>
                      <td className="px-2 py-2 text-right tabular-nums">{report.totals.planned}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{report.totals.configured}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{report.totals.sold}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{report.totals.available}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(report.totals.grossIncome, cur)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        -{formatMoney(report.totals.commission, cur)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(report.totals.netIncome, cur)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Income is calculated from sold physical tickets. Gross is before the{" "}
                {report.event.commissionPct}% platform commission; Net is what the organizer keeps.
              </p>

              <div>
                <h4 className="font-display text-base font-semibold">Sold vs remaining ticket numbers</h4>
                <div className="mt-3 space-y-4">
                  {breakdown.map((b) => (
                    <div key={b.packageId} className="rounded-xl border bg-background/40 p-4">
                      <p className="font-medium">{b.name}</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                            Sold ({b.sold.length})
                          </p>
                          <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                            {b.sold.length ? b.sold.join(", ") : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Remaining ({b.available.length})
                          </p>
                          <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                            {b.available.length ? b.available.join(", ") : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
