import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { db } from "./db";
import { UserRole, isCreatorRole } from "./types";
import { createSupabaseServerClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
};

/** One Supabase auth lookup per request — shared by getSession, getUserRole, getAuthUserId. */
const getSupabaseUser = cache(async (): Promise<User | null> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Returns the authenticated user (Supabase Auth + profile row).
 * Wrapped in React `cache()` so multiple calls in one request share one DB hit.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const user = await getSupabaseUser();
  if (!user) return null;

  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true },
  });

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.name as string) ?? null,
      role: (user.user_metadata?.role as string) ?? UserRole.CUSTOMER,
      avatarUrl: null,
    };
  }

  return profile;
});

/** Fast path for login door checks — role column only, no full profile. */
export const getUserRole = cache(async (): Promise<string | null> => {
  const user = await getSupabaseUser();
  if (!user) return null;

  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  return profile?.role ?? (user.user_metadata?.role as string) ?? UserRole.CUSTOMER;
});

/** Auth user id without profile fetch when only id is needed. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const user = await getSupabaseUser();
  return user?.id ?? null;
});

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== UserRole.SUPER_ADMIN) throw new Error("Forbidden");
  return session;
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.role === UserRole.SUPER_ADMIN;
}

/** Any creator lane (event organizer, artist manager, artist, venue owner). */
export function isCreator(user: SessionUser | null): boolean {
  return isCreatorRole(user?.role);
}

/** @deprecated Prefer `isCreator` — kept for call sites that still use the old name. */
export function isOrganizer(user: SessionUser | null): boolean {
  return isCreatorRole(user?.role);
}

export function isGateStaff(user: SessionUser | null): boolean {
  return user?.role === UserRole.GATE_STAFF;
}
