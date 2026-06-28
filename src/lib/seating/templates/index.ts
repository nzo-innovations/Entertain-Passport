import type { SeatLayoutDocument } from "../types";
import { blankLayout } from "../layout-utils";
import { NELUM_POKUNA_LAYOUT } from "./nelum-pokuna";
import { BMICH_LAYOUT } from "./bmich";
import {
  buildTheatreGroundBalconyLayout,
  buildRound360FourQuadrantsLayout,
} from "../layout-builders";

export type SystemTemplateDef = {
  slug: string;
  name: string;
  description: string;
  layout: SeatLayoutDocument;
};

export const SYSTEM_TEMPLATES: SystemTemplateDef[] = [
  {
    slug: "nelum-pokuna",
    name: "Nelum Pokuna Theatre",
    description: "Orchestra + balcony layout for Nelum Pokuna, Colombo.",
    layout: NELUM_POKUNA_LAYOUT,
  },
  {
    slug: "bmich",
    name: "BMICH Main Hall",
    description: "Main hall with front blocks and side tiers at BMICH.",
    layout: BMICH_LAYOUT,
  },
  {
    slug: "theatre-ground-balcony",
    name: "Theatre - ground + balcony",
    description:
      "Multi-level layout: table zone, row sections with centre aisle, stand-up area, and balcony.",
    layout: buildTheatreGroundBalconyLayout(),
  },
  {
    slug: "round-360-quadrants",
    name: "360° - 4 quadrants",
    description:
      "In-the-round with centre stage, four ring sections and expanding rows (6/8/10 seats).",
    layout: buildRound360FourQuadrantsLayout(),
  },
  {
    slug: "blank",
    name: "Blank canvas",
    description: "Empty layout - build your own sections from scratch.",
    layout: blankLayout("Custom venue"),
  },
];

export function getSystemTemplate(slug: string): SystemTemplateDef | undefined {
  return SYSTEM_TEMPLATES.find((t) => t.slug === slug);
}
