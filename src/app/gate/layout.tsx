import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { WindowSessionGuard } from "@/components/auth/window-session-guard";
import { UserRole, isCreatorRole } from "@/lib/types";

export default async function GateLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/organizer/login");
  if (session.role === UserRole.CUSTOMER) redirect("/");
  if (isCreatorRole(session.role)) redirect("/portal");
  // Allowed: GATE_STAFF (primary) and SUPER_ADMIN (oversight).

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <WindowSessionGuard loginPath="/organizer/login" />
      <header className="sticky top-0 z-30 flex h-14 min-h-14 flex-wrap items-center gap-2 border-b glass px-3 sm:h-16 sm:gap-3 sm:px-5">
        <Logo className="min-w-0 shrink" />
        <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:inline-flex">
          <ScanLine className="h-3.5 w-3.5" /> Gate check-in
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden max-w-[140px] truncate text-sm text-muted-foreground md:inline lg:max-w-none">
            {session.name ?? session.email}
          </span>
          <Link href="/gate" className="whitespace-nowrap text-sm font-medium text-primary hover:underline">
            My events
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-6 sm:px-4 sm:py-8">{children}</main>
    </div>
  );
}
