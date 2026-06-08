/**
 * Client-side payment card validation helpers. These are UX guards only -
 * real authorization happens at the payment gateway (WebXPay).
 */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Groups card digits in blocks of 4 for display: "1234 5678 9012 3456". */
export function formatCardNumber(value: string): string {
  return digitsOnly(value).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

/** Luhn checksum - catches typos in the card number. */
export function luhnValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export type CardBrand = "visa" | "mastercard" | "amex" | "unknown";

export function detectBrand(value: string): CardBrand {
  const d = digitsOnly(value);
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  return "unknown";
}

/** Formats expiry input as "MM / YY". */
export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)} / ${d.slice(2)}`;
}

/** Validates MM/YY expiry: real month and not in the past. */
export function expiryValid(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 4) return false;
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  return endOfMonth >= now;
}

/** Amex uses 4-digit CVV, others use 3. */
export function cvcValid(value: string, brand: CardBrand): boolean {
  const d = digitsOnly(value);
  return brand === "amex" ? d.length === 4 : d.length === 3;
}
