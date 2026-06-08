import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="container max-w-lg py-16">
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
