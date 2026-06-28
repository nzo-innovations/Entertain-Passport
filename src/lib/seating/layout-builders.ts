import type { LayoutSection, LayoutVenueZone, SeatLayoutDocument } from "./types";
import { newLayoutId } from "./layout-utils";
import { wedgeSvgPath } from "./round-zones";
import { snapSectionToZone } from "./ring-section-sync";
import { createTableSection } from "./table-pack";

const CAT = "cat-standard";
const CAT_T2 = "cat-tier2";

function ids() {
  return {
    stage: newLayoutId("stage"),
    ground: newLayoutId("floor"),
    zone1: newLayoutId("zone"),
    zone2: newLayoutId("zone"),
    balcony: newLayoutId("balc"),
    stand: newLayoutId("stand"),
    sec: () => newLayoutId("sec"),
    wedge: () => newLayoutId("area"),
  };
}

/**
 * Theatre sketch: stage, ground floor (Zone 1 tables + Zone 2 rows + stand-up),
 * balcony rows F–G with centre aisle.
 */
export function buildTheatreGroundBalconyLayout(name = "Theatre - ground + balcony"): SeatLayoutDocument {
  const id = ids();
  const catTier2 = CAT_T2;

  const ground: LayoutVenueZone = {
    id: id.ground,
    name: "Ground Floor",
    kind: "GROUND",
    x: 40,
    y: 130,
    width: 520,
    height: 380,
    sortOrder: 0,
  };

  const zone1: LayoutVenueZone = {
    id: id.zone1,
    name: "Zone 1 - Tables",
    kind: "CUSTOM",
    parentZoneId: id.ground,
    x: 60,
    y: 150,
    width: 480,
    height: 120,
    sortOrder: 1,
  };

  const zone2: LayoutVenueZone = {
    id: id.zone2,
    name: "Zone 2 - Rows",
    kind: "CUSTOM",
    parentZoneId: id.ground,
    x: 60,
    y: 280,
    width: 480,
    height: 210,
    sortOrder: 2,
  };

  const standing: LayoutVenueZone = {
    id: id.stand,
    name: "Stand up",
    kind: "STANDING",
    parentZoneId: id.zone2,
    x: 300,
    y: 340,
    width: 220,
    height: 130,
    capacity: 200,
    categoryId: CAT,
    sortOrder: 3,
  };

  const balcony: LayoutVenueZone = {
    id: id.balcony,
    name: "Balcony",
    kind: "BALCONY",
    x: 80,
    y: 530,
    width: 440,
    height: 100,
    sortOrder: 4,
  };

  const tables: LayoutSection[] = [];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const secId = id.sec();
    tables.push({
      ...createTableSection(
        secId,
        `Table ${i + 1}`,
        8,
        catTier2,
        100 + col * 220 + (col === 1 ? 20 : 0),
        165 + row * 52,
        "TWO"
      ),
      zoneId: id.zone1,
      seatShape: i % 2 === 0 ? "SQUARE" : "ROUND",
    });
  }

  const section1: LayoutSection = {
    id: id.sec(),
    name: "Section 1",
    enabled: true,
    kind: "GRID",
    categoryId: CAT,
    zoneId: id.zone2,
    labelPrefix: "GF-S1",
    namingOffset: { row: 0 },
    x: 80,
    y: 300,
    rows: 3,
    cols: 8,
    rowGap: 6,
    colGap: 5,
    seatWidth: 20,
    seatHeight: 20,
    seatShape: "ROUND",
    rowLayout: "STRAIGHT",
    aisleAfterCol: 3,
    aisleGap: 28,
  };

  const section2: LayoutSection = {
    id: id.sec(),
    name: "Section 2",
    enabled: true,
    kind: "GRID",
    categoryId: CAT,
    zoneId: id.zone2,
    labelPrefix: "GF-S2",
    namingOffset: { row: 3 },
    x: 80,
    y: 390,
    rows: 2,
    cols: 6,
    rowGap: 6,
    colGap: 5,
    seatWidth: 20,
    seatHeight: 20,
    seatShape: "SQUARE",
    rowLayout: "STRAIGHT",
  };

  const balconySec: LayoutSection = {
    id: id.sec(),
    name: "Balcony",
    enabled: true,
    kind: "GRID",
    categoryId: catTier2,
    zoneId: id.balcony,
    labelPrefix: "BAL",
    namingOffset: { row: 5 },
    x: 100,
    y: 548,
    rows: 2,
    cols: 14,
    rowGap: 6,
    colGap: 4,
    seatWidth: 18,
    seatHeight: 18,
    seatShape: "ROUND",
    rowLayout: "STRAIGHT",
    aisleAfterCol: 6,
    aisleGap: 36,
  };

  return {
    version: 1,
    name,
    viewBox: { width: 600, height: 680 },
    orientation: "FRONT",
    landmarks: [
      {
        id: id.stage,
        type: "STAGE_BOX",
        label: "Stage",
        x: 150,
        y: 36,
        width: 300,
        height: 72,
      },
    ],
    categories: [
      {
        id: CAT,
        name: "Standard",
        color: "#3b82f6",
        price: 250000,
        enabled: true,
        sortOrder: 0,
      },
      {
        id: catTier2,
        name: "Tier 2",
        color: "#14b8a6",
        price: 350000,
        enabled: true,
        sortOrder: 1,
      },
    ],
    zones: [ground, zone1, zone2, standing, balcony],
    sections: [...tables, section1, section2, balconySec],
    naming: {
      rowScheme: "LETTERS",
      colScheme: "NUMBERS",
      separator: "",
      rowStart: 1,
      colStart: 1,
    },
  };
}

/**
 * 360° sketch: centre stage, 4 quadrants (L1-S1…S4), 3 expanding rows (6/8/10 seats).
 */
export function buildRound360FourQuadrantsLayout(name = "360° - 4 quadrants"): SeatLayoutDocument {
  const stageId = newLayoutId("stage");
  const focal = { x: 450, y: 380 };
  const stageR = 72;
  const innerR = stageR + 28;
  const outerR = innerR + 150;

  const quadrants: { name: string; prefix: string; start: number; end: number }[] = [
    { name: "L1 Section 1", prefix: "L1-S1", start: 0, end: 90 },
    { name: "L1 Section 2", prefix: "L1-S2", start: 90, end: 180 },
    { name: "L1 Section 3", prefix: "L1-S3", start: 180, end: 270 },
    { name: "L1 Section 4", prefix: "L1-S4", start: 270, end: 360 },
  ];

  const zones: LayoutVenueZone[] = quadrants.map((q, i) => ({
    id: newLayoutId("area"),
    name: q.name,
    kind: "RING" as const,
    shape: "WEDGE" as const,
    x: focal.x - outerR,
    y: focal.y - outerR,
    width: outerR * 2,
    height: outerR * 2,
    wedgeStartDeg: q.start > 360 ? q.start - 360 : q.start,
    wedgeEndDeg: q.end > 360 ? q.end - 360 : q.end,
    innerRadius: innerR,
    outerRadius: outerR,
    categoryId: i % 2 === 0 ? CAT : CAT_T2,
    sortOrder: i,
  }));

  const rowColCounts = [6, 8, 10];
  const sections: LayoutSection[] = quadrants.map((q, i) => {
    const zone = zones[i]!;
    const draft: LayoutSection = {
      id: newLayoutId("sec"),
      name: `${q.name} seats`,
      enabled: true,
      kind: "GRID",
      categoryId: zone.categoryId ?? CAT,
      zoneId: zone.id,
      labelPrefix: q.prefix,
      x: 0,
      y: 0,
      rows: rowColCounts.length,
      cols: Math.max(...rowColCounts),
      rowColCounts,
      rowGap: 5,
      colGap: 4,
      seatWidth: 18,
      seatHeight: 18,
      seatShape: "ROUND",
      rowLayout: "CURVED",
    };
    return snapSectionToZone(draft, zone, {
      version: 1,
      name,
      viewBox: { width: 900, height: 760 },
      orientation: "360",
      landmarks: [],
      categories: [],
      sections: [],
      naming: { rowScheme: "NUMBERS", colScheme: "NUMBERS" },
    });
  });

  return {
    version: 1,
    name,
    viewBox: { width: 900, height: 760 },
    orientation: "360",
    landmarks: [
      {
        id: stageId,
        type: "STAGE_ROUND",
        label: "Stage (360°)",
        x: focal.x,
        y: focal.y,
        radius: stageR,
      },
    ],
    categories: [
      {
        id: CAT,
        name: "Standard",
        color: "#3b82f6",
        price: 250000,
        enabled: true,
        sortOrder: 0,
      },
      {
        id: CAT_T2,
        name: "Tier 2",
        color: "#14b8a6",
        price: 350000,
        enabled: true,
        sortOrder: 1,
      },
    ],
    zones,
    sections,
    naming: {
      rowScheme: "NUMBERS",
      colScheme: "NUMBERS",
      separator: "-",
      rowStart: 1,
      colStart: 1,
    },
  };
}

export const LAYOUT_WIZARDS = [
  {
    slug: "theatre-ground-balcony",
    label: "Theatre (ground + balcony)",
    hint: "Stage, table zone, row sections, stand-up, balcony - matches typical hall sketch",
    build: buildTheatreGroundBalconyLayout,
  },
  {
    slug: "round-360-quadrants",
    label: "360° (4 quadrants)",
    hint: "Centre stage, 4 ring sections with expanding rows (6/8/10 seats)",
    build: buildRound360FourQuadrantsLayout,
  },
] as const;

/** Dashed aisle line X in section-local coords (straight rows). */
export function sectionAisleLineX(section: LayoutSection): number | null {
  if (section.aisleAfterCol == null) return null;
  const sw = section.seatWidth ?? 22;
  const cg = section.colGap ?? 4;
  const leftEdge = section.aisleAfterCol * (sw + cg) + sw;
  return leftEdge + (section.aisleGap ?? 24) / 2;
}

export { wedgeSvgPath };
