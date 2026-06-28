import type { LayoutLandmark, LayoutSection, LayoutVenueZone } from "./types";
import { getSectionMaxCols } from "./section-helpers";

type ResizeHandle = "resize-nw" | "resize-ne" | "resize-se" | "resize-sw";

export function resizeSection(
  section: LayoutSection,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Partial<LayoutSection> {
  const sw = section.seatWidth ?? 22;
  const sh = section.seatHeight ?? 22;
  const cg = section.colGap ?? 4;
  const rg = section.rowGap ?? 4;
  const cellW = sw + cg;
  const cellH = sh + rg;

  const dCols = Math.round(dx / cellW);
  const dRows = Math.round(dy / cellH);

  if (section.rowColCounts?.length && section.rowLayout === "CURVED") {
    return {
      curveInnerRadius: Math.max(40, Math.round((section.curveInnerRadius ?? 120) + dy * 0.5)),
      rowColCounts: section.rowColCounts.map((n) =>
        Math.max(1, Math.min(40, n + dCols))
      ),
      cols: Math.max(
        ...section.rowColCounts.map((n) => Math.max(1, n + dCols))
      ),
    };
  }

  let cols = section.cols;
  let rows = section.rows;
  let x = section.x;
  let y = section.y;

  switch (handle) {
    case "resize-se":
      cols = Math.max(1, Math.min(120, section.cols + dCols));
      rows = Math.max(1, Math.min(120, section.rows + dRows));
      break;
    case "resize-sw":
      cols = Math.max(1, Math.min(120, section.cols - dCols));
      rows = Math.max(1, Math.min(120, section.rows + dRows));
      x = section.x + dCols * cellW;
      break;
    case "resize-ne":
      cols = Math.max(1, Math.min(120, section.cols + dCols));
      rows = Math.max(1, Math.min(120, section.rows - dRows));
      y = section.y + dRows * cellH;
      break;
    case "resize-nw":
      cols = Math.max(1, Math.min(120, section.cols - dCols));
      rows = Math.max(1, Math.min(120, section.rows - dRows));
      x = section.x + dCols * cellW;
      y = section.y + dRows * cellH;
      break;
  }

  const patch: Partial<LayoutSection> = { cols, rows, x, y };
  if (section.rowColCounts?.length) {
    const max = getSectionMaxCols({ ...section, cols, rows });
    patch.rowColCounts = section.rowColCounts.map(() => max);
  }
  if (section.curveInnerRadius != null) {
    patch.curveInnerRadius = Math.max(40, section.curveInnerRadius + dy * 0.35);
  }
  return patch;
}

export function rotateTarget(
  currentDeg: number,
  cx: number,
  cy: number,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): number {
  const startAngle = Math.atan2(startY - cy, startX - cx);
  const curAngle = Math.atan2(currentY - cy, currentX - cx);
  const delta = ((curAngle - startAngle) * 180) / Math.PI;
  const next = Math.round((currentDeg + delta) * 2) / 2;
  return ((next % 360) + 360) % 360;
}

export function resizeZoneRect(
  zone: LayoutVenueZone,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Partial<LayoutVenueZone> {
  const minW = 80;
  const minH = 60;
  switch (handle) {
    case "resize-se":
      return {
        width: Math.max(minW, zone.width + dx),
        height: Math.max(minH, zone.height + dy),
      };
    case "resize-sw":
      return {
        x: zone.x + dx,
        width: Math.max(minW, zone.width - dx),
        height: Math.max(minH, zone.height + dy),
      };
    case "resize-ne":
      return {
        y: zone.y + dy,
        width: Math.max(minW, zone.width + dx),
        height: Math.max(minH, zone.height - dy),
      };
    case "resize-nw":
      return {
        x: zone.x + dx,
        y: zone.y + dy,
        width: Math.max(minW, zone.width - dx),
        height: Math.max(minH, zone.height - dy),
      };
  }
}

export function resizeLandmark(
  lm: LayoutLandmark,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Partial<LayoutLandmark> {
  if (lm.type === "STAGE_ROUND") {
    const delta = Math.max(dx, dy);
    return { radius: Math.max(24, (lm.radius ?? 80) + delta * 0.5) };
  }
  const w = lm.width ?? 120;
  const h = lm.height ?? 48;
  switch (handle) {
    case "resize-se":
      return { width: Math.max(40, w + dx), height: Math.max(24, h + dy) };
    case "resize-sw":
      return {
        x: lm.x + dx,
        width: Math.max(40, w - dx),
        height: Math.max(24, h + dy),
      };
    case "resize-ne":
      return {
        y: lm.y + dy,
        width: Math.max(40, w + dx),
        height: Math.max(24, h - dy),
      };
    case "resize-nw":
      return {
        x: lm.x + dx,
        y: lm.y + dy,
        width: Math.max(40, w - dx),
        height: Math.max(24, h - dy),
      };
  }
}

export function landmarkBounds(lm: LayoutLandmark) {
  if (lm.type === "STAGE_ROUND" && lm.radius) {
    const r = lm.radius;
    return { x: lm.x - r, y: lm.y - r, w: r * 2, h: r * 2 };
  }
  return { x: lm.x, y: lm.y, w: lm.width ?? 120, h: lm.height ?? 48 };
}

export function zoneRectBounds(zone: LayoutVenueZone) {
  return { x: zone.x, y: zone.y, w: zone.width, h: zone.height };
}
