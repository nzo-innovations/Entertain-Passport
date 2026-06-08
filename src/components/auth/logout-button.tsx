"use client";

import { LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearBrowserSession } from "@/lib/session-client";
import { ROUTES } from "@/lib/config";

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const loginPath =
    pathname.startsWith("/gate") || pathname.startsWith("/portal")
      ? ROUTES.organizerLogin
      : pathname.startsWith("/admin")
      ? ROUTES.adminLogin
      : ROUTES.customerLogin;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await clearBrowserSession();
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.push(loginPath);
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
