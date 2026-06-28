import type { LayoutSection } from "./types";

/** Seat count in one row - supports expanding ring rows [6, 8, 10]. */
export function getRowColCount(section: LayoutSection, rowIndex: number): number {
  if (section.rowColCounts?.[rowIndex] != null) {
    return Math.max(1, section.rowColCounts[rowIndex]!);
  }
  return section.cols;
}

export function getSectionMaxCols(section: LayoutSection): number {
  if (section.rowColCounts?.length) {
    return Math.max(section.cols, ...section.rowColCounts);
  }
  return section.cols;
}

export function countSectionGridSeats(section: LayoutSection): number {
  if (section.kind === "TABLE") return 0;
  let n = 0;
  for (let r = 0; r < section.rows; r++) {
    n += getRowColCount(section, r);
  }
  return n;
}

export function parseRowColCounts(raw: string): number[] | undefined {
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? parts : undefined;
}

export function formatRowColCounts(counts?: number[]): string {
  return counts?.join(", ") ?? "";
}
