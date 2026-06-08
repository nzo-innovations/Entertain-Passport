import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Mail, Phone, User } from "lucide-react";
import { db } from "@/lib/db";
import { OrganizationEditor } from "@/components/admin/organization-editor";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { DEFAULT_COMMISSION_PCT } from "@/lib/config";
import { ORG_TYPE_LABELS, type OrgType } from "@/lib/types";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationDetailPage({ params }: { params: { id: string } }) {
  const [org, settings] = await Promise.all([
    db.organization.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        members: { include: { user: { select: { name: true, email: true } } } },
        events: {
          orderBy: { startsAt: "asc" },
          include: { category: true },
        },
      },
    }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!org) notFound();
  const platformDefault = settings?.defaultCommissionPct ?? DEFAULT_COMMISSION_PCT;

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Organizations
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold">{org.name}</h1>
          {org.isVerified && <BadgeCheck className="h-5 w-5 text-emerald-500" />}
        </div>
        <p className="text-sm text-muted-foreground">
          {ORG_TYPE_LABELS[org.type as OrgType] ?? org.type}
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Owner / contact</h2>
        <div className="mt-3 space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {org.owner.name ?? "-"}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${org.owner.email}`} className="text-primary hover:underline">
              {org.owner.email}
            </a>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {org.owner.phone ? (
              <a href={`tel:${org.owner.phone}`} className="text-primary hover:underline">
                {org.owner.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">No phone on file</span>
            )}
          </p>
          {org.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Org line:</span> {org.phone}
            </p>
          )}
        </div>
        {org.members.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
            <ul className="mt-2 space-y-1 text-sm">
              {org.members.map((m) => (
                <li key={m.id} className="text-muted-foreground">
                  {m.user.name ?? m.user.email} · {m.role}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <OrganizationEditor
        id={org.id}
        platformDefault={platformDefault}
        initial={{
          name: org.name,
          phone: org.phone ?? "",
          website: org.website ?? "",
          isVerified: org.isVerified,
          commissionPct: org.commissionPct,
        }}
      />

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Events ({org.events.length})</h2>
        <div className="mt-3 divide-y">
          {org.events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.category.name} · {formatEventDate(e.startsAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ApprovalBadge status={e.approvalStatus} />
                <Link
                  href={`/admin/events/${e.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
          {org.events.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No events yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
