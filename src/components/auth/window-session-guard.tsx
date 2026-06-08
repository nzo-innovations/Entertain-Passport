"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { WINDOW_STORAGE_KEY } from "@/lib/session-config";

/**
 * Gate staff must log in per browser window. This guard verifies the window id
 * stored at login (sessionStorage) matches the server cookie for this window.
 */
export function WindowSessionGuard({ loginPath = "/organizer/login" }: { loginPath?: string }) {
  const router = useRouter();
  const checked = React.useRef(false);

  React.useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    async function verify() {
      const windowId = sessionStorage.getItem(WINDOW_STORAGE_KEY);
      if (!windowId) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace(`${loginPath}?error=window`);
        router.refresh();
        return;
      }

      try {
        const res = await fetch("/api/auth/session", {
          headers: { "X-EP-Window-Id": windowId },
          cache: "no-store",
        });
        if (!res.ok) {
          sessionStorage.removeItem(WINDOW_STORAGE_KEY);
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
          router.replace(`${loginPath}?error=window`);
          router.refresh();
        }
      } catch {
        /* network blip — keep session */
      }
    }

    void verify();
  }, [loginPath, router]);

  return null;
}
