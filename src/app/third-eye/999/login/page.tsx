import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

// Hidden, unlinked admin login. Keep it out of search engines.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function ThirdEyeLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <AuthForm
            variant="admin"
            allowSignup={false}
            title="Platform admin"
            subtitle="Authorized access only."
          />
        </Suspense>
      </div>
    </div>
  );
}
