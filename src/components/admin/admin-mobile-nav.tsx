"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarPlus,
  ClipboardCheck,
  CreditCard,
  Layers,
  MapPinned,
  ScanLine,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { MobileNavSheet } from "@/components/shared/mobile-nav-sheet";

export function AdminMobileNav({ pendingCount }: { pendingCount: number }) {
  const items = [
    { label: "Overview", href: "/admin", icon: BarChart3 },
    { label: "Approvals", href: "/admin/approvals", icon: ClipboardCheck, badge: pendingCount },
    { label: "All Events", href: "/admin/events", icon: CalendarPlus },
    { label: "Organizations", href: "/admin/organizations", icon: Users },
    { label: "Gate staff", href: "/admin/gate-staff", icon: ScanLine },
    { label: "Passports (RFID)", href: "/admin/rfid", icon: CreditCard },
    { label: "Loyalty & rewards", href: "/admin/loyalty", icon: Sparkles },
    { label: "Verification API", href: "/admin/api", icon: ShieldCheck },
    { label: "Categories", href: "/admin/categories", icon: Tag },
    { label: "Venues", href: "/admin/venues", icon: MapPinned },
    { label: "Alerts", href: "/admin/alerts", icon: Bell },
    { label: "Audit log", href: "/admin/audit", icon: Shield },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <MobileNavSheet
      title="Super Admin"
      items={items}
      triggerClassName="lg:hidden"
      footer={
        <Link
          href="/admin/events/new"
          className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-accent"
        >
          <Layers className="h-4 w-4" />
          Create event (admin)
        </Link>
      }
    />
  );
}
