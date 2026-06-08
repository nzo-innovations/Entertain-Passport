import { Suspense } from "react";
import { AuthCompleteClient } from "@/components/auth/auth-complete-client";

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
      }
    >
      <AuthCompleteClient />
    </Suspense>
  );
}
