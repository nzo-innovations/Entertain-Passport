import type { SeatLayoutDocument } from "./types";
import { NELUM_POKUNA_LAYOUT } from "./templates/nelum-pokuna";
import { BMICH_LAYOUT } from "./templates/bmich";

function cloneLayout(doc: SeatLayoutDocument): SeatLayoutDocument {
  return JSON.parse(JSON.stringify(doc)) as SeatLayoutDocument;
}

export type VenuePresetDef = {
  slug: string;
  label: string;
  /** City or venue note shown in the designer */
  location?: string;
  hint: string;
  /** When false, the preset appears but cannot be applied yet */
  available: boolean;
  build?: () => SeatLayoutDocument;
};

/**
 * Named venue layouts for the designer Setup tab.
 * Add entries here when new floor plans are ready - set `available: true` and `build`.
 */
export const VENUE_PRESETS: VenuePresetDef[] = [
  {
    slug: "nelum-pokuna",
    label: "Nelum Pokuna Theatre",
    location: "Colombo",
    hint: "Orchestra + balcony facing stage. Starter layout - replace with your detailed plan when ready.",
    available: true,
    build: () => cloneLayout(NELUM_POKUNA_LAYOUT),
  },
  {
    slug: "bmich",
    label: "BMICH Main Hall",
    location: "Colombo",
    hint: "Main hall with front blocks and side tiers. Starter layout - refine when your BMICH plan is ready.",
    available: true,
    build: () => cloneLayout(BMICH_LAYOUT),
  },
];

export function getVenuePreset(slug: string): VenuePresetDef | undefined {
  return VENUE_PRESETS.find((p) => p.slug === slug);
}
