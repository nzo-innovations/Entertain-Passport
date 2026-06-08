import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-emerald-500/15 text-emerald-600",
  UPDATE: "bg-amber-500/15 text-amber-600",
  DELETE: "bg-destructive/15 text-destructive",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams?.page) || 1);

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true } } },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.auditLog.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} recorded action(s) across the platform.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.actor?.name ?? l.actor?.email ?? "System"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[l.action] ?? "bg-muted text-muted-foreground"}`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.entity}
                  <span className="ml-1 text-[10px]">#{l.entityId.slice(0, 8)}</span>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                  {l.diffJson ?? "-"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <a
            href={`/admin/audit?page=${page - 1}`}
            className={`rounded-lg border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-accent"}`}
          >
            Previous
          </a>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <a
            href={`/admin/audit?page=${page + 1}`}
            className={`rounded-lg border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-accent"}`}
          >
            Next
          </a>
        </div>
      )}
    </div>
  );
}
