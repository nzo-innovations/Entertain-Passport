"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type CustomerSessionUser = {
  displayName: string;
};

type CustomerSessionContextValue = {
  user: CustomerSessionUser | null;
  /** True only before the first session resolution when no cached hint exists. */
  loading: boolean;
  isSignedIn: boolean;
};

const CustomerSessionContext = React.createContext<CustomerSessionContextValue>({
  user: null,
  loading: true,
  isSignedIn: false,
});

const SESSION_HINT_KEY = "ep_customer_session_hint";

function nameFromMetadata(meta: Record<string, unknown> | undefined, email?: string): string {
  const first = typeof meta?.firstName === "string" ? meta.firstName : "";
  const last = typeof meta?.lastName === "string" ? meta.lastName : "";
  const combined = [first, last].filter(Boolean).join(" ");
  if (combined) return combined;
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  if (email) return email.split("@")[0];
  return "Account";
}

function isCustomerRole(role: unknown): boolean {
  return role === "CUSTOMER" || role == null || role === "";
}

function readSessionHint(): CustomerSessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerSessionUser;
    return parsed?.displayName ? parsed : null;
  } catch {
    return null;
  }
}

function writeSessionHint(user: CustomerSessionUser | null) {
  try {
    if (user) sessionStorage.setItem(SESSION_HINT_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* ignore */
  }
}

function userFromClientSession(
  authUser: { email?: string; user_metadata?: Record<string, unknown> } | undefined
): CustomerSessionUser | null {
  if (!authUser || !isCustomerRole(authUser.user_metadata?.role)) return null;
  return {
    displayName: nameFromMetadata(authUser.user_metadata, authUser.email),
  };
}

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CustomerSessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const applyUser = React.useCallback((next: CustomerSessionUser | null) => {
    setUser(next);
    writeSessionHint(next);
  }, []);

  const refresh = React.useCallback(
    async (background = false) => {
      if (!background && !readSessionHint()) setLoading(true);

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session: clientSession },
      } = await supabase.auth.getSession();

      const quick = userFromClientSession(clientSession?.user);
      if (quick) {
        applyUser(quick);
        setLoading(false);
      }

      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        const data = res.ok ? await res.json() : null;
        if (data?.user?.role === "CUSTOMER") {
          applyUser({
            displayName: data.user.displayName ?? data.user.email?.split("@")[0] ?? "Account",
          });
          setLoading(false);
          return;
        }
      } catch {
        /* fall through */
      }

      applyUser(quick);
      setLoading(false);
    },
    [applyUser]
  );

  React.useLayoutEffect(() => {
    const cached = readSessionHint();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh(Boolean(readSessionHint()));
  }, [refresh]);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh(true);
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const value = React.useMemo(
    () => ({ user, loading, isSignedIn: !!user }),
    [user, loading]
  );

  return (
    <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>
  );
}

export function useCustomerSession() {
  return React.useContext(CustomerSessionContext);
}

/** Call after logout to clear the instant session hint. */
export function clearCustomerSessionHint() {
  writeSessionHint(null);
}
