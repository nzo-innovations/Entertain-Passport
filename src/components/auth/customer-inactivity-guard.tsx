"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearBrowserSession } from "@/lib/session-client";
import { clearCustomerSessionHint } from "@/components/auth/customer-session-provider";
import { CUSTOMER_IDLE_TIMEOUT_MS, LAST_ACTIVITY_KEY, touchLastActivity } from "@/lib/session-config";
import { ROUTES } from "@/lib/config";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click"] as const;
const CHECK_INTERVAL_MS = 60_000;

/** Signs out customers after 1 hour of site inactivity. Session cookie TTL is 30 days. */
export function CustomerInactivityGuard() {
  const router = useRouter();
  const roleRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    async function loadRole() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        const data = await res.json();
        roleRef.current = data.user?.role ?? null;
        if (data.user?.role === "CUSTOMER") {
          if (!localStorage.getItem(LAST_ACTIVITY_KEY)) touchLastActivity();
          interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
        }
      } catch {
        roleRef.current = null;
      }
    }

    async function signOutIdle() {
      await clearBrowserSession();
      clearCustomerSessionHint();
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      router.replace(`${ROUTES.customerLogin}?reason=idle`);
      router.refresh();
    }

    function checkIdle() {
      if (roleRef.current !== "CUSTOMER") return;
      const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!raw) return;
      const last = Number(raw);
      if (!Number.isFinite(last)) return;
      if (Date.now() - last >= CUSTOMER_IDLE_TIMEOUT_MS) {
        void signOutIdle();
      }
    }

    const onActivity = () => {
      if (roleRef.current === "CUSTOMER") touchLastActivity();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkIdle();
    });

    void loadRole();

    return () => {
      if (interval) clearInterval(interval);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [router]);

  return null;
}
