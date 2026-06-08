/**
 * Money & currency - single source of truth.
 *
 * The platform launches in Sri Lanka with LKR only, but is built to go
 * multi-currency/world-wide in the future. Add new currencies here and flip
 * `enabled` to true when they go live - no other code needs to change.
 *
 * Storage convention: all monetary amounts are stored as INTEGER MINOR UNITS
 * (e.g. cents). Use `toMinor`/`toMajor` to convert at the edges and
 * `formatMoney` to render.
 */

export type CurrencyCode = "LKR" | "USD" | "EUR" | "GBP" | "INR" | "AUD";

export type CurrencyConfig = {
  code: CurrencyCode;
  /** ISO locale used for Intl formatting. */
  locale: string;
  symbol: string;
  name: string;
  /** Number of minor units in one major unit (100 for cents). */
  minorUnits: number;
  /** Decimal places to show when formatting. */
  fractionDigits: number;
  /** When false, the currency is reserved for future rollout (shown as "coming soon"). */
  enabled: boolean;
};

/**
 * Add future currencies here. Keep `enabled: false` until the payment +
 * settlement rails for that market are live.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  LKR: {
    code: "LKR",
    locale: "en-LK",
    symbol: "Rs",
    name: "Sri Lankan Rupee",
    minorUnits: 100,
    fractionDigits: 0,
    enabled: true,
  },
  // ----- Reserved for future world-wide expansion (not yet live) -----
  USD: { code: "USD", locale: "en-US", symbol: "$", name: "US Dollar", minorUnits: 100, fractionDigits: 2, enabled: false },
  EUR: { code: "EUR", locale: "en-IE", symbol: "€", name: "Euro", minorUnits: 100, fractionDigits: 2, enabled: false },
  GBP: { code: "GBP", locale: "en-GB", symbol: "£", name: "British Pound", minorUnits: 100, fractionDigits: 2, enabled: false },
  INR: { code: "INR", locale: "en-IN", symbol: "₹", name: "Indian Rupee", minorUnits: 100, fractionDigits: 2, enabled: false },
  AUD: { code: "AUD", locale: "en-AU", symbol: "A$", name: "Australian Dollar", minorUnits: 100, fractionDigits: 2, enabled: false },
};

export const DEFAULT_CURRENCY: CurrencyCode = "LKR";

/** Currencies that can be selected today (used to populate dropdowns). */
export const ENABLED_CURRENCIES: CurrencyConfig[] = Object.values(CURRENCIES).filter((c) => c.enabled);

/** Every currency, for "coming soon" hints in the UI. */
export const ALL_CURRENCIES: CurrencyConfig[] = Object.values(CURRENCIES);

export function getCurrency(code?: string | null): CurrencyConfig {
  if (code && code in CURRENCIES) return CURRENCIES[code as CurrencyCode];
  return CURRENCIES[DEFAULT_CURRENCY];
}

/** Convert a major-unit amount (e.g. 1500) into minor units for storage. */
export function toMinor(major: number, code: CurrencyCode = DEFAULT_CURRENCY): number {
  return Math.round(major * getCurrency(code).minorUnits);
}

/** Convert stored minor units (e.g. 150000) into a major-unit number. */
export function toMajor(minor: number, code: CurrencyCode = DEFAULT_CURRENCY): number {
  return minor / getCurrency(code).minorUnits;
}

/**
 * Format an amount given in MINOR units (the storage format) as a localized
 * currency string, e.g. formatMoney(150000) -> "Rs 1,500".
 */
export function formatMoney(amountMinor: number, code: string = DEFAULT_CURRENCY): string {
  const c = getCurrency(code);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    maximumFractionDigits: c.fractionDigits,
    minimumFractionDigits: c.fractionDigits,
  }).format(amountMinor / c.minorUnits);
}

/** Format an amount already expressed in MAJOR units. */
export function formatMoneyMajor(amountMajor: number, code: string = DEFAULT_CURRENCY): string {
  const c = getCurrency(code);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    maximumFractionDigits: c.fractionDigits,
    minimumFractionDigits: c.fractionDigits,
  }).format(amountMajor);
}
