"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Check, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import {
  getTicketAllocationSummary,
  getCategoryCapacityList,
  validateLayoutSeatCapacities,
  countSectionSeats,
  syncLayoutCategoriesFromPackages,
  TICKET_KIND_LABELS,
  type EventTicketPackage,
} from "@/lib/seating/package-sync";
import type { SeatLayoutDocument } from "@/lib/seating/types";

type Props = {
  eventId: string;
  packages: EventTicketPackage[];
  layout: SeatLayoutDocument;
  onSyncLayout: (layout: SeatLayoutDocument) => void;
};

export function TicketPackagesPanel({ eventId, packages, layout, onSyncLayout }: Props) {
  const allocation = React.useMemo(
    () => getTicketAllocationSummary(packages, layout),
    [packages, layout]
  );
  const capacities = React.useMemo(
    () => getCategoryCapacityList(packages, layout),
    [packages, layout]
  );

  const hasPackages = packages.length > 0;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Event ticket categories</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Set ticket name, price, and quantity on the event page. Place seats in blocks across zones
            until each category reaches its ticket count.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/events/${eventId}/edit`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Edit tickets
            </Link>
          </Button>
          {hasPackages && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSyncLayout(syncLayoutCategoriesFromPackages(layout, packages))}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync to map
            </Button>
          )}
        </div>
      </div>

      {!hasPackages ? (
        <p className="mt-4 rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
          No ticket categories yet.{" "}
          <Link href={`/portal/events/${eventId}/edit`} className="font-medium text-primary underline">
            Add ticket packages
          </Link>{" "}
          on the event edit page before building the seat map.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {allocation.map((row) => {
            const cap = capacities.find((c) => c.categoryId === row.packageId);
            const showProgress =
              row.ticketKind === "STANDING" ||
              row.ticketKind === "SEATED" ||
              (row.mapped ?? 0) > 0;
            const pct =
              cap && cap.qtyTotal > 0
                ? Math.min(100, Math.round((cap.mapped / cap.qtyTotal) * 100))
                : 0;

            return (
            <li
              key={row.packageId}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm",
                row.status === "over" && "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
                row.status === "under" && showProgress && "border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20",
                row.status === "ok" && showProgress && "border-emerald-300/60 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20"
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{
                    backgroundColor:
                      layout.categories.find((c) => c.id === row.packageId)?.color ?? "#6366f1",
                  }}
                />
                <span className="font-medium">{row.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {TICKET_KIND_LABELS[row.ticketKind]}
                </Badge>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(row.price / 100)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Ticket qty {row.qtyTotal}
                  {row.qtySold > 0 ? ` · ${row.qtySold} sold` : ""}
                </span>
              </div>
              {showProgress ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {row.status === "ok" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle
                          className={cn(
                            "h-3.5 w-3.5",
                            row.status === "over" ? "text-red-500" : "text-amber-500"
                          )}
                        />
                      )}
                      {row.hint}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {cap?.mapped ?? row.mapped}/{row.qtyTotal}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        row.status === "over" && "bg-red-500",
                        row.status === "ok" && "bg-emerald-500",
                        row.status === "under" && "bg-amber-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Sold by quantity - no map placement required
                </p>
              )}
            </li>
          );
          })}
        </ul>
      )}
    </section>
  );
}
