import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { DEFAULT_COMMISSION_PCT } from "@/lib/config";
import { ORG_TYPE_LABELS, type OrgType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  const [orgs, settings] = await Promise.all([
    db.organization.findMany({
      orderBy: { name: "asc" },
      include: {
        owner: { select: { name: true, email: true, phone: true } },
        _count: { select: { events: true, members: true } },
      },
    }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
  ]);
  const platformDefault = settings?.defaultCommissionPct ?? DEFAULT_COMMISSION_PCT;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Event creators on the platform. Open one to view the owner&apos;s contact
          details and set their commission.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orgs.map((o) => (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {o.name}
                    {o.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ORG_TYPE_LABELS[o.type as OrgType] ?? o.type}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p>{o.owner.name ?? "-"}</p>
                  <p className="text-xs">{o.owner.email}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{o._count.events}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {o.commissionPct ?? platformDefault}%
                  {o.commissionPct === null && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(default)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/organizations/${o.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Manage <ArrowRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
