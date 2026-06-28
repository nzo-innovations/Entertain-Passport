import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { getNfcAnalyticsSummary } from "@/lib/nfc/analytics";
import { Nfc, ShieldAlert, ShieldCheck, Ticket } from "lucide-react";
import Link from "next/link";

export async function NfcAnalyticsSection() {
  const data = await getNfcAnalyticsSummary();

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">NFC Passports</p>
          <h2 className="mt-1 font-display text-xl font-bold">Secure tap analytics (24h)</h2>
        </div>
        <Link
          href="/admin/nfc"
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage passports →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active NFC cards" value={String(data.totalCards)} icon={Nfc} />
        <StatCard
          label="Gate allows (24h)"
          value={String(data.scans24h.allow)}
          icon={ShieldCheck}
          delta={data.scans24h.total ? Math.round((data.scans24h.allow / data.scans24h.total) * 100) : 0}
        />
        <StatCard label="Gate denials (24h)" value={String(data.scans24h.deny)} icon={ShieldAlert} />
        <StatCard
          label="Pending fulfillments"
          value={String(data.pendingOrders)}
          icon={Ticket}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(data.cardsByStatus).map(([status, count]) => (
          <Badge key={status} variant="outline" className="font-mono text-xs">
            {status}: {count}
          </Badge>
        ))}
        <Badge variant="secondary" className="text-xs">
          Invalid signatures: {data.failedSignatures24h}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Blocked attempts: {data.blockedAttempts24h}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Fulfilled orders: {data.fulfilledOrders}
        </Badge>
      </div>

      {data.recentScans.length > 0 && (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Verdict</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.recentScans.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={s.verdict === "ALLOW" ? "success" : "warning"}>{s.verdict}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.reason}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.eventTitle ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
