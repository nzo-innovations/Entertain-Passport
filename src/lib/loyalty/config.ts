import { db } from "@/lib/db";

export type LoyaltySettings = {
  loyaltyEnabled: boolean;
  loyaltyRequiresPassport: boolean;
  /** Minor currency units spent to earn one loyalty point (default LKR 100 = 10000). */
  loyaltyMinorPerPoint: number;
};

const DEFAULTS: LoyaltySettings = {
  loyaltyEnabled: true,
  loyaltyRequiresPassport: true,
  loyaltyMinorPerPoint: 10_000,
};

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  const row = await db.platformSettings.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULTS;
  return {
    loyaltyEnabled: row.loyaltyEnabled ?? DEFAULTS.loyaltyEnabled,
    loyaltyRequiresPassport: row.loyaltyRequiresPassport ?? DEFAULTS.loyaltyRequiresPassport,
    loyaltyMinorPerPoint: row.loyaltyMinorPerPoint ?? DEFAULTS.loyaltyMinorPerPoint,
  };
}

/** Points earned on a purchase subtotal (minor units). Returns 0 when disabled or no passport. */
export function calculateEarnedPoints(
  subtotalMinor: number,
  settings: LoyaltySettings,
  hasActivePassport: boolean
): number {
  if (!settings.loyaltyEnabled) return 0;
  if (settings.loyaltyRequiresPassport && !hasActivePassport) return 0;
  const divisor = Math.max(1, settings.loyaltyMinorPerPoint);
  return Math.floor(subtotalMinor / divisor);
}
