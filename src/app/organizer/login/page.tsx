import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { PLACES_LABEL, ROUTES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Organizer portal - Sign in",
};

export default function OrganizerLoginPage() {
  return (
    <div className="container max-w-lg py-16">
      <Link
        href={ROUTES.venues}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {PLACES_LABEL}
      </Link>
      <Suspense fallback={null}>
        <AuthForm
          variant="organizer"
          subtitle="Event organizers, artist managers, artists & gate staff sign in here. To publish a pub, café or club on Places to Go, sign up as Company / Venue Owner."
        />
      </Suspense>
    </div>
  );
}
