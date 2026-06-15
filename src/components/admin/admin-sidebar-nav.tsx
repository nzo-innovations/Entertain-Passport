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
  Tag,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/admin", icon: BarChart3 },
  { label: "Approvals", href: "/admin/approvals", icon: ClipboardCheck },
  { label: "All Events", href: "/admin/events", icon: CalendarPlus },
  { label: "Organizations", href: "/admin/organizations", icon: Users },
  { label: "Gate staff", href: "/admin/gate-staff", icon: ScanLine },
  { label: "Passports (RFID)", href: "/admin/rfid", icon: CreditCard },
  { label: "Verification API", href: "/admin/api", icon: ShieldCheck },
  { label: "Categories", href: "/admin/categories", icon: Tag },
  { label: "Venues", href: "/admin/venues", icon: MapPinned },
  { label: "Alerts", href: "/admin/alerts", icon: Bell },
  { label: "Audit log", href: "/admin/audit", icon: Shield },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebarNav({ pendingCount }: { pendingCount: number }) {
  return (
    <>
      <nav className="px-3">
        <ul className="space-y-0.5">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{n.label}</span>
                {n.href === "/admin/approvals" && pendingCount > 0 && (
                  <Badge variant="warning" className="ml-auto h-5 min-w-[20px] justify-center px-1 text-[10px]">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 px-3">
        <Link
          href="/admin/events/new"
          className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold hover:bg-accent"
        >
          <Layers className="h-4 w-4 shrink-0" />
          Create event (admin)
        </Link>
      </div>
    </>
  );
}
