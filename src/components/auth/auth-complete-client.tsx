"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bindBrowserSession } from "@/lib/session-client";

/**
 * Finishes OAuth / email-link login on the client so we can store the
 * per-window id in sessionStorage (gate staff).
 */
export function AuthCompleteClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/?verified=1";

  React.useEffect(() => {
    async function finish() {
      await bindBrowserSession();
      router.replace(next);
      router.refresh();
    }
    void finish();
  }, [next, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
