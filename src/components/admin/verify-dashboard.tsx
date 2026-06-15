"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ShieldAlert, KeyRound, CreditCard, RefreshCw, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

type Dashboard = {
  period: string;
  kpis: {
    totalReqs24h: number;
    validReqs24h: number;
    deniedReqs24h: number;
    partnerCount: number;
    activeKeys: number;
    cardCount: number;
    revenueMinor: number;
    billableThisPeriod: number;
  };
  verdictBreakdown: { verdict: string; count: number }[];
  recentLogs: {
    id: string;
    partner: string;
    verdict: string;
    httpStatus: number;
    latencyMs: number;
    ip: string | null;
    reason: string | null;
    billable: boolean;
    createdAt: string;
  }[];
};

const VERDICT_COLOR: Record<string, string> = {
  VALID: "#22c55e",
  BLOCKED: "#f59e0b",
  INVALID: "#ef4444",
  NOT_FOUND: "#64748b",
  DENIED: "#a855f7",
  ERROR: "#dc2626",
};

const VERDICT_BADGE: Record<string, "success" | "warning" | "live" | "secondary" | "brand"> = {
  VALID: "success",
  BLOCKED: "warning",
  INVALID: "live",
  NOT_FOUND: "secondary",
  DENIED: "brand",
  ERROR: "live",
};

export function VerifyDashboard({ data }: { data: Dashboard }) {
  const router = useRouter();
  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Verification API</h1>
          <p className="text-sm text-muted-foreground">
            Isolated B2B card-validation service · tap-only · verdict-only · billing period {data.period}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/admin/api/partners">
            <Button variant="brand" size="sm">
              <Users className="h-4 w-4" /> Partners & keys
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Activity} label="Requests (24h)" value={kpis.totalReqs24h.toLocaleString()} hint={`${kpis.validReqs24h.toLocaleString()} valid`} />
        <Kpi icon={ShieldAlert} label="Denied (24h)" value={kpis.deniedReqs24h.toLocaleString()} hint="auth / limit blocks" />
        <Kpi icon={KeyRound} label="Active keys" value={kpis.activeKeys.toLocaleString()} hint={`${kpis.partnerCount} partners`} />
        <Kpi icon={CreditCard} label="Cards synced" value={kpis.cardCount.toLocaleString()} hint="verification identities" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi
          label="Billable verifications (period)"
          value={kpis.billableThisPeriod.toLocaleString()}
          hint="successful, charged taps"
        />
        <Kpi
          label="Revenue (period)"
          value={formatMoney(kpis.revenueMinor)}
          hint="metered, pre-invoice"
        />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Verdicts (last 24h)</h2>
        {data.verdictBreakdown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No requests in the last 24 hours.</p>
        ) : (
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.verdictBreakdown}>
                <XAxis dataKey="verdict" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.verdictBreakdown.map((d) => (
                    <Cell key={d.verdict} fill={VERDICT_COLOR[d.verdict] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="font-display text-lg font-semibold">Live request feed</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Partner</th>
                <th className="px-4 py-3 text-left">Verdict</th>
                <th className="px-4 py-3 text-left">HTTP</th>
                <th className="px-4 py-3 text-left">Latency</th>
                <th className="px-4 py-3 text-left">IP</th>
                <th className="px-4 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.recentLogs.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2.5">{l.partner}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={VERDICT_BADGE[l.verdict] ?? "secondary"}>{l.verdict}</Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.httpStatus}</td>
                  <td className="px-4 py-2.5 text-xs">{l.latencyMs}ms</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{l.ip ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.reason ?? "—"}</td>
                </tr>
              ))}
              {data.recentLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No requests yet. Issue a partner key to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
