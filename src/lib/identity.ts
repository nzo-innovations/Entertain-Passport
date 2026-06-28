import { normalizeNic, validateNic } from "./nic";

export const ID_TYPE_OPTIONS = [
  { value: "NIC", label: "Sri Lankan NIC" },
  { value: "PASSPORT", label: "Passport" },
] as const;

/** Customer signup: residency question maps to NIC vs passport identity. */
export const RESIDENCY_OPTIONS = [
  {
    value: "NIC" as const,
    label: "Sri Lankan resident",
    description:
      "For citizens and residents of Sri Lanka. Use your National Identity Card (NIC) number.",
    fieldLabel: "NIC",
    fieldPlaceholder: "200012345678",
  },
  {
    value: "PASSPORT" as const,
    label: "Non-resident of Sri Lanka",
    description:
      "For visitors and foreign nationals attending events in Sri Lanka. Use your passport number.",
    fieldLabel: "Passport No",
    fieldPlaceholder: "N1234567",
  },
] as const;

export type IdentityType = (typeof ID_TYPE_OPTIONS)[number]["value"];

export type IdentityValidationResult = {
  ok: boolean;
  normalized: string;
  error?: string;
};

export function isIdentityType(value: unknown): value is IdentityType {
  return value === "NIC" || value === "PASSPORT";
}

export function identityTypeLabel(type: string | null | undefined): string {
  return type === "PASSPORT" ? "Passport" : "NIC";
}

export function normalizePassportNumber(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function normalizeIdentityNumber(
  type: IdentityType | string | null | undefined,
  value: string | null | undefined
): string {
  return type === "PASSPORT" ? normalizePassportNumber(value) : normalizeNic(value);
}

export function normalizeIdentityLookup(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function validatePassportNumber(passportNumber: string): IdentityValidationResult {
  const normalized = normalizePassportNumber(passportNumber);

  if (!normalized) {
    return { ok: false, normalized, error: "Passport number is required." };
  }

  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return {
      ok: false,
      normalized,
      error: "Passport number can contain letters and numbers only.",
    };
  }

  if (normalized.length < 5 || normalized.length > 20) {
    return {
      ok: false,
      normalized,
      error: "Passport number must be 5 to 20 letters or numbers.",
    };
  }

  return { ok: true, normalized };
}

export function validateIdentity(
  type: IdentityType | string | null | undefined,
  value: string
): IdentityValidationResult {
  if (!isIdentityType(type)) {
    return {
      ok: false,
      normalized: normalizeIdentityLookup(value),
      error: "Please confirm whether you are a Sri Lankan resident or non-resident.",
    };
  }

  return type === "PASSPORT" ? validatePassportNumber(value) : validateNic(value);
}
