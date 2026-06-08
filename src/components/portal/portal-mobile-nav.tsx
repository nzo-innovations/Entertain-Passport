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

const BASE_NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "My Events", href: "/portal/events", icon: CalendarDays },
  { label: "Analytics", href: "/portal/analytics", icon: BarChart3 },
  { label: "Team", href: "/portal/team", icon: Users },
];

const VENUE_NAV = { label: "My Venue", href: "/portal/venue", icon: Building2 };

function buildNav(showVenueNav: boolean) {
  return showVenueNav ? [BASE_NAV[0], VENUE_NAV, ...BASE_NAV.slice(1)] : BASE_NAV;
}

export function PortalSidebarNav({ showVenueNav = false }: { showVenueNav?: boolean }) {
  const items = buildNav(showVenueNav);
  return (
    <nav className="px-3">
      <ul className="space-y-0.5">
        {items.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
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
