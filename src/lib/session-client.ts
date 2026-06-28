import { WINDOW_STORAGE_KEY, touchLastActivity } from "@/lib/session-config";

/** Bind server session TTL + per-window id after login (call from client). */
export async function bindBrowserSession(): Promise<{
  ok: boolean;
  windowId?: string;
  mode?: string;
}> {
  const res = await fetch("/api/auth/session", { method: "POST", cache: "no-store" });
  if (!res.ok) return { ok: false };
  const data = await res.json();
  if (data.windowId) {
    sessionStorage.setItem(WINDOW_STORAGE_KEY, data.windowId);
  }
  touchLastActivity();
  return { ok: true, windowId: data.windowId, mode: data.mode };
}

/** Clear window session on logout. */
export async function clearBrowserSession(): Promise<void> {
  sessionStorage.removeItem(WINDOW_STORAGE_KEY);
  try {
    await fetch("/api/auth/session", { method: "DELETE", cache: "no-store" });
  } catch {
    /* ignore */
  }
}

export { WINDOW_STORAGE_KEY };
