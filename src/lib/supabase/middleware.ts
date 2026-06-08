import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthCookieOptions,
  SESSION_MODE_COOKIE,
  type SessionMode,
} from "@/lib/session-config";

function resolveMode(request: NextRequest): SessionMode {
  const raw = request.cookies.get(SESSION_MODE_COOKIE)?.value;
  return raw === "gate_long" ? "gate_long" : "standard";
}

/**
 * Refreshes the Supabase auth session on requests that carry auth cookies.
 * Skips the network round-trip for anonymous visitors (major perf win on public pages).
 */
export async function updateSession(request: NextRequest) {
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasAuthCookie) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const mode = resolveMode(request);
  const cookieOpts = getAuthCookieOptions(mode);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, ...cookieOpts })
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  await supabase.auth.getUser();

  return supabaseResponse;
}
