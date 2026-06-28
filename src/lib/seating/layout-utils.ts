import type { LayoutSection, LayoutSeat, SeatLayoutDocument } from "./types";
import { getCurvedSectionBBox, resolveRowLayout } from "./row-layout";
import { getVenueZones } from "./venue-zones";
import { seatLabelForSection } from "./naming";
import { getTablePackSize, tableSeatLabel, getTablePackLayout, tableDescriptor } from "./table-pack";
import { countSectionGridSeats, getRowColCount, getSectionMaxCols, parseRowColCounts } from "./section-helpers";

export type SectionBounds = {
  w: number;
  h: number;
  labelSuffix: string;
  /** Hit-box origin for curved sections (defaults to section.x/y). */
  boxX?: number;
  boxY?: number;
};

export function getSectionBounds(section: LayoutSection, layout?: SeatLayoutDocument): SectionBounds {
  const sw = section.seatWidth ?? 22;
  const sh = section.seatHeight ?? 22;
  if (section.kind === "TABLE") {
    const geom = getTablePackLayout(section, sw);
    return { w: geom.width, h: geom.height, labelSuffix: ` · ${tableDescriptor(section)}` };
  }

  if (layout && resolveRowLayout(section, layout) === "CURVED") {
    const box = getCurvedSectionBBox(section, layout);
    return {
      w: box.maxX - box.minX + 8,
      h: box.maxY - box.minY + 20,
      labelSuffix: " · curved",
      boxX: box.minX - 4,
      boxY: box.minY - 16,
    };
  }

  const rg = section.rowGap ?? 4;
  const cg = section.colGap ?? 4;
  const maxCols = getSectionMaxCols(section);
  return {
    w: maxCols * sw + Math.max(0, maxCols - 1) * cg + (section.aisleGap ?? 0),
    h: section.rows * sh + Math.max(0, section.rows - 1) * rg,
    labelSuffix: section.rowColCounts?.length ? " · variable rows" : "",
  };
}

/** Fast seat count without building every seat object. */
export function countLayoutSeats(layout: SeatLayoutDocument): number {
  let n = 0;
  for (const section of layout.sections) {
    if (!section.enabled && !section.seats?.length) continue;
    if (section.kind === "TABLE") {
      n += getTablePackSize(section);
    } else {
      n += countSectionGridSeats(section);
    }
  }
  return n;
}

/** Default coordinate space for new layouts (large enough for 1000+ seats with pan/zoom). */
export const LAYOUT_VIEWBOX_DEFAULT = { width: 2400, height: 1600 };

/** Minimum rendered canvas from seat count - keeps placement room as maps grow. */
function minimumCanvasForLayout(layout: SeatLayoutDocument): { width: number; height: number } {
  const seats = countLayoutSeats(layout);
  if (seats > 800) return { width: 3600, height: 2800 };
  if (seats > 400) return { width: 2800, height: 2000 };
  if (seats > 150) return { width: 2000, height: 1400 };
  return LAYOUT_VIEWBOX_DEFAULT;
}

/** Expand viewBox to fit all sections (large venue maps). */
export function computeLayoutExtents(layout: SeatLayoutDocument, padding = 48) {
  const floor = minimumCanvasForLayout(layout);
  let maxX = Math.max(layout.viewBox.width, floor.width);
  let maxY = Math.max(layout.viewBox.height, floor.height);

  for (const lm of layout.landmarks) {
    if (lm.type === "STAGE_ROUND" && lm.radius) {
      maxX = Math.max(maxX, lm.x + lm.radius);
      maxY = Math.max(maxY, lm.y + lm.radius);
    } else {
      maxX = Math.max(maxX, lm.x + (lm.width ?? 120));
      maxY = Math.max(maxY, lm.y + (lm.height ?? 48));
    }
  }

  for (const section of layout.sections) {
    const b = getSectionBounds(section, layout);
    const ox = b.boxX ?? section.x - 4;
    const oy = b.boxY ?? section.y - 16;
    maxX = Math.max(maxX, ox + b.w + 8);
    maxY = Math.max(maxY, oy + b.h + 24);
  }

  for (const zone of getVenueZones(layout)) {
    maxX = Math.max(maxX, zone.x + zone.width + 8);
    maxY = Math.max(maxY, zone.y + zone.height + 24);
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(maxX + padding, layout.viewBox.width),
    height: Math.max(maxY + padding, layout.viewBox.height),
  };
}

/** Place a new block without overlapping existing sections. */
export function suggestSectionPlacement(
  layout: SeatLayoutDocument,
  bounds: SectionBounds,
  gap = 32
): { x: number; y: number } {
  let minY = 140;
  for (const lm of layout.landmarks) {
    if (lm.type === "STAGE_ROUND" && lm.radius) {
      minY = Math.max(minY, lm.y + lm.radius + gap);
    } else {
      minY = Math.max(minY, lm.y + (lm.height ?? 48) + gap);
    }
  }

  if (layout.sections.length === 0) {
    return { x: 80, y: minY };
  }

  let maxBottom = minY;
  for (const s of layout.sections) {
    const b = getSectionBounds(s);
    maxBottom = Math.max(maxBottom, s.y + b.h);
  }

  const last = layout.sections[layout.sections.length - 1]!;
  const lastBounds = getSectionBounds(last);
  const rightX = last.x + lastBounds.w + gap;
  const extents = computeLayoutExtents(layout, 0);
  if (rightX + bounds.w <= extents.width - gap) {
    return { x: rightX, y: last.y };
  }

  return { x: 80, y: maxBottom + gap };
}

/** Place a new venue area below stage / beside existing areas. */
export function suggestVenueZonePlacement(
  layout: SeatLayoutDocument,
  width: number,
  height: number,
  gap = 40
): { x: number; y: number } {
  let minY = 140;
  for (const lm of layout.landmarks) {
    if (lm.type === "STAGE_ROUND" && lm.radius) {
      minY = Math.max(minY, lm.y + lm.radius + gap);
    } else {
      minY = Math.max(minY, lm.y + (lm.height ?? 48) + gap);
    }
  }

  const zones = getVenueZones(layout);
  if (zones.length === 0) {
    return { x: 60, y: minY };
  }

  let maxBottom = minY;
  for (const zone of zones) {
    maxBottom = Math.max(maxBottom, zone.y + zone.height);
  }

  const last = zones[zones.length - 1]!;
  const rightX = last.x + last.width + gap;
  const extents = computeLayoutExtents(layout, 0);
  if (rightX + width <= extents.width - gap) {
    return { x: rightX, y: last.y };
  }

  return { x: 60, y: maxBottom + gap };
}

/** Place seat blocks inside a venue area when one is selected. */
export function suggestSectionPlacementInZone(
  layout: SeatLayoutDocument,
  bounds: SectionBounds,
  zoneId: string | null | undefined,
  gap = 24
): { x: number; y: number } {
  const zones = getVenueZones(layout);
  const zone = zoneId ? zones.find((z) => z.id === zoneId) : undefined;
  if (!zone) return suggestSectionPlacement(layout, bounds, gap);

  const inZone = layout.sections.filter((s) => s.zoneId === zoneId);
  const innerTop = zone.y + 28 + gap;
  let maxBottom = innerTop;

  for (const s of inZone) {
    const b = getSectionBounds(s);
    maxBottom = Math.max(maxBottom, s.y + b.h);
    const rightX = s.x + b.w + gap;
    if (
      rightX + bounds.w <= zone.x + zone.width - gap &&
      s.y + b.h <= zone.y + zone.height - gap
    ) {
      return { x: rightX, y: s.y };
    }
  }

  const x = zone.x + gap;
  const y = inZone.length === 0 ? innerTop : maxBottom + gap;
  return { x, y };
}

function normalizeSection(section: LayoutSection): LayoutSection {
  let rowColCounts = section.rowColCounts;
  if (typeof rowColCounts === "string") {
    rowColCounts = parseRowColCounts(rowColCounts);
  }
  return {
    ...section,
    enabled: section.enabled ?? true,
    rows: Math.max(1, section.rows ?? 1),
    cols: Math.max(1, section.cols ?? 1),
    rowColCounts,
  };
}

export function normalizeLayout(doc: SeatLayoutDocument): SeatLayoutDocument {
  const normalized: SeatLayoutDocument = {
    version: 1,
    name: doc.name ?? "Custom layout",
    viewBox: doc.viewBox ?? LAYOUT_VIEWBOX_DEFAULT,
    orientation: doc.orientation ?? "FRONT",
    landmarks: doc.landmarks ?? [],
    zones: doc.zones ?? [],
    categories: (doc.categories ?? []).map((c, i) => ({
      id: c.id,
      name: c.name ?? `Tier ${i + 1}`,
      color: c.color ?? "#3b82f6",
      price: Math.round(Number(c.price) || 0),
      enabled: c.enabled ?? true,
      sortOrder: c.sortOrder ?? i,
    })),
    sections: (doc.sections ?? []).map(normalizeSection),
    naming: {
      rowScheme: doc.naming?.rowScheme ?? "LETTERS",
      colScheme: doc.naming?.colScheme ?? "NUMBERS",
      separator: doc.naming?.separator ?? "",
      rowStart: doc.naming?.rowStart ?? 1,
      colStart: doc.naming?.colStart ?? 1,
    },
  };

  if (!normalized.categories.length) {
    normalized.categories = blankLayout().categories;
  }

  const extents = computeLayoutExtents(normalized, 64);
  normalized.viewBox = { width: extents.width, height: extents.height };

  return normalized;
}

export function parseLayoutJson(raw: string): SeatLayoutDocument {
  if (!raw?.trim()) {
    return blankLayout();
  }

  let doc: SeatLayoutDocument;
  try {
    doc = JSON.parse(raw) as SeatLayoutDocument;
  } catch {
    throw new Error("Invalid seat layout JSON");
  }

  return normalizeLayout({ ...doc, version: 1 });
}

export function serializeLayout(doc: SeatLayoutDocument): string {
  return JSON.stringify(normalizeLayout(doc));
}

export function enumerateSectionSeats(
  section: LayoutSection,
  layout: SeatLayoutDocument
): LayoutSeat[] {
  if (section.kind === "TABLE") {
    const pack = getTablePackSize(section);
    const overrideMap = new Map(
      (section.seats ?? []).map((s) => [`${s.rowIndex}:${s.colIndex}`, s])
    );
    const seats: LayoutSeat[] = [];
    for (let i = 0; i < pack; i++) {
      const key = `0:${i}`;
      const override = overrideMap.get(key);
      const id = override?.id ?? `${section.id}-s${i}`;
      seats.push({
        id,
        rowIndex: 0,
        colIndex: i,
        label: override?.label ?? tableSeatLabel(section.name, i),
        categoryId: override?.categoryId ?? section.categoryId,
        enabled: override?.enabled ?? section.enabled,
      });
    }
    return seats;
  }

  const overrideMap = new Map(
    (section.seats ?? []).map((s) => [`${s.rowIndex}:${s.colIndex}`, s])
  );
  const seats: LayoutSeat[] = [];

  for (let r = 0; r < section.rows; r++) {
    const cols = getRowColCount(section, r);
    for (let c = 0; c < cols; c++) {
      const key = `${r}:${c}`;
      const override = overrideMap.get(key);
      const id = override?.id ?? `${section.id}-r${r}-c${c}`;
      const enabled = override?.enabled ?? section.enabled;
      const label =
        override?.label ?? seatLabelForSection(section, r, c, layout);
      seats.push({
        id,
        rowIndex: r,
        colIndex: c,
        label,
        categoryId: override?.categoryId ?? section.categoryId,
        enabled,
      });
    }
  }
  return seats;
}

export function flattenLayoutSeats(layout: SeatLayoutDocument): Array<
  LayoutSeat & { sectionId: string; tableId?: string }
> {
  const all: Array<LayoutSeat & { sectionId: string; tableId?: string }> = [];
  for (const section of layout.sections) {
    if (!section.enabled) continue;
    const seats = enumerateSectionSeats(section, layout);
    for (const seat of seats) {
      if (!seat.enabled) continue;
      all.push({
        ...seat,
        sectionId: section.id,
        tableId: section.kind === "TABLE" ? section.id : undefined,
      });
    }
  }
  return all;
}

export function newLayoutId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function blankLayout(name = "Custom layout"): SeatLayoutDocument {
  const vw = LAYOUT_VIEWBOX_DEFAULT.width;
  return {
    version: 1,
    name,
    viewBox: { ...LAYOUT_VIEWBOX_DEFAULT },
    orientation: "FRONT",
    landmarks: [
      {
        id: "stage",
        type: "STAGE_BOX",
        label: "Stage",
        x: Math.round(vw / 2 - 200),
        y: 48,
        width: 400,
        height: 88,
      },
    ],
    categories: [
      {
        id: "cat-standard",
        name: "Standard",
        color: "#3b82f6",
        price: 250000,
        enabled: true,
        sortOrder: 0,
      },
    ],
    zones: [],
    sections: [],
    naming: {
      rowScheme: "LETTERS",
      colScheme: "NUMBERS",
      separator: "",
    },
  };
}
