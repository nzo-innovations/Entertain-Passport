/**
 * Seat-map colours - fixed status colours never overlap pricing-tier palette.
 * Booked (purple), held (red), and your selection (lime) stay consistent everywhere.
 */

/** Booked / sold - brand purple (matches `--primary` / `--brand`). */
export const SEAT_BOOKED_FILL = "#7c3aed";
export const SEAT_BOOKED_STROKE = "#5b21b6";

/** @deprecated Use SEAT_BOOKED_FILL */
export const SEAT_SOLD_FILL = SEAT_BOOKED_FILL;

/** Buyer has this seat in their cart - lime green (not a tier colour). */
export const SEAT_SELECTED_FILL = "#84cc16";
export const SEAT_SELECTED_STROKE = "#3f6212";

/** Temporarily held by another checkout session. */
export const SEAT_HELD_FILL = "#ef4444";
export const SEAT_HELD_STROKE = "#991b1b";

export const SEAT_DISABLED_FILL = "#cbd5e1";

/** Fallback when a tier colour is missing on the map. */
export const SEAT_DEFAULT_TIER_COLOR = "#3b82f6";

/** Distinct palette for pricing tiers - excludes purple, lime, and red (reserved for status). */
export const CATEGORY_COLOR_PALETTE = [
  "#3b82f6", // blue - Standard
  "#eab308", // gold - VIP
  "#06b6d4", // cyan - Premium
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#ec4899", // pink
  "#64748b", // silver / economy
  "#22c55e", // green
] as const;

export function nextCategoryColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((c) => c.color.toLowerCase()));
  const free = CATEGORY_COLOR_PALETTE.find((hex) => !used.has(hex.toLowerCase()));
  if (free) return free;
  const idx = existing.length % CATEGORY_COLOR_PALETTE.length;
  return CATEGORY_COLOR_PALETTE[idx];
}

export function seatStatusFill(
  status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED" | "SELECTED" | "DISABLED",
  categoryColor: string
): string {
  if (status === "SOLD") return SEAT_BOOKED_FILL;
  if (status === "HELD") return SEAT_HELD_FILL;
  if (status === "SELECTED") return SEAT_SELECTED_FILL;
  if (status === "BLOCKED" || status === "DISABLED") return SEAT_DISABLED_FILL;
  return categoryColor;
}

export function seatStatusStroke(
  status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED" | "SELECTED" | "DISABLED"
): string | undefined {
  if (status === "SOLD") return SEAT_BOOKED_STROKE;
  if (status === "HELD") return SEAT_HELD_STROKE;
  if (status === "SELECTED") return SEAT_SELECTED_STROKE;
  return undefined;
}

export function seatStatusStrokeWidth(
  status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED" | "SELECTED" | "DISABLED"
): number {
  if (status === "SOLD" || status === "HELD" || status === "SELECTED") return 2.5;
  return 2;
}
