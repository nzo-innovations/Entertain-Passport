/** Auth session cookie policy for Entertain Passport. */

export const SESSION_MODE_COOKIE = "ep_session_mode";
export const WINDOW_ID_COOKIE = "ep_window_id";

/** Gate staff: long-lived (full event season / shared gate laptop). */
export const GATE_STAFF_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/** Customers: remember login up to 30 days; idle logout handled client-side. */
export const CUSTOMER_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/** Organizers & admins: standard persistent login. */
export const STANDARD_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

/** Sign out customers after this much idle time (no mouse/keyboard/touch). */
export const CUSTOMER_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export const LAST_ACTIVITY_KEY = "ep_last_activity";

export function touchLastActivity() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

export type SessionMode = "gate_long" | "customer_long" | "standard";

export function sessionModeForRole(role: string): SessionMode {
  if (role === "GATE_STAFF") return "gate_long";
  if (role === "CUSTOMER") return "customer_long";
  return "standard";
}

export function getAuthCookieOptions(mode: SessionMode) {
  const maxAge =
    mode === "gate_long"
      ? GATE_STAFF_MAX_AGE_SEC
      : mode === "customer_long"
        ? CUSTOMER_MAX_AGE_SEC
        : STANDARD_MAX_AGE_SEC;
  return {
    maxAge,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export const WINDOW_STORAGE_KEY = "ep_window_id";
