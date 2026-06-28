import { PUBLIC_PREFIX } from "./types";

/** Strip spaces/dashes - digits only. */
export function compactPublicNumber(value: string): string {
  return value.replace(/\D/g, "");
}

/** Display as 4-by-4 sections: 8826 1101 4837 2914 */
export function formatPublicPassportNumber(digits16: string): string {
  const d = compactPublicNumber(digits16);
  if (d.length !== 16) throw new Error("Public passport number must be 16 digits.");
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)} ${d.slice(12, 16)}`;
}

/** Luhn check digit for first 15 digits. */
export function computeLuhnCheckDigit(fifteenDigits: string): string {
  if (!/^\d{15}$/.test(fifteenDigits)) {
    throw new Error("Luhn input must be exactly 15 digits.");
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(fifteenDigits[i], 10);
    const posFromRight = 15 - i;
    if (posFromRight % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

export function validateLuhnCheckDigit(sixteenDigits: string): boolean {
  const d = compactPublicNumber(sixteenDigits);
  if (!/^\d{16}$/.test(d)) return false;
  const body = d.slice(0, 15);
  return computeLuhnCheckDigit(body) === d[15];
}

export function validatePublicPassportNumber(value: string): {
  ok: boolean;
  compact: string;
  formatted: string;
  error?: string;
} {
  const compact = compactPublicNumber(value);
  if (compact.length !== 16) {
    return { ok: false, compact, formatted: "", error: "Passport number must be 16 digits." };
  }
  if (!compact.startsWith(PUBLIC_PREFIX)) {
    return { ok: false, compact, formatted: "", error: "Passport number must start with 88." };
  }
  if (!validateLuhnCheckDigit(compact)) {
    return { ok: false, compact, formatted: "", error: "Invalid check digit." };
  }
  return { ok: true, compact, formatted: formatPublicPassportNumber(compact) };
}

export function parseCardTypeFromNumber(compact16: string): string {
  return compact16.slice(4, 6);
}

export function parseIssueYearFromNumber(compact16: string): number {
  return parseInt(compact16.slice(2, 4), 10);
}
