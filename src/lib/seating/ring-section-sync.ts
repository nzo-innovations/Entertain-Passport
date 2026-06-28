import type { LayoutSection, LayoutVenueZone, SeatLayoutDocument } from "./types";
import { getLayoutFocal, resolveRowLayout } from "./row-layout";
import { isWedgeZone } from "./round-zones";
import { getSectionMaxCols } from "./section-helpers";

export function isRingCurvedSection(
  section: LayoutSection,
  layout: SeatLayoutDocument,
  zone?: LayoutVenueZone | null
): boolean {
  if (resolveRowLayout(section, layout) !== "CURVED") return false;
  if (section.curveBearingDeg != null) return true;
  if (zone && isWedgeZone(zone)) return true;
  if (section.zoneId) {
    const z = layout.zones?.find((w) => w.id === section.zoneId);
    if (z && isWedgeZone(z)) return true;
  }
  return layout.orientation === "360";
}

export function wedgeMidDeg(zone: LayoutVenueZone): number {
  const start = zone.wedgeStartDeg ?? 0;
  const end = zone.wedgeEndDeg ?? 90;
  return (start + end) / 2;
}

export function wedgeSpanDeg(zone: LayoutVenueZone): number {
  const start = zone.wedgeStartDeg ?? 0;
  const end = zone.wedgeEndDeg ?? 90;
  return Math.max(15, end - start);
}

/** Map a ring wedge zone → curved section geometry (seats follow the wedge arc). */
export function sectionGeometryFromZone(
  section: LayoutSection,
  zone: LayoutVenueZone,
  _layout: SeatLayoutDocument
): Partial<LayoutSection> {
  const inner = (zone.innerRadius ?? 80) + 12;
  const mid = wedgeMidDeg(zone);
  const span = wedgeSpanDeg(zone);
  const rows = section.rows || 3;
  const defaultCounts = section.rowColCounts?.length
    ? section.rowColCounts
    : Array.from({ length: rows }, (_, i) => section.cols + i * 2);

  return {
    zoneId: zone.id,
    rowLayout: "CURVED",
    curveBearingDeg: mid,
    curveInnerRadius: inner,
    curveSpanDeg: span,
    rotateDeg: 0,
    rowColCounts: defaultCounts,
    cols: getSectionMaxCols({ ...section, rowColCounts: defaultCounts }),
    categoryId: section.categoryId || zone.categoryId || section.categoryId,
  };
}

export function snapSectionToZone(
  section: LayoutSection,
  zone: LayoutVenueZone,
  layout: SeatLayoutDocument
): LayoutSection {
  return { ...section, ...sectionGeometryFromZone(section, zone, layout) };
}

/** After a wedge zone is edited, realign every section in that zone. */
export function syncSectionsInZone(
  layout: SeatLayoutDocument,
  zoneId: string
): LayoutSection[] {
  const zone = layout.zones?.find((z) => z.id === zoneId);
  if (!zone || !isWedgeZone(zone)) return layout.sections;

  return layout.sections.map((sec) =>
    sec.zoneId === zoneId ? snapSectionToZone(sec, zone, layout) : sec
  );
}

export function syncAllRingSections(layout: SeatLayoutDocument): LayoutSection[] {
  return layout.sections.map((sec) => {
    if (!sec.zoneId) return sec;
    const zone = layout.zones?.find((z) => z.id === sec.zoneId);
    if (!zone || !isWedgeZone(zone) || resolveRowLayout(sec, layout) !== "CURVED") {
      return sec;
    }
    return snapSectionToZone(sec, zone, layout);
  });
}

/** Move a ring section by polar delta (drag on canvas). */
export function moveRingSectionPolar(
  section: LayoutSection,
  layout: SeatLayoutDocument,
  deltaX: number,
  deltaY: number
): Partial<LayoutSection> {
  const focal = getLayoutFocal(layout);
  const bearing = section.curveBearingDeg ?? 0;
  const rad = (bearing * Math.PI) / 180;
  const sh = section.seatHeight ?? 18;
  const rg = section.rowGap ?? 4;
  const midRow = ((section.rows - 1) * (sh + rg)) / 2;
  const midR = (section.curveInnerRadius ?? 120) + midRow;

  const oldCx = focal.x + midR * Math.sin(rad);
  const oldCy = focal.y + midR * Math.cos(rad);
  const newCx = oldCx + deltaX;
  const newCy = oldCy + deltaY;

  const dx = newCx - focal.x;
  const dy = newCy - focal.y;
  const newBearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  const newMidR = Math.hypot(dx, dy);
  const newInner = Math.max(40, newMidR - midRow);

  return {
    curveBearingDeg: Math.round(newBearing * 10) / 10,
    curveInnerRadius: Math.round(newInner),
    rotateDeg: 0,
  };
}

/** Rotate handle → spin section around stage (bearing change). */
export function rotateRingSection(
  section: LayoutSection,
  deltaDeg: number
): Partial<LayoutSection> {
  const base = section.curveBearingDeg ?? 0;
  return {
    curveBearingDeg: ((base + deltaDeg) % 360 + 360) % 360,
    rotateDeg: 0,
  };
}

export function createRingSectionForZone(
  zone: LayoutVenueZone,
  layout: SeatLayoutDocument,
  opts?: { rows?: number; rowColCounts?: number[]; name?: string }
): LayoutSection {
  const id = `sec-${Date.now().toString(36)}`;
  const rowColCounts = opts?.rowColCounts ?? [6, 8, 10];
  const rows = opts?.rows ?? rowColCounts.length;
  const base: LayoutSection = {
    id,
    name: opts?.name ?? zone.name,
    enabled: true,
    kind: "GRID",
    categoryId: zone.categoryId ?? layout.categories[0]?.id ?? "cat-standard",
    zoneId: zone.id,
    x: 0,
    y: 0,
    rows,
    cols: Math.max(...rowColCounts),
    rowColCounts,
    rowGap: 5,
    colGap: 4,
    seatWidth: 18,
    seatHeight: 18,
    seatShape: "ROUND",
    rowLayout: "CURVED",
  };
  return snapSectionToZone(base, zone, layout);
}

/** Sections belonging to a wedge (excludes standing). */
export function sectionsInZone(layout: SeatLayoutDocument, zoneId: string) {
  return layout.sections.filter((s) => s.zoneId === zoneId);
}
