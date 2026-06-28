"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Copy, Download, Layers, Loader2, Nfc, RefreshCw, Sparkles, UserPlus, XCircle } from "lucide-react";
import { PassportCardTestPanel } from "@/components/admin/passport-card-test-panel";
import {
  PassportCardSummaryPanel,
  PassportEventTicketsSidebar,
  PassportOwnerSidebar,
  type PassportCardSummaryData,
} from "@/components/admin/passport-assignee-sidebar";
import type { CardTestEventTicket, CardTestOwner } from "@/lib/passport/passport-test-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { PASSPORT_BATCH_CARD_TYPES, PASSPORT_CARD_TYPE_LABELS, PASSPORT_CARD_TYPES, PUBLIC_PREFIX } from "@/lib/passport/types";
import { compactPublicNumber } from "@/lib/passport/passport-number-generator";
import { cn } from "@/lib/utils";
import { NfcReaderStatus } from "@/components/gate/nfc-reader-status";
import { NfcHardwareAccessPrompt } from "@/components/gate/nfc-hardware-access-prompt";
import { KEYBOARD_WEDGE_HINT } from "@/lib/nfc/usb-reader-filters";
import { PassportChipWriteGuide } from "@/components/admin/passport-chip-write-guide";
import { writePassportNdefTag, isWebNfcWriteSupported } from "@/lib/nfc/write-ndef-tag";
import { useNfcReader } from "@/hooks/use-nfc-reader";

type Batch = {
  id: string;
  batchCode: string;
  cardType: string;
  quantity: number;
  issueYear: number;
  status: string;
  createdAt: string;
  _count: { inventory: number };
};

type InventoryRow = {
  id: string;
  formattedPassportNumber: string;
  publicPassportNumber: string;
  cardType: string;
  status: string;
  batch?: { batchCode: string } | null;
  assignedUser?: { name: string | null; email: string } | null;
};

const CARD_TYPES = PASSPORT_BATCH_CARD_TYPES.map((code) => ({
  code,
  label: PASSPORT_CARD_TYPE_LABELS[code] ?? code,
}));

export function PassportInventoryManager({
  initialBatches,
  initialInventory,
}: {
  initialBatches: Batch[];
  initialInventory: InventoryRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"generate" | "inventory" | "assign" | "program" | "test">("generate");
  const [busy, setBusy] = React.useState(false);
  const [lastPayload, setLastPayload] = React.useState<string | null>(null);
  const [lastPublicDisplay, setLastPublicDisplay] = React.useState<string | null>(null);
  const [webNfcWriteSupported, setWebNfcWriteSupported] = React.useState(false);

  React.useEffect(() => {
    setWebNfcWriteSupported(isWebNfcWriteSupported());
  }, []);

  const [batchCode, setBatchCode] = React.useState("");
  const [batchCodeManual, setBatchCodeManual] = React.useState(false);
  const [suggestedBatchCode, setSuggestedBatchCode] = React.useState("");
  const [suggestedIstLabel, setSuggestedIstLabel] = React.useState("");
  const [suggestSource, setSuggestSource] = React.useState<"worldtimeapi" | "server" | "">("");
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [cardType, setCardType] = React.useState<string>(PASSPORT_CARD_TYPES.STANDARD);
  const [issueYear, setIssueYear] = React.useState(String(new Date().getFullYear() % 100));
  const [quantity, setQuantity] = React.useState("100");

  const [assignNumber, setAssignNumber] = React.useState("");
  const [assignIdType, setAssignIdType] = React.useState<"NIC" | "PASSPORT">("NIC");
  const [assignIdValue, setAssignIdValue] = React.useState("");
  const assignPassportDigits = compactPublicNumber(assignNumber);

  const [passportLookup, setPassportLookup] = React.useState<AssignLookupState>({ status: "idle" });
  const [userLookup, setUserLookup] = React.useState<AssignLookupState>({ status: "idle" });

  React.useEffect(() => {
    if (tab !== "assign") return;
    if (assignPassportDigits.length < 10) {
      setPassportLookup({ status: "idle" });
      return;
    }

    setPassportLookup({ status: "loading" });
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/passport/assign/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicPassportNumber: assignPassportDigits }),
          });
          const data = (await res.json()) as {
            passport?: {
              state: string;
              error?: string;
              detail?: string;
              assignable?: boolean;
            };
          };
          const p = data.passport;
          if (!p || p.state === "idle") {
            setPassportLookup({ status: "idle" });
          } else if (p.state === "found") {
            setPassportLookup({
              status: "found",
              detail: p.detail ?? "Card found",
              assignable: p.assignable,
              warning: p.error,
            });
          } else {
            setPassportLookup({
              status: "error",
              message: p.error ?? "Card does not exist in database.",
            });
          }
        } catch {
          setPassportLookup({ status: "error", message: "Could not verify card." });
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [tab, assignPassportDigits]);

  React.useEffect(() => {
    if (tab !== "assign") return;
    if (assignIdValue.trim().length < 5) {
      setUserLookup({ status: "idle" });
      return;
    }

    setUserLookup({ status: "loading" });
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/passport/assign/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              primaryIdType: assignIdType,
              primaryIdValue: assignIdValue.trim(),
            }),
          });
          const data = (await res.json()) as {
            user?: { state: string; error?: string; detail?: string };
          };
          const u = data.user;
          if (!u || u.state === "idle") {
            setUserLookup({ status: "idle" });
          } else if (u.state === "found") {
            setUserLookup({ status: "found", detail: u.detail ?? "Member found" });
          } else {
            setUserLookup({
              status: "error",
              message: u.error ?? "User does not exist in database.",
            });
          }
        } catch {
          setUserLookup({ status: "error", message: "Could not verify member." });
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [tab, assignIdType, assignIdValue]);

  const canAssign =
    passportLookup.status === "found" &&
    passportLookup.assignable !== false &&
    userLookup.status === "found";

  const [programNumber, setProgramNumber] = React.useState("");
  const [programUid, setProgramUid] = React.useState("");
  const [programBusy, setProgramBusy] = React.useState(false);
  const [writeChipBusy, setWriteChipBusy] = React.useState(false);
  const [reprogramMode, setReprogramMode] = React.useState(false);
  const programNumberRef = React.useRef<HTMLInputElement>(null);
  const programUidRef = React.useRef<HTMLInputElement>(null);

  const programPassportDigits = compactPublicNumber(programNumber);
  const programUidClean = programUid.trim().replace(/[^0-9A-Fa-f]/g, "") || programUid.trim();
  const canProgram = programPassportDigits.length >= 10 && programUidClean.length >= 4;

  const programInventoryMatch = React.useMemo(() => {
    if (programPassportDigits.length < 10) return null;
    return (
      initialInventory.find(
        (row) =>
          row.publicPassportNumber === programPassportDigits ||
          compactPublicNumber(row.formattedPassportNumber) === programPassportDigits
      ) ?? null
    );
  }, [programPassportDigits, initialInventory]);

  React.useEffect(() => {
    if (programInventoryMatch?.status === "PROGRAMMED") {
      setReprogramMode(true);
    }
  }, [programInventoryMatch?.status, programInventoryMatch?.formattedPassportNumber]);

  const [programContextLoading, setProgramContextLoading] = React.useState(false);
  const [programContextCard, setProgramContextCard] = React.useState<PassportCardSummaryData | null>(null);
  const [programContextOwner, setProgramContextOwner] = React.useState<CardTestOwner | null>(null);
  const [programContextTickets, setProgramContextTickets] = React.useState<CardTestEventTicket[]>([]);

  React.useEffect(() => {
    if (tab !== "program") return;
    if (programPassportDigits.length < 10) {
      setProgramContextCard(null);
      setProgramContextOwner(null);
      setProgramContextTickets([]);
      return;
    }

    setProgramContextLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/passport/program/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicPassportNumber: programPassportDigits }),
          });
          const data = (await res.json()) as {
            card: PassportCardSummaryData | null;
            owner: CardTestOwner | null;
            eventTickets: CardTestEventTicket[];
          };
          setProgramContextCard(data.card);
          setProgramContextOwner(data.owner);
          setProgramContextTickets(data.eventTickets ?? []);
        } catch {
          setProgramContextCard(null);
          setProgramContextOwner(null);
          setProgramContextTickets([]);
        } finally {
          setProgramContextLoading(false);
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [tab, programPassportDigits]);

  const programBlockReason = (() => {
    if (programBusy) return "Programming in progress…";
    if (programPassportDigits.length < 10) return "Enter the assigned 16-digit public passport number.";
    if (programUidClean.length < 4) return "Tap the NFC chip to capture UID (focus the UID field first).";
    if (programInventoryMatch?.status === "PROGRAMMED" && !reprogramMode) {
      return "This card is already PROGRAMMED - enable re-program mode or reset first.";
    }
    if (programInventoryMatch && !["ASSIGNED", "PROGRAMMED"].includes(programInventoryMatch.status)) {
      return `Card status is ${programInventoryMatch.status}. Assign the passport before programming.`;
    }
    return null;
  })();

  const nfcReader = useNfcReader({
    enabled: tab === "program",
    purpose: "program-uid",
    onRead: (uid) => {
      setProgramUid(uid);
      const passportDigits = compactPublicNumber(programNumberRef.current?.value ?? "");
      if (passportDigits.length < 10) {
        toast({
          title: "UID captured",
          description: "Enter the assigned public passport number, then click Program NFC.",
        });
        setTimeout(() => programNumberRef.current?.focus(), 50);
      }
    },
  });

  React.useEffect(() => {
    if (tab === "program") {
      const t = setTimeout(() => programUidRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [tab]);

  const handlePairUsbReader = React.useCallback(async () => {
    const result = await nfcReader.pairUsbReader();
    if (result.ok) {
      toast({ title: "Reader paired", description: result.label });
      return;
    }
    if (result.mode === "cancelled" || result.mode === "keyboard-wedge") {
      toast({
        title: "Keyboard-mode reader?",
        description: KEYBOARD_WEDGE_HINT,
      });
      programUidRef.current?.focus();
      return;
    }
    if (result.mode === "error") {
      toast({ title: "Pair failed", description: result.message, variant: "destructive" });
    }
  }, [nfcReader, toast]);

  const handleRequestHardwareAccess = React.useCallback(async () => {
    await nfcReader.requestHardwareAccess();
    if (nfcReader.webNfcSupported && nfcReader.status === "connected") {
      toast({ title: "Built-in NFC ready", description: "Tap your NFC chip on this device." });
    }
  }, [nfcReader, toast]);

  React.useEffect(() => {
    if (tab === "program" && programPassportDigits.length >= 16 && !programUid.trim()) {
      programUidRef.current?.focus();
    }
  }, [tab, programPassportDigits.length, programUid]);

  const fetchSuggestedBatchCode = React.useCallback(async (apply = false) => {
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/passport/batches/suggest-code", { cache: "no-store" });
      const data = (await res.json()) as {
        batchCode?: string;
        istLabel?: string;
        source?: "worldtimeapi" | "server";
        error?: string;
      };
      if (!res.ok || !data.batchCode) return;
      setSuggestedBatchCode(data.batchCode);
      setSuggestedIstLabel(data.istLabel ?? "");
      setSuggestSource(data.source ?? "server");
      if (apply || !batchCodeManual) {
        setBatchCode(data.batchCode);
      }
    } finally {
      setSuggestLoading(false);
    }
  }, [batchCodeManual]);

  React.useEffect(() => {
    if (tab === "generate") {
      void fetchSuggestedBatchCode();
    }
  }, [tab, fetchSuggestedBatchCode]);

  const applySuggestedBatchCode = () => {
    void fetchSuggestedBatchCode(true);
    setBatchCodeManual(false);
  };

  const generateBatch = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/passport/batches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchCode,
          cardType,
          issueYear: Number(issueYear),
          quantity: Number(quantity),
          initialStatus: "GENERATED",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Generation failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Batch created", description: `${data.created} passport numbers generated.` });
      setBatchCodeManual(false);
      void fetchSuggestedBatchCode(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const exportBatch = async (batchId: string, markAvailable: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/passport/export-print-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, markAvailable }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Export failed", description: data.error, variant: "destructive" });
        return;
      }
      const csv = await res.text();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passport-batch-${batchId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: markAvailable ? "Exported & marked available" : "Exported",
        description: "Send CSV to card printer.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!canAssign || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/passport/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicPassportNumber: assignNumber,
          primaryIdType: assignIdType,
          primaryIdValue: assignIdValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Assign failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Card assigned", description: data.formattedPassportNumber });
      setAssignNumber("");
      setAssignIdValue("");
      setPassportLookup({ status: "idle" });
      setUserLookup({ status: "idle" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const program = async () => {
    if (!canProgram || programBusy || programBlockReason) return;
    setProgramBusy(true);
    try {
      const res = await fetch("/api/nfc/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicPassportNumber: programPassportDigits,
          nfcUid: programUidClean,
          reprogram: reprogramMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Program failed", description: data.reason ?? data.error, variant: "destructive" });
        return;
      }
      setLastPayload(JSON.stringify(data.tagPayload, null, 2));
      setLastPublicDisplay(typeof data.publicDisplay === "string" ? data.publicDisplay : null);
      toast({
        title: data.reprogrammed ? "NFC re-programmed" : "NFC programmed",
        description: "Write both tag records to the chip, then verify on Test card tab.",
      });
      setProgramUid("");
      router.refresh();
    } finally {
      setProgramBusy(false);
    }
  };

  const resetProgramming = async () => {
    if (programPassportDigits.length < 10 || programBusy) return;
    setProgramBusy(true);
    try {
      const res = await fetch("/api/passport/reset-programming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicPassportNumber: programPassportDigits }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Reset failed", description: data.reason ?? data.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Programming reset",
        description: "Card returned to ASSIGNED. Program again when the chip is ready.",
      });
      setReprogramMode(false);
      setLastPayload(null);
      setLastPublicDisplay(null);
      setProgramUid("");
      router.refresh();
    } finally {
      setProgramBusy(false);
    }
  };

  const writePayloadToChip = async () => {
    if (!lastPayload || writeChipBusy) return;
    if (!lastPublicDisplay) {
      toast({
        title: "Missing display text",
        description: "Re-program the card to generate the public display record.",
        variant: "destructive",
      });
      return;
    }
    setWriteChipBusy(true);
    try {
      const minified = JSON.stringify(JSON.parse(lastPayload) as unknown);
      toast({
        title: "Hold chip on reader",
        description: "Keep the tag on the NFC writer until both records are written.",
      });
      const result = await writePassportNdefTag({ publicDisplay: lastPublicDisplay, tagJson: minified });
      if (!result.ok) {
        toast({ title: "Write failed", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Tag written",
        description: "Public display + signed JSON saved. Test on another phone or the Test card tab.",
      });
    } catch {
      toast({
        title: "Invalid payload",
        description: "Could not parse tag JSON. Re-program to generate a new payload.",
        variant: "destructive",
      });
    } finally {
      setWriteChipBusy(false);
    }
  };

  const tabs = [
    { id: "generate" as const, label: "Bulk generate", icon: Layers },
    { id: "inventory" as const, label: "Inventory", icon: Layers },
    { id: "assign" as const, label: "Assign", icon: UserPlus },
    { id: "program" as const, label: "Program NFC", icon: Nfc },
    { id: "test" as const, label: "Test card", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "brand" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Button>
        ))}
      </div>

      {tab === "generate" && (
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Set the visible structure (YY year, TT card type). Random segments RR, RRRR, XXX and check
            digit C are generated server-side only - never exposed or chosen in the browser.
          </p>

          <PassportNumberFormatPreview issueYear={issueYear} cardType={cardType} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Batch code
              </label>
              <div className="flex gap-2">
                <Input
                  value={batchCode}
                  onChange={(e) => {
                    setBatchCodeManual(true);
                    setBatchCode(e.target.value);
                  }}
                  placeholder="EP-26-03-16-143052-7391"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="New IST batch code"
                  disabled={suggestLoading}
                  onClick={applySuggestedBatchCode}
                >
                  <Sparkles className={cn("h-4 w-4", suggestLoading && "animate-pulse")} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {suggestLoading ? (
                  "Fetching IST time…"
                ) : suggestedBatchCode ? (
                  <>
                    Suggested:{" "}
                    <button
                      type="button"
                      className="font-mono text-primary hover:underline"
                      onClick={applySuggestedBatchCode}
                    >
                      {suggestedBatchCode}
                    </button>
                    {suggestedIstLabel ? ` · ${suggestedIstLabel}` : null}
                    {suggestSource === "worldtimeapi" ? " · synced online" : " · server IST"}
                    {batchCodeManual && batchCode !== suggestedBatchCode ? " · custom" : null}
                  </>
                ) : (
                  "EP-{YY}-{MM}-{DD}-{HHmmss}-{random} · IST (Asia/Kolkata)"
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                YY · Issue year
              </label>
              <Input
                value={issueYear}
                onChange={(e) => setIssueYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="26"
                inputMode="numeric"
                maxLength={2}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                TT · Card type
              </label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm font-mono"
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
              >
                {CARD_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantity
              </label>
              <Input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                type="number"
                min={1}
              />
            </div>
          </div>
          <Button variant="brand" disabled={busy || !batchCode.trim() || issueYear.length !== 2} onClick={generateBatch}>
            Generate batch
          </Button>

          <div className="mt-6 space-y-2">
            <h3 className="font-semibold text-sm">Recent batches</h3>
            {initialBatches.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="font-mono font-medium">{b.batchCode}</span>
                <Badge variant="outline">{PASSPORT_CARD_TYPE_LABELS[b.cardType] ?? b.cardType}</Badge>
                <span className="text-muted-foreground">{b._count.inventory} cards</span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => exportBatch(b.id, false)}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button size="sm" variant="brand" disabled={busy} onClick={() => exportBatch(b.id, true)}>
                  Export & mark AVAILABLE
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "inventory" && (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Public number</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Holder</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialInventory.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono">{r.formattedPassportNumber}</td>
                  <td className="px-4 py-3">{PASSPORT_CARD_TYPE_LABELS[r.cardType] ?? r.cardType}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.batch?.batchCode ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.assignedUser?.email ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assign" && (
        <section className="rounded-2xl border bg-card p-5 space-y-4 max-w-lg">
          <p className="text-sm text-muted-foreground">
            Link a printed passport number to a member by their NIC or passport. The ID is hashed for NFC
            programming - never stored in plain text. The member must already have an Entertain Passport account.
          </p>

          <AssignValidatedField
            label="Public passport number"
            value={assignNumber}
            onChange={setAssignNumber}
            placeholder="8826 1101 4837 2914"
            lookup={passportLookup}
            mono
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ID type
            </label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={assignIdType}
              onChange={(e) => setAssignIdType(e.target.value as "NIC" | "PASSPORT")}
            >
              <option value="NIC">NIC</option>
              <option value="PASSPORT">Passport</option>
            </select>
          </div>

          <AssignValidatedField
            label="Primary ID number"
            value={assignIdValue}
            onChange={setAssignIdValue}
            placeholder="Primary ID number"
            lookup={userLookup}
          />

          <Button variant="brand" disabled={busy || !canAssign} onClick={assign}>
            <UserPlus className="h-4 w-4" /> Assign to user
          </Button>
          {!canAssign && (passportLookup.status === "found" || userLookup.status === "found") && (
            <p className="text-xs text-muted-foreground">
              Both a valid AVAILABLE card and a registered member are required before assigning.
            </p>
          )}
        </section>
      )}

      {tab === "program" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-2xl border bg-card p-5 space-y-4">
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
            onRetry={() => void nfcReader.requestHardwareAccess()}
            onPairUsb={() => void handlePairUsbReader()}
            pairingUsb={nfcReader.pairingUsb}
            onFocusScan={() => programUidRef.current?.focus()}
          />

          <p className="text-sm text-muted-foreground">
            Register the passport in the database, then copy the tag payload and write it to the physical chip.
            Use the <strong className="font-medium text-foreground">Test card</strong> tab to confirm the chip after
            writing. If the chip write fails, reset or re-program below.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={reprogramMode}
              onChange={(e) => setReprogramMode(e.target.checked)}
            />
            <span>
              <span className="font-medium">Re-program mode</span>
              <span className="mt-0.5 block text-muted-foreground">
                Use when status is PROGRAMMED but the chip was never written correctly, or you are using a
                replacement blank chip with a new UID.
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Public passport number
            </label>
            <Input
              ref={programNumberRef}
              value={programNumber}
              onChange={(e) => setProgramNumber(e.target.value)}
              placeholder="Type or scan 16-digit number from card"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canProgram && !programBusy && !programBlockReason) {
                  e.preventDefault();
                  void program();
                }
              }}
            />
            {programInventoryMatch && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{programInventoryMatch.status}</Badge>
                {programInventoryMatch.assignedUser && (
                  <span className="text-muted-foreground">
                    {programInventoryMatch.assignedUser.name ?? programInventoryMatch.assignedUser.email}
                  </span>
                )}
                {programInventoryMatch.status === "PROGRAMMED" && (
                  <span className="text-amber-600 dark:text-amber-400">Re-program or reset if chip write failed</span>
                )}
              </div>
            )}
            {programPassportDigits.length > 0 && programPassportDigits.length < 16 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {programPassportDigits.length}/16 digits
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              NFC chip UID · tap card
            </label>
            <Input
              ref={programUidRef}
              value={programUid}
              onChange={(e) => {
                const v = e.target.value.replace(/[\r\n]+/g, "");
                setProgramUid(v);
                nfcReader.reportWedgeInput(v);
              }}
              onFocus={() => nfcReader.setInputFocused(true)}
              onBlur={() => nfcReader.setInputFocused(false)}
              placeholder="Focus here, then tap chip on reader"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canProgram && !programBusy && !programBlockReason) void program();
                }
              }}
            />
            {programUidClean.length > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">UID captured ({programUidClean.length} chars)</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="brand"
              disabled={!canProgram || programBusy || !!programBlockReason}
              onClick={() => void program()}
            >
              <Nfc className="h-4 w-4" />{" "}
              {programBusy ? "Programming…" : reprogramMode ? "Re-program NFC" : "Program NFC"}
            </Button>
            {programInventoryMatch?.status === "PROGRAMMED" && (
              <Button
                variant="outline"
                disabled={programPassportDigits.length < 10 || programBusy}
                onClick={() => void resetProgramming()}
              >
                <RefreshCw className="h-4 w-4" /> Reset to assigned
              </Button>
            )}
          </div>
          {programBlockReason && (
            <p className="text-xs text-muted-foreground">{programBlockReason}</p>
          )}

          {lastPayload && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-sm">NFC tag · write to chip</h3>
                <div className="flex flex-wrap gap-2">
                  {webNfcWriteSupported && (
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={writeChipBusy || !lastPublicDisplay}
                      onClick={() => void writePayloadToChip()}
                    >
                      <Nfc className="h-3.5 w-3.5" /> {writeChipBusy ? "Writing…" : "Write to chip"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(lastPayload);
                      toast({ title: "Copied JSON" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy JSON
                  </Button>
                  {lastPublicDisplay && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(lastPublicDisplay);
                        toast({ title: "Copied display text" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy display
                    </Button>
                  )}
                </div>
              </div>
              {lastPublicDisplay && (
                <div className="rounded-lg border bg-background p-4 space-y-1 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What other phones see on tap
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-base font-semibold leading-relaxed">
                    {lastPublicDisplay}
                  </pre>
                </div>
              )}
              {lastPublicDisplay && (
                <PassportChipWriteGuide
                  publicDisplay={lastPublicDisplay}
                  tagJson={lastPayload}
                  onCopy={(label) => toast({ title: label })}
                />
              )}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">Step 1 - Database (done):</strong> passport + UID + signed
                  payload are saved server-side. Status shows PROGRAMMED.
                </p>
                <p>
                  <strong className="text-foreground">Step 2 - Physical chip (you do this):</strong> write{" "}
                  <strong className="text-foreground">two Text records</strong> in order: (1) the branded display
                  above, then (2) the signed JSON below. On Android Chrome you can use{" "}
                  <strong className="text-foreground">Write to chip</strong>; on this PC use NFC Tools (see guide
                  above). The USB keyboard reader only reads UID - it cannot write.
                </p>
                <p>
                  <strong className="text-foreground">Not encrypted - cryptographically signed:</strong> gate devices
                  read the JSON record and verify the HMAC <code className="font-mono">signature</code> server-side.
                  UID in JSON must match the chip you tapped ({programUidClean || "capture UID first"}).
                </p>
                <p>
                  <strong className="text-foreground">Step 3 - Test card tab:</strong> tap the chip. Full JSON on tag
                  = full verify. UID-only wedge read = database lookup only.
                </p>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
                {lastPayload}
              </pre>
            </div>
          )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <PassportCardSummaryPanel
              card={programContextCard}
              loading={programContextLoading}
              emptyHint="Enter the passport number to load card details."
            />
            <PassportOwnerSidebar
              owner={programContextOwner}
              loading={programContextLoading}
              emptyHint="Assign a member first - owner appears after assignment."
            />
            <PassportEventTicketsSidebar
              tickets={programContextTickets}
              loading={programContextLoading}
            />
          </aside>
        </div>
      )}

      {tab === "test" && (
        <div className="rounded-2xl border bg-card p-5">
          <PassportCardTestPanel enabled={tab === "test"} />
        </div>
      )}
    </div>
  );
}

type AssignLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; detail: string; assignable?: boolean; warning?: string }
  | { status: "error"; message: string };

function AssignValidatedField({
  label,
  value,
  onChange,
  placeholder,
  lookup,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  lookup: AssignLookupState;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(mono && "font-mono", "pr-10")}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          {lookup.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {lookup.status === "found" && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Found in database" />
          )}
          {lookup.status === "error" && <XCircle className="h-4 w-4 text-red-500" aria-label="Not found" />}
        </div>
      </div>
      {lookup.status === "found" && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{lookup.detail}</p>
      )}
      {lookup.status === "found" && lookup.warning && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{lookup.warning}</p>
      )}
      {lookup.status === "error" && <p className="text-xs text-red-600 dark:text-red-400">{lookup.message}</p>}
    </div>
  );
}

function PassportNumberFormatPreview({ issueYear, cardType }: { issueYear: string; cardType: string }) {
  const yy = issueYear.padStart(2, "0").slice(-2);
  const tt = cardType.padStart(2, "0").slice(-2);

  const segments = [
    { key: "88", label: "Prefix", editable: false, value: PUBLIC_PREFIX },
    { key: "yy", label: "YY", editable: true, value: yy || "??" },
    { key: "tt", label: "TT", editable: true, value: tt || "??" },
    { key: "rr", label: "RR", editable: false, value: "••" },
    { key: "rrrr", label: "RRRR", editable: false, value: "••••" },
    { key: "xxx", label: "XXX", editable: false, value: "•••" },
    { key: "c", label: "C", editable: false, value: "•" },
  ];

  return (
    <div className="rounded-xl border border-primary/20 bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Number format</p>
      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2 font-mono text-lg sm:text-xl">
        {segments.map((seg, i) => (
          <React.Fragment key={seg.key}>
            {i === 3 && <span className="text-muted-foreground/50"> </span>}
            <div className="text-center">
              <span
                className={cn(
                  "inline-block min-w-[2ch] rounded-md px-2 py-1 tabular-nums",
                  seg.editable ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {seg.value}
              </span>
              <p className="mt-1 text-[10px] font-sans text-muted-foreground">{seg.label}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Example shape:{" "}
        <span className="font-mono text-foreground">
          {PUBLIC_PREFIX}
          {yy || "YY"}
          {tt || "TT"} •• •••• ••• •
        </span>
        {" · "}
        Not a payment card.
      </p>
    </div>
  );
}
