import type { LayoutVenueZone, VenueZoneKind } from "./types";

/** Subtle area tints - distinct from seat pricing category colours. */
export const VENUE_ZONE_STYLES: { fill: string; stroke: string }[] = [
  { fill: "rgba(59, 130, 246, 0.12)", stroke: "#3b82f6" },
  { fill: "rgba(16, 185, 129, 0.12)", stroke: "#10b981" },
  { fill: "rgba(245, 158, 11, 0.12)", stroke: "#f59e0b" },
  { fill: "rgba(139, 92, 246, 0.12)", stroke: "#8b5cf6" },
  { fill: "rgba(236, 72, 153, 0.12)", stroke: "#ec4899" },
  { fill: "rgba(6, 182, 212, 0.12)", stroke: "#06b6d4" },
  { fill: "rgba(100, 116, 139, 0.12)", stroke: "#64748b" },
  { fill: "rgba(249, 115, 22, 0.12)", stroke: "#f97316" },
];

export type DesignerZonePreset = {
  id: string;
  label: string;
  kind: VenueZoneKind;
  name: string;
  width: number;
  height: number;
  hint: string;
};

/** Rectangular areas shown in the designer Zones tab (fixed order). */
export const DESIGNER_ZONE_PRESETS: DesignerZonePreset[] = [
  {
    id: "ground",
    label: "Ground / floor",
    kind: "GROUND",
    name: "Ground Floor",
    width: 1400,
    height: 900,
    hint: "Main ground-level floor - nest zones and sections inside",
  },
  {
    id: "zone",
    label: "Zone",
    kind: "ZONE",
    name: "Zone",
    width: 960,
    height: 640,
    hint: "Named zone on the floor plan (e.g. Zone A)",
  },
  {
    id: "section",
    label: "Section",
    kind: "SECTION",
    name: "Section",
    width: 720,
    height: 480,
    hint: "Smaller seated section within a floor or zone",
  },
  {
    id: "balcony",
    label: "Balcony",
    kind: "BALCONY",
    name: "Balcony",
    width: 1200,
    height: 360,
    hint: "Upper tier / balcony level",
  },
  {
    id: "custom",
    label: "Custom area",
    kind: "CUSTOM",
    name: "Custom Area",
    width: 960,
    height: 640,
    hint: "Free-form hall section with a custom label",
  },
];

export const STANDING_ZONE_DEFAULT_CAPACITY = 300;

export type DesignerZoneTool =
  | { type: "preset"; preset: DesignerZonePreset }
  | { type: "sub-zone"; label: string; hint: string }
  | { type: "standing"; label: string; hint: string; capacity: number };

/** Full Zones tab tool list - ground, zone, sub-zone, section, balcony, custom, standing. */
export const DESIGNER_ZONE_TOOLS: DesignerZoneTool[] = [
  { type: "preset", preset: DESIGNER_ZONE_PRESETS[0]! },
  { type: "preset", preset: DESIGNER_ZONE_PRESETS[1]! },
  {
    type: "sub-zone",
    label: "Sub-zone",
    hint: "Nest inside the selected ground floor, zone, or section",
  },
  { type: "preset", preset: DESIGNER_ZONE_PRESETS[2]! },
  { type: "preset", preset: DESIGNER_ZONE_PRESETS[3]! },
  { type: "preset", preset: DESIGNER_ZONE_PRESETS[4]! },
  {
    type: "standing",
    label: "Standing area",
    hint: "General admission - no individual seats. Set capacity in Properties.",
    capacity: STANDING_ZONE_DEFAULT_CAPACITY,
  },
];

/** @deprecated Use DESIGNER_ZONE_PRESETS - kept for older imports */
export const VENUE_ZONE_PRESETS = DESIGNER_ZONE_PRESETS;

/** 360° ring wedges - used by templates, not the Zones tab. */
export const ROUND_ZONE_PRESETS = [
  { label: "Ring wedge (45°)", spanDeg: 45, hint: "One slice of the ring - add 8 for full circle" },
  { label: "Ring wedge (90°)", spanDeg: 90, hint: "Quarter-ring seating section" },
  { label: "Full ring band", spanDeg: 360, hint: "Complete ring around stage" },
] as const;

export function venueZoneStyle(index: number) {
  return VENUE_ZONE_STYLES[index % VENUE_ZONE_STYLES.length]!;
}

export function venueZoneKindLabel(kind?: VenueZoneKind): string {
  switch (kind) {
    case "HALL":
      return "Main hall";
    case "GROUND":
      return "Ground / floor";
    case "ZONE":
      return "Zone";
    case "SECTION":
      return "Section";
    case "BALCONY":
      return "Balcony";
    case "GALLERY":
      return "Gallery / side";
    case "OUTDOOR":
      return "Outdoor";
    case "STANDING":
      return "Standing area";
    case "RING":
      return "Ring section";
    default:
      return "Custom area";
  }
}

export function getVenueZones(layout: { zones?: LayoutVenueZone[] }): LayoutVenueZone[] {
  return layout.zones ?? [];
}

export function getRootZones(layout: { zones?: LayoutVenueZone[] }): LayoutVenueZone[] {
  return getVenueZones(layout).filter((z) => !z.parentZoneId);
}

export function getChildZones(
  layout: { zones?: LayoutVenueZone[] },
  parentId: string
): LayoutVenueZone[] {
  return getVenueZones(layout).filter((z) => z.parentZoneId === parentId);
}

export function getZoneAncestors(
  layout: { zones?: LayoutVenueZone[] },
  zoneId: string
): LayoutVenueZone[] {
  const zones = getVenueZones(layout);
  const chain: LayoutVenueZone[] = [];
  let current = zones.find((z) => z.id === zoneId);
  while (current) {
    chain.unshift(current);
    current = current.parentZoneId
      ? zones.find((z) => z.id === current!.parentZoneId)
      : undefined;
  }
  return chain;
}

export function zoneDisplayName(
  layout: { zones?: LayoutVenueZone[] },
  zone: LayoutVenueZone
): string {
  const chain = getZoneAncestors(layout, zone.id);
  if (chain.length <= 1) return zone.name;
  return chain.map((z) => z.name).join(" › ");
}

export function nextZoneName(venueZones: LayoutVenueZone[], baseName: string): string {
  const matches = venueZones.filter(
    (z) => z.name === baseName || z.name.startsWith(`${baseName} `)
  );
  return matches.length > 0 ? `${baseName} ${matches.length + 1}` : baseName;
}
