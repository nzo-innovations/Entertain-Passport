"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Nfc,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TicketOrderSheet, type OrderGroup } from "@/components/gate/ticket-order-sheet";
import { cn } from "@/lib/utils";

type Stats = { total: number; checkedIn: number; pending: number };
type Result = {
  ok: boolean;
  result?: string;
  message: string;
  ticket?: {
    id?: string;
    holder?: string;
    packageName?: string;
    code?: string;
    passportNo?: string | null;
    isBulk?: boolean;
  };
};
type SearchRow = {
  id: string;
  holder: string;
  buyerName: string;
  packageName: string;
  code: string;
  passportNo: string | null;
  status: string;
  checkedInAt: string | null;
  orderTicketCount: number;
  isBulk: boolean;
};

type Tab = "checkin" | "lookup";

const STATUS_FILTERS = [
  { id: "checked_in", label: "Checked in" },
  { id: "pending", label: "Pending" },
  { id: "all", label: "All" },
] as const;

export function GateConsole({
  eventId,
  initialStats,
}: {
  eventId: string;
  eventTitle: string;
  initialStats: Stats;
}) {
  const [tab, setTab] = React.useState<Tab>("checkin");
  const [code, setCode] = React.useState("");
  const [stats, setStats] = React.useState<Stats>(initialStats);
  const [result, setResult] = React.useState<Result | null>(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Lookup / log state
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_FILTERS)[number]["id"]>("checked_in");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchRow[]>([]);
  const [pages, setPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [searching, setSearching] = React.useState(false);

  // Order detail sheet
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [orderGroup, setOrderGroup] = React.useState<OrderGroup | null>(null);
  const [orderLoading, setOrderLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedQ, statusFilter]);

  const openOrder = async (ticketId: string) => {
    setSheetOpen(true);
    setOrderLoading(true);
    setOrderGroup(null);
    try {
      const res = await fetch(
        `/api/gate/lookup?eventId=${eventId}&ticketId=${encodeURIComponent(ticketId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) setOrderGroup(data.group);
    } finally {
      setOrderLoading(false);
    }
  };

  const checkIn = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/gate/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, code: v }),
      });
      const data = await res.json();
      if (data.stats) setStats(data.stats);
      setResult({
        ok: !!data.ok,
        result: data.result,
        message: data.message ?? data.error ?? "Error",
        ticket: data.ticket,
      });
      setCode("");
      if (data.ok && data.ticket?.id) {
        void openOrder(data.ticket.id);
      }
      if (tab === "lookup") void fetchList();
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const fetchList = React.useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({
        eventId,
        q: debouncedQ,
        status: statusFilter,
        page: String(page),
      });
      const res = await fetch(`/api/gate/search?${params}`, { cache: "no-store" });
      const data = await res.json();
      setRows(data.tickets ?? []);
      setPages(data.pages ?? 1);
      setTotal(data.total ?? 0);
    } finally {
      setSearching(false);
    }
  }, [eventId, debouncedQ, statusFilter, page]);

  React.useEffect(() => {
    if (tab === "lookup") void fetchList();
  }, [tab, fetchList]);

  return (
    <div className="space-y-4">
      {/* Stats — always visible */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Checked in" value={stats.checkedIn} tone="text-emerald-600" />
        <Stat label="Pending" value={stats.pending} tone="text-amber-600" />
        <Stat label="Total" value={stats.total} tone="text-foreground" />
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border bg-muted/30 p-1">
        <TabButton active={tab === "checkin"} onClick={() => setTab("checkin")}>
          <Nfc className="h-4 w-4" /> Check in
        </TabButton>
        <TabButton active={tab === "lookup"} onClick={() => setTab("lookup")}>
          <Users className="h-4 w-4" /> Lookup &amp; log
        </TabButton>
      </div>

      {tab === "checkin" ? (
        <>
          {/* Primary check-in — stays compact */}
          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Nfc className="h-4 w-4 text-primary" /> Tap card or enter ticket / passport ID
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ticket code, RFID UID or EP-number"
                className="min-w-0 flex-1 font-mono text-base tracking-wider sm:text-lg"
                onKeyDown={(e) => e.key === "Enter" && code && checkIn(code)}
                autoFocus
              />
              <Button
                variant="brand"
                size="lg"
                className="w-full shrink-0 sm:w-auto"
                disabled={!code || loading}
                onClick={() => checkIn(code)}
              >
                {loading ? "..." : "Check in"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              NFC readers type the card ID then Enter automatically.
            </p>
          </div>

          {result && (
            <div
              className={cn(
                "rounded-2xl border p-4 sm:p-5",
                result.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
              )}
            >
              <div className="flex items-start gap-3">
                {result.ok ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-6 w-6 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{result.message}</p>
                  {result.ticket?.holder && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {result.ticket.holder} · {result.ticket.packageName}
                    </p>
                  )}
                  {result.ticket?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => openOrder(result.ticket!.id!)}
                    >
                      <Info className="h-4 w-4" />
                      {result.ticket.isBulk ? "View buyer & all tickets" : "View purchase info"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Wrong check-in? Ask your event manager to roll it back.
          </p>
        </>
      ) : (
        <>
          {/* Search + filters */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, code or passport…"
                className="h-9"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === f.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {total.toLocaleString()} result{total !== 1 ? "s" : ""}
              {searching ? " · loading…" : ""}
            </p>
          </div>

          {/* Paginated list — fixed max height, scroll inside */}
          <div className="rounded-2xl border bg-card">
            <ul className="max-h-[min(50vh,420px)] divide-y overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openOrder(r.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.holder}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Buyer: {r.buyerName}
                        {r.isBulk ? ` · ${r.orderTicketCount} tickets` : ""}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {r.passportNo ?? r.code} · {r.packageName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={r.status === "CHECKED_IN" ? "success" : "outline"}>
                        {r.status === "CHECKED_IN" ? "In" : "Pending"}
                      </Badge>
                      {r.checkedInAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.checkedInAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
              {rows.length === 0 && !searching && (
                <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No tickets match. Try another search or filter.
                </li>
              )}
            </ul>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Tap any row to see buyer details and all tickets in the purchase.
          </p>
        </>
      )}

      <TicketOrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        group={orderGroup}
        loading={orderLoading}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center sm:p-4">
      <p className={cn("font-display text-2xl font-bold tabular-nums sm:text-3xl", tone)}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}
