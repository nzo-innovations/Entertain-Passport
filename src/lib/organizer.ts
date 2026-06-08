import { cache } from "react";
import { db } from "./db";
import { slugify } from "./utils";
import { getSession } from "./auth";
import { createSupabaseServerClient } from "./supabase/server";
import { isCreatorRole, OrgType } from "./types";

const VALID_ORG_TYPES = new Set<string>(Object.values(OrgType));

/**
 * Ensures a signed-in organizer has an Organization to work under.
 *
 * Organizer signup stores the chosen creator type + organization name in the
 * Supabase auth metadata. The DB trigger creates the User profile with the
 * chosen creator role, but the Organization itself is created here on first
 * portal visit (idempotent). This keeps signup working whether or not email
 * confirmation is enabled.
 */
export async function ensureOrganizerOrganization(): Promise<void> {
  const session = await getSession();
  if (!session || !isCreatorRole(session.role)) return;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  // Only bootstrap an organization for brand-new organizers. Users who already
  // own OR belong to an org (e.g. door staff / workers) are left untouched.
  const existing = await db.organization.findFirst({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
  });
  if (existing) return;

  const rawType = (meta.orgType as string) ?? session.role;
  const orgType = VALID_ORG_TYPES.has(rawType) ? rawType : OrgType.ORGANIZER;
  const fallbackName =
    (meta.orgName as string) ||
    (meta.name as string)?.trim() ||
    user.email?.split("@")[0] ||
    "My Organization";

  const baseSlug = slugify(fallbackName) || `org-${user.id.slice(0, 8)}`;
  let slug = baseSlug;
  for (let i = 1; await db.organization.findUnique({ where: { slug } }); i++) {
    slug = `${baseSlug}-${i}`;
  }

  await db.organization.create({
    data: {
      name: fallbackName,
      slug,
      type: orgType,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
}

/** Per-request cached org type for portal nav (avoids duplicate queries in layout + pages). */
export const getPortalOrgType = cache(async (userId: string) => {
  const org = await db.organization.findFirst({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
    select: { type: true },
  });
  return org?.type ?? null;
});
