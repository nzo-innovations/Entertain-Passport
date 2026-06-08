import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_CURRENCY, formatMoneyMajor } from "./money";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a MAJOR-unit amount (callers typically pass cents / 100) using the
 * platform currency. Defaults to LKR; pass an event/order currency to override.
 * See `src/lib/money.ts` for the multi-currency source of truth.
 */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY) {
  return formatMoneyMajor(amount, currency);
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
