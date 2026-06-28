"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCheck, Nfc, XCircle } from "lucide-react";
import {
  PassportEventTicketsSidebar,
  PassportOwnerSidebar,
} from "@/components/admin/passport-assignee-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NfcReaderStatus } from "@/components/gate/nfc-reader-status";
import { NfcHardwareAccessPrompt } from "@/components/gate/nfc-hardware-access-prompt";
import { findSignedTagJsonString } from "@/lib/nfc/passport-ndef";
import { KEYBOARD_WEDGE_HINT } from "@/lib/nfc/usb-reader-filters";
import { useNfcReader } from "@/hooks/use-nfc-reader";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type {
  CardTestCheck,
  ProgrammedCardTestResult,
} from "@/lib/passport/passport-test-service";

type TestPhase = "ready" | "processing" | "pass" | "fail";

type TestInput =
  | { kind: "json"; body: Record<string, unknown> }
  | { kind: "uid"; nfcUid: string };

function parseNfcPayload(value: string): Record<string, unknown> | null {
  const json = findSignedTagJsonString(value);
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseTestInput(value: string): TestInput | null {
  const v = value.trim();
  if (!v) return null;

  const json = parseNfcPayload(v);
  if (json) return { kind: "json", body: json };

  const compact = v.replace(/[\r\n]+/g, "");
  const jsonCompact = parseNfcPayload(compact);
  if (jsonCompact) return { kind: "json", body: jsonCompact };

  if (/^[0-9A-Fa-f:.\-]{4,64}$/.test(compact)) {
    return { kind: "uid", nfcUid: compact.replace(/[^0-9A-Fa-f]/g, "") || compact };
  }

  return null;
}

export function PassportCardTestPanel({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<TestPhase>("ready");
  const [payloadInput, setPayloadInput] = React.useState("");
  const [processingMs, setProcessingMs] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<ProgrammedCardTestResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const processingStart = React.useRef<number | null>(null);
  const processingTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const runTestRef = React.useRef<(value: string) => void>(() => {});

  const startProcessingTimer = () => {
    processingStart.current = Date.now();
    setProcessingMs(0);
    processingTimer.current = setInterval(() => {
      if (processingStart.current != null) {
        setProcessingMs(Date.now() - processingStart.current);
      }
    }, 50);
  };

  const stopProcessingTimer = () => {
    if (processingTimer.current) clearInterval(processingTimer.current);
    processingTimer.current = null;
    if (processingStart.current != null) {
      setProcessingMs(Date.now() - processingStart.current);
      processingStart.current = null;
    }
  };

  const resetForNext = () => {
    setPhase("ready");
    setResult(null);
    setProcessingMs(null);
    setPayloadInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const runTest = React.useCallback(
    async (value: string) => {
      const input = parseTestInput(value);
      if (!input || loading || phase === "processing" || phase === "pass") return;

      setLoading(true);
      setPhase("processing");
      setResult(null);
      startProcessingTimer();

      try {
        const body = input.kind === "json" ? input.body : { nfcUid: input.nfcUid };
        const res = await fetch("/api/passport/test-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as ProgrammedCardTestResult;
        setResult(data);
        setPhase(data.verdict === "PASS" ? "pass" : "fail");
        setPayloadInput("");
      } catch {
        setResult({
          verdict: "FAIL",
          summary: "Network error - could not reach test API.",
          checks: [],
        });
        setPhase("fail");
      } finally {
        stopProcessingTimer();
        setLoading(false);
      }
    },
    [loading, phase]
  );

  runTestRef.current = runTest;

  const nfcReader = useNfcReader({
    enabled: enabled && phase === "ready",
    purpose: "verify",
    onRead: (payload) => runTestRef.current(payload),
  });

  React.useEffect(() => {
    if (enabled && phase === "ready") {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [enabled, phase]);

  const handleRequestHardwareAccess = React.useCallback(async () => {
    await nfcReader.requestHardwareAccess();
  }, [nfcReader]);

  const handlePairUsbReader = React.useCallback(async () => {
    const pairResult = await nfcReader.pairUsbReader();
    if (pairResult.ok) {
      toast({ title: "Reader paired", description: pairResult.label });
      return;
    }
    if (pairResult.mode === "cancelled" || pairResult.mode === "keyboard-wedge") {
      toast({
        title: "Keyboard-mode reader?",
        description: KEYBOARD_WEDGE_HINT,
      });
    }
  }, [nfcReader, toast]);

  return (
    <section className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
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
            onFocusScan={() => inputRef.current?.focus()}
          />

          <p className="text-sm text-muted-foreground">
            Tap a programmed card on the reader - most USB wedge readers send the chip UID only. The
            system looks up that UID and verifies programming, assignment, and tickets.
          </p>

          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border p-4 text-center transition-colors sm:p-5",
              phase === "ready" && "border-primary/30 bg-gradient-to-b from-primary/10 to-card",
              phase === "processing" && "border-amber-500/40 bg-amber-500/5",
              phase === "pass" && "border-emerald-500/50 bg-emerald-500/10",
              phase === "fail" && "border-red-500/40 bg-red-500/10"
            )}
          >
            {phase === "ready" && (
              <>
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                  <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-primary/20" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                    <Nfc className="h-7 w-7 text-primary" />
                  </span>
                </div>
                <p className="mt-3 font-display text-lg font-bold">Tap programmed card</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  UID or full tag JSON · focus the field below first
                </p>
              </>
            )}

            {phase === "processing" && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
                <p className="mt-4 font-display text-lg font-semibold">Testing card…</p>
                <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
                  {processingMs != null ? `${processingMs} ms` : "-"}
                </p>
              </>
            )}

            {phase === "pass" && (
              <>
                <CheckCircle2 className="mx-auto h-16 w-16 animate-in zoom-in text-emerald-500 duration-300" />
                <p className="mt-4 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  Card verified
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{result?.summary}</p>
                {processingMs != null && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Processed in {processingMs} ms</p>
                )}
              </>
            )}

            {phase === "fail" && (
              <>
                <XCircle className="mx-auto h-16 w-16 animate-in zoom-in text-red-500 duration-300" />
                <p className="mt-4 font-display text-xl font-bold text-red-600 dark:text-red-400">Check failed</p>
                <p className="mt-1 text-sm">{result?.summary}</p>
                {processingMs != null && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{processingMs} ms</p>
                )}
              </>
            )}
          </div>

          {result && (phase === "pass" || phase === "fail") && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
              {result.card && (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <Detail label="Public number" value={result.card.formattedPassportNumber} mono />
                  <Detail label="Card type" value={result.card.cardTypeLabel} />
                  <Detail label="Status" value={result.card.status} />
                  <Detail label="Batch" value={result.card.batchCode ?? "-"} />
                  <Detail label="Chip UID" value={result.card.nfcUid ?? "-"} mono />
                  <Detail label="Registered UID" value={result.card.registeredUid ?? "-"} mono />
                  <Detail
                    label="Programmed"
                    value={result.card.programmedAt ? new Date(result.card.programmedAt).toLocaleString() : "-"}
                  />
                </div>
              )}

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Verification checks
                </p>
                <ul className="space-y-2">
                  {result.checks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </ul>
              </div>

              <Button variant="brand" size="lg" className="w-full" onClick={resetForNext}>
                Confirm - test next card
              </Button>
            </div>
          )}

          {(phase === "ready" || phase === "processing") && (
            <div className="rounded-2xl border bg-card p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Manual · chip UID or NFC tag JSON
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  ref={inputRef}
                  value={payloadInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[\r\n]+/g, "");
                    setPayloadInput(v);
                    nfcReader.reportWedgeInput(v);
                    if (parseTestInput(v)) void runTest(v);
                  }}
                  onFocus={() => nfcReader.setInputFocused(true)}
                  onBlur={() => nfcReader.setInputFocused(false)}
                  placeholder="0373151482 or {internalPassportUuid:…}"
                  className="min-w-0 flex-1 font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && payloadInput && !loading) {
                      e.preventDefault();
                      void runTest(payloadInput);
                    }
                  }}
                />
                <Button
                  variant="brand"
                  size="lg"
                  className="w-full shrink-0 sm:w-auto"
                  disabled={!parseTestInput(payloadInput) || loading}
                  onClick={() => void runTest(payloadInput)}
                >
                  Test card
                </Button>
              </div>
            </div>
          )}

          {phase === "fail" && !result?.checks.length && (
            <Button variant="outline" size="lg" className="w-full" onClick={resetForNext}>
              Try again
            </Button>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <PassportOwnerSidebar
            owner={result?.owner ?? null}
            loading={phase === "processing"}
            emptyHint="Tap a programmed card to see who this passport is assigned to."
          />
          <PassportEventTicketsSidebar tickets={result?.eventTickets ?? []} loading={phase === "processing"} />
        </aside>
      </div>
    </section>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium", mono && "font-mono text-xs break-all")}>{value}</p>
    </div>
  );
}

function CheckRow({ check }: { check: CardTestCheck }) {
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
        check.pass ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
      )}
    >
      <div className="min-w-0">
        <p className="font-medium">{check.label}</p>
        {check.detail && <p className="mt-0.5 text-xs text-muted-foreground break-all">{check.detail}</p>}
      </div>
      <Badge variant={check.pass ? "success" : "warning"}>{check.pass ? "Pass" : "Fail"}</Badge>
    </li>
  );
}
