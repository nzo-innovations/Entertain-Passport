"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Nfc,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TicketOrderSheet, type OrderGroup } from "@/components/gate/ticket-order-sheet";
import { NfcReaderStatus } from "@/components/gate/nfc-reader-status";
import { NfcHardwareAccessPrompt } from "@/components/gate/nfc-hardware-access-prompt";
import { GateAndroidWalletCollector } from "@/components/gate/gate-android-wallet-collector";
import { GateTapPanel, type CheckInPhase, type PassportScanInfo } from "@/components/gate/gate-tap-panel";
import { useToast } from "@/components/ui/use-toast";
import { KEYBOARD_WEDGE_HINT } from "@/lib/nfc/usb-reader-filters";
import { findSignedTagJsonString } from "@/lib/nfc/passport-ndef";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import { cn } from "@/lib/utils";

type Stats = { total: number; checkedIn: number; pending: number };
type PhysicalSuggestion = {
  packageId: string;
  packageName: string;
  purchasedQty: number;
  available: Array<{ id: string; refCode: string }>;
};
type SearchRow = {
  id: string;
  holder: string;
  buyerName: string;
  packageName: string;
  identity: string;
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
  eventTitle,
  venueName,
  initialStats,
}: {
  eventId: string;
  eventTitle: string;
  venueName: string;
  initialStats: Stats;
}) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("checkin");
  const [code, setCode] = React.useState("");
  const [stats, setStats] = React.useState<Stats>(initialStats);
  const [phase, setPhase] = React.useState<CheckInPhase>("ready");
  const [resultMessage, setResultMessage] = React.useState("");
  const [processingMs, setProcessingMs] = React.useState<number | null>(null);
  const [orderGroup, setOrderGroup] = React.useState<OrderGroup | null>(null);
  const [scannedTicketId, setScannedTicketId] = React.useState<string | null>(null);
  const [passportScan, setPassportScan] = React.useState<PassportScanInfo | null>(null);
  const [physicalTickets, setPhysicalTickets] = React.useState<PhysicalSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [markingPhysicalId, setMarkingPhysicalId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const processingStart = React.useRef<number | null>(null);
  const processingTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_FILTERS)[number]["id"]>("checked_in");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchRow[]>([]);
  const [pages, setPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [searching, setSearching] = React.useState(false);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetGroup, setSheetGroup] = React.useState<OrderGroup | null>(null);
  const [orderLoading, setOrderLoading] = React.useState(false);

  const checkInRef = React.useRef<(value: string) => void>(() => {});

  const nfcReader = useNfcReader({
    enabled: tab === "checkin" && phase === "ready",
    onRead: (payload) => checkInRef.current(payload),
  });

  const handleRequestHardwareAccess = React.useCallback(async () => {
    await nfcReader.requestHardwareAccess();
    if (nfcReader.webNfcSupported && nfcReader.status === "connected") {
      toast({ title: "Built-in NFC ready", description: "Tap Entertain Passport on this device." });
    }
  }, [nfcReader, toast]);

  const handlePairUsbReader = React.useCallback(async () => {
    const result = await nfcReader.pairUsbReader();
    if (result.ok) {
      toast({ title: "Reader paired", description: result.label });
      return;
    }
    if (result.mode === "cancelled" || result.mode === "keyboard-wedge") {
      toast({ title: "Keyboard-mode reader?", description: KEYBOARD_WEDGE_HINT });
      inputRef.current?.focus();
    } else if (result.mode === "error") {
      toast({ title: "Pair failed", description: result.message, variant: "destructive" });
    }
  }, [nfcReader, toast]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedQ, statusFilter]);

  const startProcessingTimer = () => {
    processingStart.current = performance.now();
    setProcessingMs(0);
    processingTimer.current = setInterval(() => {
      if (processingStart.current != null) {
        setProcessingMs(Math.round(performance.now() - processingStart.current));
      }
    }, 50);
  };

  const stopProcessingTimer = () => {
    if (processingTimer.current) clearInterval(processingTimer.current);
    if (processingStart.current != null) {
      setProcessingMs(Math.round(performance.now() - processingStart.current));
    }
    processingStart.current = null;
  };

  const fetchOrderGroup = React.useCallback(async (ticketId: string) => {
    const res = await fetch(
      `/api/gate/lookup?eventId=${eventId}&ticketId=${encodeURIComponent(ticketId)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (res.ok && data.group) {
      const group = data.group as OrderGroup;
      group.tickets = group.tickets.map((t) => ({
        ...t,
        isHighlighted: t.id === ticketId,
      }));
      return group;
    }
    return null;
  }, [eventId]);

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

  const resetForNextScan = () => {
    setPhase("ready");
    setResultMessage("");
    setProcessingMs(null);
    setOrderGroup(null);
    setScannedTicketId(null);
    setPassportScan(null);
    setPhysicalTickets([]);
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const checkIn = React.useCallback(
    async (value: string) => {
      const v = value.trim();
      if (!v || loading || phase === "processing" || phase === "success") return;

      setLoading(true);
      setPhase("processing");
      setResultMessage("");
      setOrderGroup(null);
      setScannedTicketId(null);
      setPassportScan(null);
      startProcessingTimer();

      try {
        let res: Response;
        let data: Record<string, unknown>;

        const nfcPayload = (() => {
          const json = findSignedTagJsonString(v);
          if (!json) return null;
          try {
            const p = JSON.parse(json) as Record<string, unknown>;
            if (typeof p.signature === "string") {
              if (typeof p.internalPassportUuid === "string") return p;
              if (typeof p.passportId === "string") return p;
            }
          } catch {
            /* legacy */
          }
          return null;
        })();

        if (nfcPayload) {
          res = await fetch("/api/nfc/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...nfcPayload, eventId, checkIn: true }),
          });
          data = await res.json();
          const verdict = data.verdict as string | undefined;
          if (data.stats) setStats(data.stats as Stats);

          if (verdict === "ALLOW") {
            const ticketId = data.ticketId as string | undefined;
            setResultMessage((data.reason as string) ?? "Welcome!");
            setScannedTicketId(ticketId ?? null);
            const channel = data.credentialChannel as PassportScanInfo["credentialChannel"] | undefined;
            const passportNo = data.passportNo as string | undefined;
            const holder = data.holder as string | undefined;
            if (passportNo && holder && (channel === "PHYSICAL" || channel === "WALLET")) {
              setPassportScan({
                passportNo,
                holder,
                packageName: data.packageName as string | undefined,
                credentialChannel: channel,
              });
            }
            if (ticketId) {
              const group = await fetchOrderGroup(ticketId);
              setOrderGroup(group);
            }
            setPhase("success");
          } else {
            setResultMessage((data.reason as string) ?? (data.error as string) ?? "Entry denied");
            setPhase("denied");
          }
        } else {
          res = await fetch("/api/gate/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, code: v }),
          });
          data = await res.json();
          if (data.stats) setStats(data.stats as Stats);

          if (data.ok) {
            const ticket = data.ticket as { id?: string; holder?: string } | undefined;
            setResultMessage((data.message as string) ?? "Entry granted");
            setScannedTicketId(ticket?.id ?? null);
            setPhysicalTickets((data.physicalTickets as PhysicalSuggestion[]) ?? []);
            if (ticket?.id) {
              const group = await fetchOrderGroup(ticket.id);
              setOrderGroup(group);
            }
            setPhase("success");
          } else {
            setResultMessage((data.message as string) ?? (data.error as string) ?? "Entry denied");
            setPhase("denied");
          }
        }

        setCode("");
        if (tab === "lookup") void fetchList();
      } finally {
        stopProcessingTimer();
        setLoading(false);
      }
    },
    [eventId, loading, phase, tab, fetchOrderGroup, fetchList]
  );

  checkInRef.current = checkIn;

  const openOrder = async (ticketId: string) => {
    setSheetOpen(true);
    setOrderLoading(true);
    setSheetGroup(null);
    try {
      const group = await fetchOrderGroup(ticketId);
      setSheetGroup(group);
    } finally {
      setOrderLoading(false);
    }
  };

  const markPhysicalSold = async (physicalId: string) => {
    setMarkingPhysicalId(physicalId);
    try {
      const res = await fetch(`/api/events/${eventId}/physical/${physicalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SOLD" }),
      });
      if (!res.ok) return;
      setPhysicalTickets((current) =>
        current.map((group) => ({
          ...group,
          available: group.available.filter((t) => t.id !== physicalId),
        }))
      );
    } finally {
      setMarkingPhysicalId(null);
    }
  };

  const handleWalletVerified = React.useCallback(
    async (result: {
      passportScan: PassportScanInfo;
      ticketId: string;
      message: string;
      stats?: Stats;
    }) => {
      if (result.stats) setStats(result.stats);
      setPassportScan(result.passportScan);
      setResultMessage(result.message);
      setScannedTicketId(result.ticketId);
      const group = await fetchOrderGroup(result.ticketId);
      setOrderGroup(group);
      setPhase("success");
    },
    [fetchOrderGroup]
  );

  const handleWalletDenied = React.useCallback((message: string) => {
    setPassportScan(null);
    setResultMessage(message);
    setOrderGroup(null);
    setScannedTicketId(null);
    setPhase("denied");
  }, []);

  React.useEffect(() => {
    if (tab === "lookup") void fetchList();
  }, [tab, fetchList]);

  React.useEffect(() => {
    if (tab === "checkin" && phase === "ready") {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [tab, phase]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Checked in" value={stats.checkedIn} tone="text-emerald-600" />
        <Stat label="Pending" value={stats.pending} tone="text-amber-600" />
        <Stat label="Total" value={stats.total} tone="text-foreground" />
      </div>

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
          {nfcReader.needsHardwarePermission && (
            <NfcHardwareAccessPrompt
              webNfcSupported={nfcReader.webNfcSupported}
              webHidSupported={nfcReader.webHidSupported}
              requesting={nfcReader.requestingAccess}
              onRequestAccess={() => void handleRequestHardwareAccess()}
            />
          )}

          <NfcReaderStatus
            reader={nfcReader}
            onRetry={() => void handleRequestHardwareAccess()}
            onPairUsb={() => void handlePairUsbReader()}
            pairingUsb={nfcReader.pairingUsb}
            onFocusScan={() => inputRef.current?.focus()}
          />

          <GateAndroidWalletCollector
            eventId={eventId}
            disabled={loading || phase === "processing" || phase === "success"}
            onVerified={(r) => void handleWalletVerified(r)}
            onDenied={handleWalletDenied}
          />

          <GateTapPanel
            phase={phase}
            processingMs={processingMs}
            resultMessage={resultMessage}
            orderGroup={orderGroup}
            scannedTicketId={scannedTicketId}
            passportScan={passportScan}
            venueName={venueName}
            eventTitle={eventTitle}
            code={code}
            loading={loading}
            onCodeChange={(v) => {
              setCode(v);
              nfcReader.reportWedgeInput(v);
            }}
            onFocus={() => nfcReader.setInputFocused(true)}
            onBlur={() => nfcReader.setInputFocused(false)}
            onManualSubmit={() => checkIn(code)}
            onConfirmNext={resetForNextScan}
            inputRef={inputRef}
          />

          {phase === "success" && physicalTickets.length > 0 && (
            <PhysicalTicketQuickMark
              groups={physicalTickets}
              markingId={markingPhysicalId}
              onMarkSold={markPhysicalSold}
            />
          )}

          {phase === "success" && orderGroup && scannedTicketId && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => openOrder(scannedTicketId)}>
              <Info className="h-4 w-4" /> Full purchase details
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Wrong check-in? Ask your event manager to roll it back.
          </p>
        </>
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search NIC, passport or card..."
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
                        {r.identity} - {r.packageName}
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

            {pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {pages}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
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

      <TicketOrderSheet open={sheetOpen} onOpenChange={setSheetOpen} group={sheetGroup} loading={orderLoading} />
    </div>
  );
}

function PhysicalTicketQuickMark({
  groups,
  markingId,
  onMarkSold,
}: {
  groups: PhysicalSuggestion[];
  markingId: string | null;
  onMarkSold: (id: string) => void;
}) {
  const visibleGroups = groups.filter((g) => g.available.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-background/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        Mark physical ticket sold
      </p>
      <div className="mt-3 space-y-3">
        {visibleGroups.map((group) => (
          <div key={group.packageId} className="rounded-lg border bg-card/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{group.packageName}</p>
              <Badge variant="outline">Bought {group.purchasedQty}</Badge>
            </div>
            <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
              {group.available.map((ticket) => (
                <Button
                  key={ticket.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={markingId === ticket.id}
                  onClick={() => onMarkSold(ticket.id)}
                  className="h-8 font-mono text-xs"
                >
                  {markingId === ticket.id ? "..." : ticket.refCode}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
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
