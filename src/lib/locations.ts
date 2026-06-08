/**
 * Geographic reference data for structured event addresses.
 *
 * Launch market is Sri Lanka, so we ship its full province → district tree.
 * The shape is country-keyed so additional countries can be added later for
 * the world-wide rollout without touching the address UI.
 */

export type Country = {
  code: string;
  name: string;
  enabled: boolean;
};

export const COUNTRIES: Country[] = [
  { code: "LK", name: "Sri Lanka", enabled: true },
  // Reserved for future world-wide expansion:
  { code: "IN", name: "India", enabled: false },
  { code: "AE", name: "United Arab Emirates", enabled: false },
  { code: "GB", name: "United Kingdom", enabled: false },
  { code: "US", name: "United States", enabled: false },
  { code: "AU", name: "Australia", enabled: false },
];

export const ENABLED_COUNTRIES = COUNTRIES.filter((c) => c.enabled);
export const DEFAULT_COUNTRY = "Sri Lanka";

/** Sri Lanka: province -> districts. */
export const SRI_LANKA_PROVINCES: Record<string, string[]> = {
  "Western": ["Colombo", "Gampaha", "Kalutara"],
  "Central": ["Kandy", "Matale", "Nuwara Eliya"],
  "Southern": ["Galle", "Matara", "Hambantota"],
  "Northern": ["Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu"],
  "Eastern": ["Trincomalee", "Batticaloa", "Ampara"],
  "North Western": ["Kurunegala", "Puttalam"],
  "North Central": ["Anuradhapura", "Polonnaruwa"],
  "Uva": ["Badulla", "Monaragala"],
  "Sabaragamuwa": ["Ratnapura", "Kegalle"],
};

export const SRI_LANKA_PROVINCE_NAMES = Object.keys(SRI_LANKA_PROVINCES);

export function getDistricts(province?: string | null): string[] {
  if (!province) return [];
  return SRI_LANKA_PROVINCES[province] ?? [];
}
