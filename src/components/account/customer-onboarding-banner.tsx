"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, Sparkles, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config";

type MeResponse = {
  user: { role: string; displayName: string; loyaltyPoints: number } | null;
  profileComplete?: boolean;
  hasPassport?: boolean;
};

const DISMISS_KEY = "ep_onboarding_banner_dismiss";

export function CustomerOnboardingBanner() {
  const params = useSearchParams();
  const justVerified = params.get("verified") === "1";
  const justWelcome = params.get("welcome") === "1";
  const [data, setData] = React.useState<MeResponse | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.user || data.user.role !== "CUSTOMER") return null;

  const needsProfile = !data.profileComplete;
  const needsPassport = !data.hasPassport;
  const showBanner = needsProfile || needsPassport;

  if (!showBanner && !justVerified && !justWelcome) return null;
  if (dismissed && !justVerified && !justWelcome) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  const headline = justVerified
    ? "Email verified - welcome to Entertain Passport!"
    : justWelcome
      ? "Welcome to Entertain Passport!"
      : needsProfile && needsPassport
        ? "Finish setting up your account"
        : needsProfile
          ? "Complete your profile"
          : "Order your Entertain Passport card";

  const detail = justVerified
    ? "You're signed in. Complete your profile and order your physical Entertain Passport card when you're ready."
    : needsProfile && needsPassport
      ? "Add your contact details, then order your physical Entertain Passport card for faster entry and loyalty rewards."
      : needsProfile
        ? "Add your mobile number, gender and address to unlock loyalty rewards and card delivery."
        : "Get your physical Entertain Passport card - shipped by SL registered post.";

  return (
    <div className="border-b border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent">
      <div className="container flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold">{headline}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
            {data.user.loyaltyPoints > 0 && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                {data.user.loyaltyPoints.toLocaleString()} loyalty points
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {needsProfile && (
            <Button variant="brand" size="sm" asChild>
              <Link href={ROUTES.profile}>
                <User className="h-4 w-4" />
                Complete profile
              </Link>
            </Button>
          )}
          {needsPassport && (
            <Button variant={needsProfile ? "outline" : "brand"} size="sm" asChild>
              <Link href={ROUTES.passport}>
                <CreditCard className="h-4 w-4" />
                Order Entertain Passport
              </Link>
            </Button>
          )}
          {!justVerified && (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Dismiss" onClick={dismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
