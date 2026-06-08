import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApprovalBadge } from "@/components/shared/approval-badge";
import { ReviewEventActions } from "@/components/admin/review-event-actions";
import { ApprovalStatus } from "@/lib/types";
import { formatEventDate } from "@/lib/format";
import { ORG_TYPE_LABELS, type OrgType } from "@/lib/types";

export default async function AdminApprovalsPage() {
  try {
    await requireSuperAdmin();
  } catch {
    redirect("/login");
  }

  const pending = await db.event.findMany({
    where: { approvalStatus: ApprovalStatus.PENDING_REVIEW },
    include: {
      organization: true,
      category: true,
      venue: true,
      packages: true,
      primaryImage: true,
    },
    orderBy: { submittedAt: "asc" },
  });

  const recent = await db.event.findMany({
    where: {
      approvalStatus: {
        in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CHANGES_REQUESTED],
      },
    },
    include: { organization: true, category: true },
    orderBy: { reviewedAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold">Event approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review organizer submissions before they go live for customers.
        </p>
      </header>

      <section>
        <h2 className="font-display text-lg font-semibold">
          Pending review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            No events waiting for approval.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((e) => (
              <li key={e.id} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ApprovalBadge status={e.approvalStatus} />
                      <span className="text-xs text-muted-foreground">{e.category.name}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{e.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {e.organization.name} (
                      {ORG_TYPE_LABELS[e.organization.type as OrgType] ?? e.organization.type}) ·{" "}
                      {e.venue.name} · {formatEventDate(e.startsAt)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm">{e.shortDescription ?? e.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Submitted {e.submittedAt ? new Date(e.submittedAt).toLocaleString() : "-"}
                    </p>
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      View full details &amp; creator profile
                    </Link>
                  </div>
                  <ReviewEventActions eventId={e.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Recently reviewed</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Organizer</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/events/${e.id}`} className="hover:text-primary hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.organization.name}</td>
                  <td className="px-4 py-3">
                    <ApprovalBadge status={e.approvalStatus} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {e.reviewNote ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
