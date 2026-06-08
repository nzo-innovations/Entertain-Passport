import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import {
  getAuthCookieOptions,
  SESSION_MODE_COOKIE,
  sessionModeForRole,
  WINDOW_ID_COOKIE,
} from "@/lib/session-config";

/**
 * Called immediately after a successful login in this browser window.
 * Sets session mode (gate staff = long TTL) and a per-window id so gate
 * staff sessions stay isolated per browser window/tab.
 */
export async function POST() {
  const profile = await getSession();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = sessionModeForRole(profile.role);
  const windowId = randomUUID();
  const opts = getAuthCookieOptions(mode);

  const res = NextResponse.json({
    ok: true,
    windowId,
    mode,
    maxAge: opts.maxAge,
    role: profile.role,
  });

  res.cookies.set(SESSION_MODE_COOKIE, mode, opts);
  res.cookies.set(WINDOW_ID_COOKIE, windowId, opts);

  return res;
}

/** Validates that this browser window matches the login window (gate staff). */
export async function GET(req: Request) {
  const profile = await getSession();
  if (!profile) {
    return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  }

  if (profile.role !== "GATE_STAFF") {
    return NextResponse.json({ ok: true, skip: true });
  }

  const headerWindow = req.headers.get("x-ep-window-id");
  const cookieWindow = cookies().get(WINDOW_ID_COOKIE)?.value;

  if (!headerWindow || !cookieWindow || headerWindow !== cookieWindow) {
    return NextResponse.json({ ok: false, reason: "window_mismatch" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

/** Clear session markers on logout. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_MODE_COOKIE, "", { maxAge: 0, path: "/" });
  res.cookies.set(WINDOW_ID_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
