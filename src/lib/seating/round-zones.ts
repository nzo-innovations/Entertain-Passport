import type { LayoutVenueZone, SeatLayoutDocument } from "./types";
import { getLayoutFocal } from "./row-layout";

export function isInTheRound(layout: SeatLayoutDocument): boolean {
  return layout.orientation === "360";
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy + r * Math.cos(rad) };
}

/** SVG path for a ring wedge (degrees, 0 = down, clockwise). */
export function wedgeSvgPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  const span = endDeg - startDeg;
  const large = span > 180 ? 1 : 0;
  const p1 = polar(cx, cy, innerR, startDeg);
  const p2 = polar(cx, cy, outerR, startDeg);
  const p3 = polar(cx, cy, outerR, endDeg);
  const p4 = polar(cx, cy, innerR, endDeg);
  return [
    `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
    `L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`,
    `L ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
    "Z",
  ].join(" ");
}

export function wedgeBBox(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
) {
  const pts: { x: number; y: number }[] = [];
  for (let d = startDeg; d <= endDeg; d += Math.max(4, (endDeg - startDeg) / 12)) {
    pts.push(polar(cx, cy, innerR, d), polar(cx, cy, outerR, d));
  }
  pts.push(polar(cx, cy, innerR, endDeg), polar(cx, cy, outerR, endDeg));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function isStandingZone(zone: LayoutVenueZone): boolean {
  return zone.kind === "STANDING";
}

export function isWedgeZone(zone: LayoutVenueZone): boolean {
  return zone.shape === "WEDGE" || (zone.wedgeStartDeg != null && zone.wedgeEndDeg != null);
}

export function suggestRoundWedgeZone(
  layout: SeatLayoutDocument,
  spanDeg = 45
): Omit<LayoutVenueZone, "id" | "name" | "sortOrder"> {
  const focal = getLayoutFocal(layout);
  const stageR =
    layout.landmarks.find((l) => l.type === "STAGE_ROUND")?.radius ?? 90;
  const wedges = (layout.zones ?? []).filter((z) => z.shape === "WEDGE" && z.kind !== "STANDING");
  const idx = wedges.length;
  const startDeg = idx * spanDeg;
  const innerR = stageR + 24;
  const outerR = innerR + 160;

  return {
    kind: "RING",
    shape: "WEDGE",
    x: focal.x - outerR,
    y: focal.y - outerR,
    width: outerR * 2,
    height: outerR * 2,
    wedgeStartDeg: startDeg,
    wedgeEndDeg: startDeg + spanDeg,
    innerRadius: innerR,
    outerRadius: outerR,
  };
}

export function suggestStandingZone(
  layout: SeatLayoutDocument,
  capacity = 200
): Omit<LayoutVenueZone, "id" | "name" | "sortOrder"> {
  const focal = getLayoutFocal(layout);
  const stageR =
    layout.landmarks.find((l) => l.type === "STAGE_ROUND")?.radius ?? 90;

  if (isInTheRound(layout)) {
    const innerR = stageR + 8;
    const outerR = stageR + 72;
    return {
      kind: "STANDING",
      shape: "WEDGE",
      capacity,
      x: focal.x - outerR,
      y: focal.y - outerR,
      width: outerR * 2,
      height: outerR * 2,
      wedgeStartDeg: 0,
      wedgeEndDeg: 360,
      innerRadius: innerR,
      outerRadius: outerR,
    };
  }

  return {
    kind: "STANDING",
    shape: "RECT",
    capacity,
    x: focal.x - 160,
    y: focal.y + (layout.landmarks.find((l) => l.type === "STAGE_BOX")?.height ?? 80) + 16,
    width: 320,
    height: 100,
  };
}

export function zoneFocal(layout: SeatLayoutDocument, zone: LayoutVenueZone) {
  return getLayoutFocal(layout);
}
