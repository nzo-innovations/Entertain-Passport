import type { ColNamingScheme, NamingScheme, RowNamingScheme, LayoutSection } from "./types";

function letterAt(index: number, reverse = false): string {
  const n = reverse ? 25 - (index % 26) : index % 26;
  return String.fromCharCode(65 + n);
}

export function formatRowLabel(index: number, scheme: RowNamingScheme, start = 1): string {
  if (scheme === "NUMBERS") return String(start + index);
  if (scheme === "LETTERS_REVERSE") return letterAt(index, true);
  return letterAt(index);
}

export function formatColLabel(index: number, scheme: ColNamingScheme, start = 1): string {
  if (scheme === "LETTERS") return letterAt(index);
  return String(start + index);
}

export function seatLabelFromIndices(
  rowIndex: number,
  colIndex: number,
  naming: NamingScheme,
  overrides?: Partial<NamingScheme>
): string {
  const merged: NamingScheme = {
    rowScheme: overrides?.rowScheme ?? naming.rowScheme,
    colScheme: overrides?.colScheme ?? naming.colScheme,
    rowStart: overrides?.rowStart ?? naming.rowStart ?? 1,
    colStart: overrides?.colStart ?? naming.colStart ?? 1,
    separator: overrides?.separator ?? naming.separator ?? "",
  };
  const row = formatRowLabel(rowIndex, merged.rowScheme, merged.rowStart);
  const col = formatColLabel(colIndex, merged.colScheme, merged.colStart);
  return `${row}${merged.separator}${col}`;
}

/** Full label including section prefix and naming offset (L1-S2-A1). */
export function seatLabelForSection(
  section: LayoutSection,
  rowIndex: number,
  colIndex: number,
  layout: { naming: NamingScheme }
): string {
  const rowOff = section.namingOffset?.row ?? 0;
  const colOff = section.namingOffset?.col ?? 0;
  const base = seatLabelFromIndices(rowIndex, colIndex, layout.naming, {
    ...section.rowNaming,
    rowStart: (section.rowNaming?.rowStart ?? layout.naming.rowStart ?? 1) + rowOff,
    colStart: (section.rowNaming?.colStart ?? layout.naming.colStart ?? 1) + colOff,
  });
  if (section.labelPrefix?.trim()) {
    const sep = layout.naming.separator || "-";
    return `${section.labelPrefix.trim()}${sep}${base}`;
  }
  return base;
}

export function defaultNaming(): NamingScheme {
  return {
    rowScheme: "LETTERS",
    colScheme: "NUMBERS",
    rowStart: 1,
    colStart: 1,
    separator: "",
  };
}
