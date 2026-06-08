import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client (service_role). Server-only. Used to create and
 * delete gate-staff auth accounts from the organizer Team page.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not configured, so callers can
 * degrade gracefully with a clear message.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
