import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles the redirect from Supabase Auth email links / OAuth.
 * Exchanges the `code` for a session, then redirects to `next` (or home).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = encodeURIComponent(next);
      return NextResponse.redirect(`${origin}/auth/complete?next=${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
