"use client";

import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarDays,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MobileNavSheet } from "@/components/shared/mobile-nav-sheet";

const BASE_NAV: { label: string; href: string; icon: LucideIcon; section?: string }[] = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "My Events", href: "/portal/events", icon: CalendarDays, section: "Discover & Shows" },
  { label: "Analytics", href: "/portal/analytics", icon: BarChart3, section: "Discover & Shows" },
  { label: "Team", href: "/portal/team", icon: Users },
];

const VENUE_NAV = {
  label: "My Venue",
  href: "/portal/venue",
  icon: Building2,
  section: "Places to Go",
};

function buildNav(showVenueNav: boolean) {
  if (!showVenueNav) return BASE_NAV;
  return [BASE_NAV[0], BASE_NAV[1], VENUE_NAV, ...BASE_NAV.slice(2)];
}

function NavList({ items }: { items: ReturnType<typeof buildNav> }) {
  let lastSection: string | undefined;
  return (
    <ul className="space-y-0.5">
      {items.map((n) => {
        const showHeader = n.section && n.section !== lastSection;
        lastSection = n.section ?? lastSection;
        return (
          <li key={n.href}>
            {showHeader && (
              <p className="mb-1 mt-3 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground first:mt-0">
                {n.section}
              </p>
            )}
            <Link
              href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PortalSidebarNav({ showVenueNav = false }: { showVenueNav?: boolean }) {
  const items = buildNav(showVenueNav);
  return (
    <nav className="px-3">
      <NavList items={items} />
    </nav>
  );
}

export function PortalMobileNav({ showVenueNav = false }: { showVenueNav?: boolean }) {
  const items = buildNav(showVenueNav);

  return (
    <MobileNavSheet
      title="Organizer portal"
      items={items}
      triggerClassName="lg:hidden"
      footer={
        <Link
          href="/portal/events/new"
          className="flex items-center justify-center gap-2 rounded-xl gradient-brand px-4 py-3 text-sm font-semibold text-white"
        >
          <CalendarDays className="h-4 w-4" />
          Create new show
        </Link>
      }
    />
  );
}
