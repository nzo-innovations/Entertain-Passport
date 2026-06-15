// ============================================================
// Effective per-partner limits + pricing (override wins, else plan)
// ============================================================
import type { ApiClient, Partner, VerifPlan } from "@/generated/verify-client";

export type PartnerWithPlan = Partner & { plan: VerifPlan | null };

export type EffectiveLimits = {
  unitPriceMinor: number;
  includedAllowance: number;
  monthlyQuota: number | null; // null = unlimited
  rateLimitRpm: number;
  currency: string;
};

/**
 * Resolve the limits/pricing that actually apply to a partner. Per-partner
 * Super-Admin overrides take precedence; otherwise the assigned plan's values;
 * otherwise safe defaults.
 */
export function effectiveLimits(partner: PartnerWithPlan, client?: ApiClient | null): EffectiveLimits {
  const plan = partner.plan;
  return {
    unitPriceMinor: partner.overrideUnitPriceMinor ?? plan?.unitPriceMinor ?? 0,
    includedAllowance: plan?.includedAllowance ?? 0,
    monthlyQuota: partner.overrideMonthlyQuota ?? plan?.monthlyQuota ?? null,
    rateLimitRpm:
      client?.rateLimitRpm ?? partner.overrideRateLimitRpm ?? plan?.rateLimitRpm ?? 120,
    currency: plan?.currency ?? "LKR",
  };
}

/** Current billing period key, e.g. "2026-06". */
export function currentPeriod(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
