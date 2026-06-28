import type { LayoutSection, LayoutOrientation, SeatLayoutDocument, SeatRowLayout } from "./types";
import { getRowColCount, getSectionMaxCols } from "./section-helpers";

export type GridSeatPosition = {
  x: number;
  y: number;
  /** Degrees - seats face the stage / focal point when curved. */
  rotate: number;
};

/** Front = straight rows; any fan / in-the-round angle = curved rows. */
export function defaultRowLayoutForOrientation(orientation: LayoutOrientation): SeatRowLayout {
  return orientation === "FRONT" ? "STRAIGHT" : "CURVED";
}

export function orientationSpanDegrees(orientation: LayoutOrientation): number {
  if (orientation === "FRONT") return 0;
  return Number(orientation);
}

export function isCurvedOrientation(orientation: LayoutOrientation): boolean {
  return orientation !== "FRONT";
}

export function resolveRowLayout(section: LayoutSection, layout: SeatLayoutDocument): SeatRowLayout {
  if (section.rowLayout === "STRAIGHT" || section.rowLayout === "CURVED") {
    return section.rowLayout;
  }
  return defaultRowLayoutForOrientation(layout.orientation);
}

export function rowLayoutLabel(layout: SeatRowLayout): string {
  return layout === "CURVED" ? "Curved rows" : "Straight rows";
}

/** Stage / focal point seats arc toward. */
export function getLayoutFocal(layout: SeatLayoutDocument): { x: number; y: number } {
  const round = layout.landmarks.find((l) => l.type === "STAGE_ROUND");
  if (round) return { x: round.x, y: round.y };

  const box = layout.landmarks.find((l) => l.type === "STAGE_BOX");
  if (box) {
    return {
      x: box.x + (box.width ?? 200) / 2,
      y: box.y + (box.height ?? 60) / 2,
    };
  }

  return { x: layout.viewBox.width / 2, y: 72 };
}

function straightGridWidth(section: LayoutSection): number {
  const sw = section.seatWidth ?? 22;
  const cg = section.colGap ?? 4;
  const maxCols = getSectionMaxCols(section);
  return maxCols * sw + Math.max(0, maxCols - 1) * cg + (section.aisleGap ?? 0);
}

function straightColX(section: LayoutSection, rowIndex: number, colIndex: number): number {
  const sw = section.seatWidth ?? 22;
  const cg = section.colGap ?? 4;
  const rowCols = getRowColCount(section, rowIndex);
  const maxCols = getSectionMaxCols(section);
  const centerPad = ((maxCols - rowCols) * (sw + cg)) / 2;
  let x = centerPad + colIndex * (sw + cg);
  if (section.aisleAfterCol != null && colIndex > section.aisleAfterCol) {
    x += section.aisleGap ?? 24;
  }
  return x;
}

export function getGridSeatPosition(
  section: LayoutSection,
  rowIndex: number,
  colIndex: number,
  layout: SeatLayoutDocument
): GridSeatPosition {
  const sw = section.seatWidth ?? 22;
  const sh = section.seatHeight ?? 22;
  const rg = section.rowGap ?? 4;
  const cg = section.colGap ?? 4;

  if (resolveRowLayout(section, layout) === "STRAIGHT") {
    return {
      x: section.x + straightColX(section, rowIndex, colIndex),
      y: section.y + rowIndex * (sh + rg),
      rotate: 0,
    };
  }

  const focal = getLayoutFocal(layout);
  const spanDeg = section.curveSpanDeg ?? orientationSpanDegrees(layout.orientation);
  const spanRad = (Math.max(spanDeg, 20) * Math.PI) / 180;

  const rowSpacing = sh + rg;

  let centerBearing: number;
  let baseDist: number;

  if (section.curveBearingDeg != null) {
    centerBearing = (section.curveBearingDeg * Math.PI) / 180;
    baseDist = section.curveInnerRadius ?? 120;
  } else {
    const anchorX = section.x + straightGridWidth(section) / 2;
    const anchorY = section.y + sh / 2;
    const dx = anchorX - focal.x;
    const dy = anchorY - focal.y;
    centerBearing = Math.atan2(dx, Math.max(dy, 1));
    baseDist = Math.hypot(dx, dy) || 120;
  }

  const radius = baseDist + rowIndex * rowSpacing;

  const cols = getRowColCount(section, rowIndex);
  const t = cols <= 1 ? 0.5 : colIndex / (cols - 1);
  const angle = centerBearing - spanRad / 2 + t * spanRad;

  const cx = focal.x + radius * Math.sin(angle);
  const cy = focal.y + radius * Math.cos(angle);
  const x = cx - sw / 2;
  const y = cy - sh / 2;

  const rotateRad = Math.atan2(focal.x - cx, focal.y - cy);
  const rotate = (rotateRad * 180) / Math.PI;

  return { x, y, rotate };
}

export function getCurvedSectionBBox(
  section: LayoutSection,
  layout: SeatLayoutDocument
): { minX: number; minY: number; maxX: number; maxY: number } {
  const sw = section.seatWidth ?? 22;
  const sh = section.seatHeight ?? 22;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let r = 0; r < section.rows; r++) {
    const cols = getRowColCount(section, r);
    for (let c = 0; c < cols; c++) {
      const p = getGridSeatPosition(section, r, c, layout);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + sw);
      maxY = Math.max(maxY, p.y + sh);
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: section.x, minY: section.y, maxX: section.x + 40, maxY: section.y + 40 };
  }

  return { minX, minY, maxX, maxY };
}
