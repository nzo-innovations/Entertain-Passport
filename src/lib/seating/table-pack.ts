import type { LayoutSection, TablePackSize, TableSideMode } from "./types";

export const TABLE_PACK_SIZES: TablePackSize[] = [6, 8, 10, 12];

export function getTablePackSize(section: LayoutSection): TablePackSize {
  if (section.tablePackSize && TABLE_PACK_SIZES.includes(section.tablePackSize)) {
    return section.tablePackSize;
  }
  if (section.kind === "TABLE" && section.rows > 0 && section.cols > 0) {
    const n = section.rows * section.cols;
    if (TABLE_PACK_SIZES.includes(n as TablePackSize)) return n as TablePackSize;
  }
  return 8;
}

export function getTableSideMode(section: LayoutSection): TableSideMode {
  return section.tableSideMode === "FOUR" ? "FOUR" : "TWO";
}

export function tablePackLabel(pack: TablePackSize) {
  return `${pack}-pack`;
}

export function tableSideLabel(mode: TableSideMode) {
  return mode === "TWO" ? "2 sides" : "4 sides";
}

export function tableDescriptor(section: LayoutSection) {
  return `${tablePackLabel(getTablePackSize(section))}, ${tableSideLabel(getTableSideMode(section))}`;
}

export function tableSeatLabel(tableName: string, seatIndex: number) {
  const short = tableName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return `${short} · Seat ${seatIndex + 1}`;
}

function distributeFourSides(pack: number): [number, number, number, number] {
  const base = Math.floor(pack / 4);
  const rem = pack % 4;
  return [
    base + (rem > 0 ? 1 : 0),
    base + (rem > 1 ? 1 : 0),
    base + (rem > 2 ? 1 : 0),
    base,
  ];
}

export type TablePackGeometry = {
  width: number;
  height: number;
  tableCx: number;
  tableCy: number;
  tableW: number;
  tableH: number;
  tableShape: "rect" | "ellipse";
  sideMode: TableSideMode;
  seats: { x: number; y: number; index: number }[];
};

function layoutTwoSides(
  pack: TablePackSize,
  originX: number,
  originY: number,
  seatSize: number,
  gap: number
): TablePackGeometry {
  const perSide = pack / 2;
  const rowWidth = perSide * seatSize + (perSide - 1) * gap;
  const tableW = rowWidth;
  const tableH = 26;
  const pad = 10;
  const totalW = rowWidth + pad * 2;
  const totalH = pad + seatSize + gap + tableH + gap + seatSize + pad;
  const tableCx = originX + totalW / 2;
  const tableCy = originY + pad + seatSize + gap + tableH / 2;
  const startX = originX + pad;

  const seats: { x: number; y: number; index: number }[] = [];
  for (let i = 0; i < perSide; i++) {
    seats.push({
      index: i,
      x: startX + i * (seatSize + gap),
      y: originY + pad,
    });
  }
  for (let i = 0; i < perSide; i++) {
    seats.push({
      index: perSide + i,
      x: startX + i * (seatSize + gap),
      y: originY + pad + seatSize + gap + tableH + gap,
    });
  }

  return {
    width: totalW,
    height: totalH,
    tableCx,
    tableCy,
    tableW,
    tableH,
    tableShape: "rect",
    sideMode: "TWO",
    seats,
  };
}

function layoutFourSides(
  pack: TablePackSize,
  originX: number,
  originY: number,
  seatSize: number,
  gap: number
): TablePackGeometry {
  const [top, right, bottom, left] = distributeFourSides(pack);
  const maxHoriz = Math.max(top, bottom);
  const maxVert = Math.max(left, right);
  const tableW = Math.max(maxHoriz * (seatSize + gap) - gap, 60);
  const tableH = Math.max(maxVert * (seatSize + gap) - gap, 40);
  const pad = 10;
  const totalW = tableW + pad * 2 + (seatSize + gap) * 2;
  const totalH = tableH + pad * 2 + (seatSize + gap) * 2;
  const tableCx = originX + totalW / 2;
  const tableCy = originY + totalH / 2;

  const seats: { x: number; y: number; index: number }[] = [];
  let idx = 0;

  const placeRow = (count: number, x0: number, y0: number, horizontal: boolean) => {
    for (let i = 0; i < count; i++) {
      seats.push({
        index: idx++,
        x: horizontal ? x0 + i * (seatSize + gap) : x0,
        y: horizontal ? y0 : y0 + i * (seatSize + gap),
      });
    }
  };

  const topY = originY + pad;
  const topX = tableCx - ((top * (seatSize + gap) - gap) / 2);
  placeRow(top, topX, topY, true);

  const rightX = originX + totalW - pad - seatSize;
  const rightY = tableCy - ((right * (seatSize + gap) - gap) / 2);
  placeRow(right, rightX, rightY, false);

  const bottomY = originY + totalH - pad - seatSize;
  const bottomX = tableCx - ((bottom * (seatSize + gap) - gap) / 2);
  placeRow(bottom, bottomX, bottomY, true);

  const leftX = originX + pad;
  const leftY = tableCy - ((left * (seatSize + gap) - gap) / 2);
  placeRow(left, leftX, leftY, false);

  return {
    width: totalW,
    height: totalH,
    tableCx,
    tableCy,
    tableW,
    tableH,
    tableShape: "rect",
    sideMode: "FOUR",
    seats,
  };
}

/** Seat positions around a central table (origin = top-left of bounding box). */
export function getTablePackLayout(
  section: LayoutSection,
  seatSize = section.seatWidth ?? 20
): TablePackGeometry {
  const pack = getTablePackSize(section);
  const sideMode = getTableSideMode(section);
  const gap = section.colGap ?? 4;
  const { x: originX, y: originY } = section;

  if (sideMode === "TWO") {
    return layoutTwoSides(pack, originX, originY, seatSize, gap);
  }
  return layoutFourSides(pack, originX, originY, seatSize, gap);
}

export function createTableSection(
  id: string,
  name: string,
  pack: TablePackSize,
  categoryId: string,
  x: number,
  y: number,
  sideMode: TableSideMode = "TWO"
): LayoutSection {
  return {
    id,
    name: `${name} (${tablePackLabel(pack)}, ${tableSideLabel(sideMode)})`,
    enabled: true,
    kind: "TABLE",
    categoryId,
    tablePackSize: pack,
    tableSideMode: sideMode,
    x,
    y,
    rows: 1,
    cols: pack,
    colGap: 4,
    seatWidth: 20,
    seatHeight: 20,
  };
}
