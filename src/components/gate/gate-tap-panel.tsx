"use client";

import * as React from "react";
import { CheckCircle2, CreditCard, Nfc, Smartphone, User, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderGroup } from "@/components/gate/ticket-order-sheet";
import type { PassportCredentialChannel } from "@/lib/nfc/types";

export type CheckInPhase = "ready" | "processing" | "success" | "denied";

export type PassportScanInfo = {
  passportNo: string;
  holder: string;
  packageName?: string;
  credentialChannel: PassportCredentialChannel;
};

export function GateTapPanel({
  phase,
  processingMs,
  resultMessage,
  orderGroup,
  scannedTicketId,
  passportScan,
  venueName,
  eventTitle,
  code,
  loading,
  onCodeChange,
  onFocus,
  onBlur,
  onManualSubmit,
  onConfirmNext,
  inputRef,
}: {
  phase: CheckInPhase;
  processingMs: number | null;
  resultMessage: string;
  orderGroup: OrderGroup | null;
  scannedTicketId: string | null;
  passportScan: PassportScanInfo | null;
  venueName: string;
  eventTitle: string;
  code: string;
  loading: boolean;
  onCodeChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onManualSubmit: () => void;
  onConfirmNext: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const highlighted = orderGroup?.tickets.find((t) => t.id === scannedTicketId);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6 text-center transition-colors sm:p-8",
          phase === "ready" && "border-primary/30 bg-gradient-to-b from-primary/10 to-card",
          phase === "processing" && "border-amber-500/40 bg-amber-500/5",
          phase === "success" && "border-emerald-500/50 bg-emerald-500/10",
          phase === "denied" && "border-red-500/40 bg-red-500/10"
        )}
      >
        {phase === "ready" && (
          <>
            <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
              <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-primary/20" />
              <span className="absolute inline-flex h-20 w-20 animate-pulse rounded-full bg-primary/15" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                <Nfc className="h-9 w-9 text-primary" />
              </span>
            </div>
            <p className="mt-4 font-display text-xl font-bold sm:text-2xl">Tap Entertain Passport</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Physical card on the NFC reader below, or Google Wallet NFC tap on the Android gate
              device above. NIC / passport for guests without a passport.
            </p>
          </>
        )}

        {phase === "processing" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
            <p className="mt-4 font-display text-lg font-semibold">Verifying…</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
              {processingMs != null ? `${processingMs} ms` : "-"}
            </p>
          </>
        )}

        {phase === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 animate-in zoom-in text-emerald-500 duration-300" />
            <p className="mt-4 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              Entry granted
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{resultMessage}</p>
            {processingMs != null && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">Processed in {processingMs} ms</p>
            )}
          </>
        )}

        {phase === "denied" && (
          <>
            <XCircle className="mx-auto h-16 w-16 animate-in zoom-in text-red-500 duration-300" />
            <p className="mt-4 font-display text-xl font-bold text-red-600 dark:text-red-400">Entry denied</p>
            <p className="mt-1 text-sm">{resultMessage}</p>
            {processingMs != null && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{processingMs} ms</p>
            )}
          </>
        )}
      </div>

      {phase === "success" && passportScan && (
        <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-primary/30 bg-card p-4 duration-300 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entertain Passport verified
            </p>
            <Badge variant="outline" className="gap-1">
              {passportScan.credentialChannel === "WALLET" ? (
                <>
                  <Smartphone className="h-3 w-3" /> Google Wallet
                </>
              ) : (
                <>
                  <Nfc className="h-3 w-3" /> Physical NFC
                </>
              )}
            </Badge>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-mono text-lg font-semibold">{passportScan.passportNo}</p>
              <p className="text-sm text-muted-foreground">{passportScan.holder}</p>
              {passportScan.packageName && (
                <p className="mt-1 text-sm">
                  Ticket: <span className="font-medium">{passportScan.packageName}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "success" && orderGroup && highlighted && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-2xl border border-emerald-500/30 bg-card p-4 duration-300 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guest</p>
            <p className="mt-1 font-display text-xl font-bold">{highlighted.label}</p>
            <p className="text-sm text-muted-foreground">{highlighted.identity}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Event</p>
              <p className="font-medium">{eventTitle}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Venue</p>
              <p className="font-medium">{venueName}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Ticket</p>
              <p className="font-medium">{orderGroup.packageName}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Purchase</p>
              <p className="font-medium">
                {orderGroup.ticketCount} ticket{orderGroup.ticketCount !== 1 ? "s" : ""} by{" "}
                {orderGroup.buyer.name ?? orderGroup.buyer.email}
              </p>
            </div>
          </div>

          {orderGroup.ticketCount > 1 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                All tickets in this purchase ({orderGroup.ticketCount})
              </p>
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {orderGroup.tickets.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                      t.id === scannedTicketId && "border-primary/50 bg-primary/5"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{t.label}</span>
                    </div>
                    <Badge variant={t.status === "CHECKED_IN" ? "success" : "outline"}>
                      {t.status === "CHECKED_IN" ? "In" : "Pending"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button variant="brand" size="lg" className="w-full" onClick={onConfirmNext}>
            Confirm - scan next guest
          </Button>
        </div>
      )}

      {phase === "success" && (!orderGroup || !highlighted) && (
        <Button variant="brand" size="lg" className="w-full" onClick={onConfirmNext}>
          Confirm - scan next guest
        </Button>
      )}

      {phase === "denied" && (
        <Button variant="outline" size="lg" className="w-full" onClick={onConfirmNext}>
          Try again - scan or enter NIC / passport
        </Button>
      )}

      {(phase === "ready" || phase === "processing") && (
        <div className="rounded-2xl border bg-card p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Manual entry · NIC, passport, or physical NFC wedge
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="NIC, passport, or physical NFC tap"
              className="min-w-0 flex-1 font-mono text-base tracking-wider"
              onKeyDown={(e) => e.key === "Enter" && code && !loading && onManualSubmit()}
            />
            <Button
              variant="brand"
              size="lg"
              className="w-full shrink-0 sm:w-auto"
              disabled={!code || loading}
              onClick={onManualSubmit}
            >
              Check in
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
