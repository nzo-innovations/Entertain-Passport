export type SeatLayoutVersion = 1;

export type LayoutOrientation = "FRONT" | "60" | "90" | "120" | "180" | "200" | "360";

export type SeatRowLayout = "STRAIGHT" | "CURVED" | "AUTO";

export type LandmarkType = "SCREEN" | "STAGE_BOX" | "STAGE_ROUND";

export type SectionKind = "GRID" | "TABLE";

/** Visual seat icon - square (theatre) or round (concert / cabaret). */
export type SeatShape = "SQUARE" | "ROUND";

/** Banquet / cabaret table - seats sold around one physical table. */
export type TablePackSize = 6 | 8 | 10 | 12;

/** TWO = seats on two long edges only (typical concert VIP). FOUR = all four sides. */
export type TableSideMode = "TWO" | "FOUR";

export type RowNamingScheme = "LETTERS" | "NUMBERS" | "LETTERS_REVERSE";
export type ColNamingScheme = "NUMBERS" | "LETTERS";

export type NamingScheme = {
  rowScheme: RowNamingScheme;
  colScheme: ColNamingScheme;
  rowStart?: number;
  colStart?: number;
  separator?: string;
};

export type LayoutLandmark = {
  id: string;
  type: LandmarkType;
  label?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  rotateDeg?: number;
};

/** Physical hall / floor / location division - define before placing seats. */
export type VenueZoneKind =
  | "HALL"
  | "GROUND"
  | "ZONE"
  | "SECTION"
  | "BALCONY"
  | "GALLERY"
  | "OUTDOOR"
  | "STANDING"
  | "RING"
  | "CUSTOM";

export type ZoneShape = "RECT" | "WEDGE";

export type LayoutVenueZone = {
  id: string;
  name: string;
  kind?: VenueZoneKind;
  shape?: ZoneShape;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Standing GA - no individual seats; sold by capacity. */
  capacity?: number;
  /** Pricing tier for standing areas. */
  categoryId?: string;
  /** Wedge geometry (degrees, 0 = down, clockwise) - used in 360° round layouts. */
  wedgeStartDeg?: number;
  wedgeEndDeg?: number;
  innerRadius?: number;
  outerRadius?: number;
  /** Nest zones: Ground floor → Zone 1 / Zone 2, or Balcony as sibling floor. */
  parentZoneId?: string;
  sortOrder?: number;
  rotateDeg?: number;
};

/** Matches TicketPackage.ticketKind - SEATED needs seat map, STANDING/GENERAL sold by qty. */
export type TicketKind = "SEATED" | "STANDING" | "GENERAL";

export type LayoutCategory = {
  id: string;
  name: string;
  color: string;
  price: number;
  enabled: boolean;
  sortOrder?: number;
  /** Linked event TicketPackage id (same as id when synced from packages). */
  packageId?: string;
  ticketKind?: TicketKind;
};

export type LayoutSeat = {
  id: string;
  rowIndex: number;
  colIndex: number;
  label?: string;
  categoryId?: string;
  enabled: boolean;
};

export type LayoutSection = {
  id: string;
  name: string;
  enabled: boolean;
  kind: SectionKind;
  categoryId: string;
  /** Parent venue area (hall / floor / section). */
  zoneId?: string;
  /** For kind TABLE: 6, 8, 10, or 12 seats around one table. */
  tablePackSize?: TablePackSize;
  /** For kind TABLE: TWO (long edges) or FOUR (all sides). Default TWO. */
  tableSideMode?: TableSideMode;
  x: number;
  y: number;
  rows: number;
  cols: number;
  rowGap?: number;
  colGap?: number;
  seatWidth?: number;
  seatHeight?: number;
  /** STRAIGHT = grid; CURVED = arc rows toward stage; AUTO = follow audience view. */
  rowLayout?: SeatRowLayout;
  /** Optional wedge angle (degrees) for curved blocks. Defaults from audience view. */
  curveSpanDeg?: number;
  rowNaming?: Partial<NamingScheme>;
  /** Prepended to each seat label, e.g. L1-S2 → L1-S2-A1 */
  labelPrefix?: string;
  /** Offset row/col indices for naming (Section 2 rows start at D if offset row = 3). */
  namingOffset?: { row?: number; col?: number };
  /** Per-row seat counts for curved rings - e.g. [6, 8, 10] for expanding arcs. */
  rowColCounts?: number[];
  /** Seat icon shape for this block. */
  seatShape?: SeatShape;
  /** Center aisle: seats with colIndex > this value shift right by aisleGap. */
  aisleAfterCol?: number;
  aisleGap?: number;
  /** Designer rotation of the whole block (degrees). */
  rotateDeg?: number;
  /** Curved rows: centre bearing toward stage (0 = down, clockwise). */
  curveBearingDeg?: number;
  /** Curved rows: distance from stage to first row. */
  curveInnerRadius?: number;
  seats?: LayoutSeat[];
};

export type SeatLayoutDocument = {
  version: SeatLayoutVersion;
  name: string;
  viewBox: { width: number; height: number };
  orientation: LayoutOrientation;
  landmarks: LayoutLandmark[];
  /** Hall / ground / location areas - step 1 before seats. */
  zones?: LayoutVenueZone[];
  categories: LayoutCategory[];
  sections: LayoutSection[];
  naming: NamingScheme;
};

export type SeatMapStatusPayload = {
  seats: {
    id: string;
    externalId: string;
    label: string;
    sectionId: string | null;
    categoryExternalId: string | null;
    status: string;
    enabled: boolean;
    /** True when this seat is held by the signed-in user (they may change/deselect it). */
    heldByYou?: boolean;
  }[];
  categories: {
    id: string;
    externalId: string;
    name: string;
    color: string;
    price: number;
    enabled: boolean;
  }[];
  layout: SeatLayoutDocument;
  hold?: {
    seatIds: string[];
    expiresAt: string;
    maxExpiresAt: string;
    idleReleaseAt: string | null;
    phase: string;
  } | null;
};
