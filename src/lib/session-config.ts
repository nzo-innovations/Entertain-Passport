/** Auth session cookie policy for Entertain Passport. */

export const SESSION_MODE_COOKIE = "ep_session_mode";
export const WINDOW_ID_COOKIE = "ep_window_id";

/** Gate staff: long-lived (full event season / shared gate laptop). */
export const GATE_STAFF_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/** Customers, organizers, admins: standard persistent login. */
export const STANDARD_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export type SessionMode = "gate_long" | "standard";

export function sessionModeForRole(role: string): SessionMode {
  return role === "GATE_STAFF" ? "gate_long" : "standard";
}

export function getAuthCookieOptions(mode: SessionMode) {
  const maxAge = mode === "gate_long" ? GATE_STAFF_MAX_AGE_SEC : STANDARD_MAX_AGE_SEC;
  return {
    maxAge,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export const WINDOW_STORAGE_KEY = "ep_window_id";
