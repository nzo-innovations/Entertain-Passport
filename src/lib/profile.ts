/**
 * Customer profile helpers.
 *
 * Customers sign up with first name, last name, email and a primary identity
 * number (Sri Lankan NIC or passport). They are then nudged to add mobile,
 * gender and address details for loyalty and card shipping.
 */

import {
  ID_TYPE_OPTIONS,
  identityTypeLabel,
  isIdentityType,
  normalizeIdentityNumber,
  type IdentityType,
} from "./identity";
import { normalizeNic as normalizeSriLankaNic } from "./nic";

export { normalizeNic } from "./nic";
export {
  ID_TYPE_OPTIONS,
  identityTypeLabel,
  normalizeIdentityNumber,
  validateIdentity,
} from "./identity";
export type { IdentityType } from "./identity";

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export type ProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  nic?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthday?: Date | string | null;
  idType?: string | null;
  idNumber?: string | null;
  addresses?: Array<{ line1?: string | null; city?: string | null; district?: string | null; province?: string | null }> | null;
};

export function profileIdentity(
  user: ProfileFields | null | undefined
): { type: IdentityType; number: string; label: string } | null {
  if (!user) return null;
  const type: IdentityType = isIdentityType(user.idType) ? user.idType : "NIC";
  const number = normalizeIdentityNumber(type, type === "NIC" ? user.nic ?? user.idNumber : user.idNumber);
  if (!number) return null;
  return { type, number, label: identityTypeLabel(type) };
}

export function profileIdentityNumber(user: ProfileFields | null | undefined): string | null {
  return profileIdentity(user)?.number ?? null;
}

export function profileIdentityDisplay(user: ProfileFields | null | undefined): string | null {
  const identity = profileIdentity(user);
  return identity ? `${identity.label} ${identity.number}` : null;
}

export function profileNic(user: ProfileFields | null | undefined): string | null {
  if (!user) return null;
  return normalizeSriLankaNic(user.nic ?? (user.idType === "NIC" ? user.idNumber : null)) || null;
}

/**
 * A profile is "loyalty-ready" when the primary identity, mobile, gender and
 * shipping address are present. Birthday remains optional.
 */
export function profileIsComplete(user: ProfileFields | null | undefined): boolean {
  if (!user) return false;
  const addr = user.addresses?.[0];
  return Boolean(
    (user.name || (user.firstName && user.lastName)) &&
      user.phone &&
      user.gender &&
      profileIdentityNumber(user) &&
      addr?.line1 &&
      addr?.city &&
      addr?.district &&
      addr?.province
  );
}

/** Which loyalty-required fields are still missing (for nudges). */
export function missingProfileFields(user: ProfileFields | null | undefined): string[] {
  const missing: string[] = [];
  if (!user) return ["everything"];
  const addr = user.addresses?.[0];
  if (!profileIdentityNumber(user)) missing.push("NIC or passport number");
  if (!user.phone) missing.push("mobile number");
  if (!user.gender) missing.push("gender");
  if (!addr?.line1 || !addr?.city || !addr?.district || !addr?.province) missing.push("address");
  return missing;
}
