import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_MODE_COOKIE, WINDOW_ID_COOKIE } from "@/lib/session-config";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  res.cookies.set(SESSION_MODE_COOKIE, "", { maxAge: 0, path: "/" });
  res.cookies.set(WINDOW_ID_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
