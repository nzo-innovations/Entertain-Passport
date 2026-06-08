/**
 * Customer profile helpers.
 *
 * After signing up with minimal info (name + email) customers are nudged to
 * complete their profile. Completing it is OPTIONAL for buying tickets, but
 * REQUIRED to unlock loyalty rewards & offers.
 */

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export const ID_TYPE_OPTIONS = [
  { value: "NIC", label: "NIC" },
  { value: "PASSPORT", label: "Passport" },
] as const;

export type ProfileFields = {
  name?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthday?: Date | string | null;
  idType?: string | null;
  idNumber?: string | null;
  addresses?: Array<{ line1?: string | null; city?: string | null; district?: string | null; province?: string | null }> | null;
};

/**
 * A profile is "loyalty-ready" when all the fields we need to issue rewards
 * are present: identity (NIC/Passport), contact, demographics & address.
 */
export function profileIsComplete(user: ProfileFields | null | undefined): boolean {
  if (!user) return false;
  const addr = user.addresses?.[0];
  return Boolean(
    user.name &&
      user.phone &&
      user.gender &&
      user.birthday &&
      user.idType &&
      user.idNumber &&
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
  if (!user.phone) missing.push("phone number");
  if (!user.gender) missing.push("gender");
  if (!user.birthday) missing.push("birthday");
  if (!user.idType || !user.idNumber) missing.push("NIC / Passport");
  if (!addr?.line1 || !addr?.city || !addr?.district || !addr?.province) missing.push("address");
  return missing;
}
