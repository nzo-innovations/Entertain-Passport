import { countLayoutSeats, flattenLayoutSeats } from "./layout-utils";
import { nextCategoryColor } from "./seat-colors";
import type { LayoutSection, SeatLayoutDocument, TicketKind } from "./types";
import { getVenueZones } from "./venue-zones";

export type EventTicketPackage = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  qtyTotal: number;
  qtySold: number;
  ticketKind: TicketKind;
  sortOrder: number;
};

export const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  SEATED: "Assigned seating",
  STANDING: "Standing / GA",
  GENERAL: "General admission",
};

export const TICKET_KIND_HINTS: Record<TicketKind, string> = {
  SEATED: "Buyer picks seats on the map",
  STANDING: "Sold by quantity - no seat selection",
  GENERAL: "Sold by quantity - no seat map required",
};

export function parseTicketKind(value: string | null | undefined): TicketKind {
  if (value === "SEATED" || value === "STANDING" || value === "GENERAL") return value;
  return "GENERAL";
}

/** Count individual seats placed on the map per category id. */
export function countSeatsByCategoryId(layout: SeatLayoutDocument): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const seat of flattenLayoutSeats(layout)) {
    const cid = seat.categoryId;
    if (!cid) continue;
    counts[cid] = (counts[cid] ?? 0) + 1;
  }
  return counts;
}

/** Sum standing-zone capacity per linked category id. */
export function countStandingCapacityByCategoryId(layout: SeatLayoutDocument): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const zone of getVenueZones(layout)) {
    if (zone.kind !== "STANDING" || !zone.categoryId) continue;
    const cap = zone.capacity ?? 0;
    counts[zone.categoryId] = (counts[zone.categoryId] ?? 0) + cap;
  }
  return counts;
}

/** Count seat blocks (sections/tables) contributing seats per category. */
export function countBlocksByCategoryId(layout: SeatLayoutDocument): Record<string, number> {
  const blocks: Record<string, number> = {};
  for (const sec of layout.sections) {
    if (!sec.enabled) continue;
    const n = flattenLayoutSeats({ ...layout, sections: [sec] }).length;
    if (n === 0) continue;
    const cid = sec.categoryId;
    if (!cid) continue;
    blocks[cid] = (blocks[cid] ?? 0) + 1;
  }
  return blocks;
}

export type CategoryCapacityInfo = {
  categoryId: string;
  name: string;
  mapped: number;
  qtyTotal: number;
  remaining: number;
  blocks: number;
  status: "ok" | "under" | "over" | "empty";
  usesMap: boolean;
};

export function getCategoryCapacityList(
  packages: EventTicketPackage[],
  layout: SeatLayoutDocument
): CategoryCapacityInfo[] {
  const seatCounts = countSeatsByCategoryId(layout);
  const standingCounts = countStandingCapacityByCategoryId(layout);
  const blockCounts = countBlocksByCategoryId(layout);

  return packages.map((pkg) => {
    const usesStanding = pkg.ticketKind === "STANDING";
    const seatMapped = seatCounts[pkg.id] ?? 0;
    const standingMapped = standingCounts[pkg.id] ?? 0;
    const mapped = usesStanding ? standingMapped : seatMapped;
    const usesMap = usesStanding || seatMapped > 0 || pkg.ticketKind === "SEATED";
    const remaining = pkg.qtyTotal - mapped;

    let status: CategoryCapacityInfo["status"] = "empty";
    if (mapped === 0) status = "empty";
    else if (mapped === pkg.qtyTotal) status = "ok";
    else if (mapped < pkg.qtyTotal) status = "under";
    else status = "over";

    return {
      categoryId: pkg.id,
      name: pkg.name,
      mapped,
      qtyTotal: pkg.qtyTotal,
      remaining,
      blocks: usesStanding ? (standingMapped > 0 ? 1 : 0) : blockCounts[pkg.id] ?? 0,
      status,
      usesMap,
    };
  });
}

export function validateLayoutSeatCapacities(
  packages: EventTicketPackage[],
  layout: SeatLayoutDocument
): { ok: boolean; message?: string; categoryId?: string } {
  if (!packages.length) return { ok: true };

  for (const row of getCategoryCapacityList(packages, layout)) {
    if (row.status === "over") {
      const unit = packages.find((p) => p.id === row.categoryId)?.ticketKind === "STANDING"
        ? "standing capacity"
        : "seats";
      return {
        ok: false,
        categoryId: row.categoryId,
        message: `"${row.name}" has ${row.mapped} ${unit} on the map but ticket quantity is ${row.qtyTotal}. Remove ${row.mapped - row.qtyTotal} or increase quantity on the event page.`,
      };
    }
  }
  return { ok: true };
}

/** Seat count for one section after a hypothetical update. */
export function countSectionSeats(section: LayoutSection, layout: SeatLayoutDocument): number {
  if (!section.enabled) return 0;
  return flattenLayoutSeats({ ...layout, sections: [section] }).length;
}

export function projectCategorySeatCount(
  layout: SeatLayoutDocument,
  categoryId: string,
  sectionId: string,
  updatedSection: LayoutSection
): number {
  const nextSections = layout.sections.map((s) => (s.id === sectionId ? updatedSection : s));
  return countSeatsByCategoryId({ ...layout, sections: nextSections })[categoryId] ?? 0;
}

export type TicketAllocationRow = {
  packageId: string;
  name: string;
  ticketKind: TicketKind;
  price: number;
  qtyTotal: number;
  qtySold: number;
  mapped: number;
  status: "ok" | "under" | "over" | "n/a";
  hint: string;
};

export function getTicketAllocationSummary(
  packages: EventTicketPackage[],
  layout: SeatLayoutDocument
): TicketAllocationRow[] {
  const seatCounts = countSeatsByCategoryId(layout);
  const standingCounts = countStandingCapacityByCategoryId(layout);

  return packages.map((pkg) => {
    const kind = pkg.ticketKind;
    const seatMapped = seatCounts[pkg.id] ?? 0;
    const standingMapped = standingCounts[pkg.id] ?? 0;
    let mapped = 0;
    let status: TicketAllocationRow["status"] = "n/a";
    let hint = TICKET_KIND_HINTS[kind];

    if (kind === "STANDING") {
      mapped = standingMapped;
      if (mapped === 0) {
        status = "under";
        hint = "Add a standing area on the map and link this category";
      } else if (mapped === pkg.qtyTotal) {
        status = "ok";
        hint = `${mapped} / ${pkg.qtyTotal} standing capacity on map`;
      } else if (mapped < pkg.qtyTotal) {
        status = "under";
        hint = `${mapped} / ${pkg.qtyTotal} standing capacity - ${pkg.qtyTotal - mapped} remaining`;
      } else {
        status = "over";
        hint = `${mapped} / ${pkg.qtyTotal} standing capacity exceeds ticket qty`;
      }
    } else if (kind === "SEATED" || seatMapped > 0) {
      mapped = seatMapped;
      const blocks = layout.sections.filter(
        (s) => s.enabled && s.categoryId === pkg.id && countSectionSeats(s, layout) > 0
      ).length;
      if (mapped === 0) {
        status = "under";
        hint = `0 / ${pkg.qtyTotal} seats - place blocks on the map`;
      } else if (mapped === pkg.qtyTotal) {
        status = "ok";
        hint = `${mapped} / ${pkg.qtyTotal} seats across ${blocks} block${blocks === 1 ? "" : "s"}`;
      } else if (mapped < pkg.qtyTotal) {
        status = "under";
        hint = `${mapped} / ${pkg.qtyTotal} seats · ${blocks} block${blocks === 1 ? "" : "s"} · ${pkg.qtyTotal - mapped} to place`;
      } else {
        status = "over";
        hint = `${mapped} / ${pkg.qtyTotal} seats - ${mapped - pkg.qtyTotal} over ticket qty`;
      }
    }

    return {
      packageId: pkg.id,
      name: pkg.name,
      ticketKind: kind,
      price: pkg.price,
      qtyTotal: pkg.qtyTotal,
      qtySold: pkg.qtySold,
      mapped,
      status,
      hint,
    };
  });
}

/** Replace layout pricing tiers with event ticket packages (preserves map colours). */
export function syncLayoutCategoriesFromPackages(
  layout: SeatLayoutDocument,
  packages: EventTicketPackage[]
): SeatLayoutDocument {
  const colorById = new Map(layout.categories.map((c) => [c.id, c.color]));
  const categories = packages.map((pkg, i) => {
    const prior = packages.slice(0, i).map((p, j) => ({
      color: colorById.get(p.id) ?? layout.categories[j]?.color ?? "#6366f1",
    }));
    return {
      id: pkg.id,
      packageId: pkg.id,
      name: pkg.name,
      color: colorById.get(pkg.id) ?? nextCategoryColor(prior),
      price: pkg.price,
      enabled: true,
      sortOrder: pkg.sortOrder ?? i,
      ticketKind: pkg.ticketKind,
    };
  });

  return { ...layout, categories };
}

/** Infer ticket kind for legacy packages created before ticketKind existed. */
export function inferTicketKind(
  pkg: Pick<EventTicketPackage, "id" | "ticketKind">,
  layout: SeatLayoutDocument,
  seatingPublished: boolean
): TicketKind {
  if (pkg.ticketKind && pkg.ticketKind !== "GENERAL") return pkg.ticketKind;
  if (!seatingPublished) return parseTicketKind(pkg.ticketKind);

  const seats = countSeatsByCategoryId(layout)[pkg.id] ?? 0;
  if (seats > 0) return "SEATED";

  const standing = countStandingCapacityByCategoryId(layout)[pkg.id] ?? 0;
  if (standing > 0) return "STANDING";

  const cat = layout.categories.find((c) => c.id === pkg.id);
  if (cat?.ticketKind) return cat.ticketKind;

  return parseTicketKind(pkg.ticketKind);
}

export function packagesForCheckout(
  packages: EventTicketPackage[],
  layout: SeatLayoutDocument,
  seatingPublished: boolean
): EventTicketPackage[] {
  return packages.map((p) => ({
    ...p,
    ticketKind: inferTicketKind(p, layout, seatingPublished),
  }));
}

export function seatedPackageIds(
  packages: EventTicketPackage[],
  layout: SeatLayoutDocument,
  seatingPublished: boolean
): Set<string> {
  const resolved = packagesForCheckout(packages, layout, seatingPublished);
  return new Set(resolved.filter((p) => p.ticketKind === "SEATED").map((p) => p.id));
}

export function totalLayoutSeatCount(layout: SeatLayoutDocument): number {
  return countLayoutSeats(layout);
}
