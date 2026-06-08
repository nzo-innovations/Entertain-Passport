import Link from "next/link";

import { redirect } from "next/navigation";

import { CalendarDays, ShieldCheck } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";

import { getSession } from "@/lib/auth";

import { ensureOrganizerOrganization, getPortalOrgType } from "@/lib/organizer";

import { Logo } from "@/components/shared/logo";

import { ThemeToggle } from "@/components/shared/theme-toggle";

import { Button } from "@/components/ui/button";

import { PortalMobileNav, PortalSidebarNav } from "@/components/portal/portal-mobile-nav";

import { UserRole, OrgType, isPortalRole, USER_ROLE_LABELS } from "@/lib/types";



export default async function PortalLayout({ children }: { children: React.ReactNode }) {

  const session = await getSession();

  if (!session) redirect("/organizer/login");

  if (session.role === UserRole.CUSTOMER) redirect("/");

  if (session.role === UserRole.SUPER_ADMIN) redirect("/admin");

  if (session.role === UserRole.GATE_STAFF) redirect("/gate");

  if (!isPortalRole(session.role)) redirect("/");

  await ensureOrganizerOrganization();

  const orgType = await getPortalOrgType(session.id);
  const showVenueNav =
    session.role === UserRole.BUSINESS_OWNER || orgType === OrgType.BUSINESS_OWNER;

  const roleLabel = USER_ROLE_LABELS[session.role as UserRole] ?? session.role;

  return (

    <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">

      <aside className="hidden border-r bg-card/40 lg:block">

        <div className="flex h-16 items-center border-b px-5">

          <Logo />

        </div>

        <div className="px-3 py-4">

          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">

            Organizer portal

          </p>

          <div className="mt-2 rounded-xl border bg-background p-3">

            <p className="truncate text-sm font-semibold">{session.name}</p>

            <p className="truncate text-[11px] text-muted-foreground">{session.email}</p>

            <p className="mt-1 text-[10px] uppercase tracking-wider text-primary">

              {roleLabel}

            </p>

          </div>

        </div>

        <PortalSidebarNav showVenueNav={showVenueNav} />

        <div className="mt-6 px-3">

          <Link

            href="/portal/events/new"

            className="flex items-center gap-3 rounded-xl gradient-brand px-3 py-3 text-sm font-semibold text-white shadow-md shadow-primary/20"

          >

            <CalendarDays className="h-4 w-4" />

            Create new show

          </Link>

        </div>

      </aside>



      <div className="flex min-w-0 flex-col">

        <header className="sticky top-0 z-30 flex h-14 min-h-14 items-center gap-2 border-b glass px-4 sm:h-16 sm:gap-3 sm:px-6">

          <PortalMobileNav showVenueNav={showVenueNav} />

          <h1 className="truncate font-display text-base font-semibold sm:text-lg">Organizer portal</h1>

          <ShieldCheck className="hidden h-4 w-4 shrink-0 text-emerald-500 sm:block" />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">

            <ThemeToggle />

            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">

              <Link href="/">Public site</Link>

            </Button>

            <LogoutButton />

          </div>

        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      </div>

    </div>

  );

}


