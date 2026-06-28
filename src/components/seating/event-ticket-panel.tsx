"use client";

import * as React from "react";
import { PackageSelector, type Pkg } from "@/components/events/package-selector";
import { SeatPicker } from "@/components/seating/seat-picker";
import {
  countSeatsByCategoryId,
  packagesForCheckout,
  type EventTicketPackage,
} from "@/lib/seating/package-sync";
import { countLayoutSeats, blankLayout } from "@/lib/seating/layout-utils";
import type { SeatLayoutDocument } from "@/lib/seating/types";

type EventInfo = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  primaryImage: string;
};

type Props = {
  event: EventInfo;
  packages: EventTicketPackage[];
  seatingEnabled: boolean;
  seatingPublished: boolean;
  layout?: SeatLayoutDocument;
};

function toPkg(p: EventTicketPackage): Pkg {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    qtyTotal: p.qtyTotal,
    qtySold: p.qtySold,
    perks: [],
  };
}

export function EventTicketPanel({
  event,
  packages,
  seatingEnabled,
  seatingPublished,
  layout,
}: Props) {
  const resolvedLayout = layout ?? blankLayout();

  const resolved = React.useMemo(
    () => packagesForCheckout(packages, resolvedLayout, seatingPublished),
    [packages, resolvedLayout, seatingPublished]
  );

  const seatCounts = React.useMemo(
    () => countSeatsByCategoryId(resolvedLayout),
    [resolvedLayout]
  );

  /** Categories with seats on the map - must pick seats, not qty-only checkout. */
  const seatedOnMap = React.useMemo(
    () =>
      resolved.filter((p) => (seatCounts[p.id] ?? 0) > 0).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
      })),
    [resolved, seatCounts]
  );

  /** Standing / GA with no seat map placement. */
  const noSeatPackages = React.useMemo(
    () =>
      resolved.filter(
        (p) =>
          p.ticketKind === "STANDING" ||
          ((seatCounts[p.id] ?? 0) === 0 && p.ticketKind !== "SEATED")
      ),
    [resolved, seatCounts]
  );

  const hasMapSeats = countLayoutSeats(resolvedLayout) > 0;
  const showSeatMap =
    seatingEnabled && seatingPublished && (seatedOnMap.length > 0 || hasMapSeats);
  const showNoSeatPicker = noSeatPackages.length > 0;

  if (!showSeatMap && !showNoSeatPicker) {
    return <PackageSelector event={event} packages={packages.map(toPkg)} />;
  }

  return (
    <div className="min-w-0 space-y-8">
      {showNoSeatPicker && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold">General admission</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These tickets do not require a seat on the map - pick a quantity and add to cart.
            </p>
          </div>
          <PackageSelector event={event} packages={noSeatPackages.map(toPkg)} hideTitle />
        </section>
      )}

      {showSeatMap && (
        <section>
          <SeatPicker event={event} seatedCategories={seatedOnMap} />
        </section>
      )}
    </div>
  );
};
