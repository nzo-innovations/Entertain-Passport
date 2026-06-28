"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Ticket, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearBrowserSession } from "@/lib/session-client";
import { clearCustomerSessionHint } from "@/components/auth/customer-session-provider";
import { ROUTES } from "@/lib/config";
import { useCustomerSession } from "@/hooks/use-customer-session";

export function CustomerAccountMenu() {
  const router = useRouter();
  const { user, loading } = useCustomerSession();

  async function handleLogout() {
    await clearBrowserSession();
    clearCustomerSessionHint();
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push(ROUTES.customerLogin);
    router.refresh();
  }

  if (loading && !user) {
    return <span className="hidden h-8 w-24 sm:inline-block" aria-hidden />;
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
        <Link href={ROUTES.customerLogin}>
          <User className="h-4 w-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <div className="hidden items-center gap-1 sm:flex">
      <Button variant="outline" size="sm" asChild className="max-w-[160px]">
        <Link href={ROUTES.tickets} title="My tickets">
          <Ticket className="h-4 w-4 shrink-0" />
          <span className="truncate">{user.displayName}</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Log out"
        onClick={() => void handleLogout()}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CustomerAccountMenuMobile({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { user, loading } = useCustomerSession();

  async function handleLogout() {
    await clearBrowserSession();
    clearCustomerSessionHint();
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    onNavigate?.();
    router.push(ROUTES.customerLogin);
    router.refresh();
  }

  if (loading && !user) return null;

  if (!user) {
    return (
      <Button variant="outline" asChild className="w-full justify-center">
        <Link href={ROUTES.customerLogin} onClick={onNavigate}>
          <User className="h-4 w-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="rounded-lg bg-accent/60 px-3 py-2 text-sm">
        Signed in as <span className="font-semibold">{user.displayName}</span>
      </p>
      <Button variant="outline" asChild className="w-full justify-center">
        <Link href={ROUTES.tickets} onClick={onNavigate}>
          <Ticket className="h-4 w-4" />
          My tickets
        </Link>
      </Button>
      <Button variant="ghost" className="w-full justify-center" onClick={() => void handleLogout()}>
        <LogOut className="h-4 w-4" />
        Log out
      </Button>
    </div>
  );
}
