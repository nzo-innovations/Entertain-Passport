"use client";

import { cn } from "@/lib/utils";
import type { NfcConnectionStatus, NfcReaderState } from "@/hooks/use-nfc-reader";
import { Nfc, Usb, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

function StatusLight({ status }: { status: NfcConnectionStatus }) {
  const green = status === "connected";
  const amber = status === "ready";
  const red = status === "disconnected" || status === "permission-denied" || status === "unsupported";

  return (
    <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full opacity-75",
          green && "animate-ping bg-emerald-400",
          amber && "bg-amber-400",
          red && "bg-red-500"
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-3 w-3 rounded-full",
          green && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
          amber && "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]",
          red && "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
          status === "unsupported" && "bg-muted-foreground"
        )}
      />
    </span>
  );
}

function statusLabel(status: NfcConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "ready":
      return "Ready";
    case "permission-denied":
      return "Permission needed";
    case "unsupported":
      return "Not supported";
    default:
      return "Disconnected";
  }
}

export function NfcReaderStatus({
  reader,
  onRetry,
  onPairUsb,
  pairingUsb,
  onFocusScan,
}: {
  reader: NfcReaderState & { retryWebNfc?: () => void };
  onRetry?: () => void;
  onPairUsb?: () => void;
  pairingUsb?: boolean;
  onFocusScan?: () => void;
}) {
  const Icon = reader.mode === "web-nfc" ? Smartphone : reader.mode === "hid-wedge" ? Usb : Nfc;

  const showPairUsb =
    onPairUsb &&
    reader.webHidSupported &&
    !reader.usbPhysicallyConnected &&
    reader.mode === "hid-wedge" &&
    reader.status !== "connected";

  const showTapTest =
    onFocusScan &&
    reader.mode === "hid-wedge" &&
    !reader.usbPhysicallyConnected &&
    reader.status !== "connected";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
        reader.status === "connected"
          ? "border-emerald-500/40 bg-emerald-500/5"
          : reader.status === "ready"
            ? "border-amber-500/30 bg-amber-500/5"
            : reader.status === "disconnected"
              ? "border-red-500/30 bg-red-500/5"
              : "border-border bg-muted/20"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <StatusLight status={reader.status} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{reader.readerLabel}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                reader.status === "connected"
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : reader.status === "ready"
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                    : reader.status === "disconnected"
                      ? "bg-red-500/20 text-red-700 dark:text-red-300"
                      : "bg-muted text-muted-foreground"
              )}
            >
              {statusLabel(reader.status)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{reader.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {showTapTest && (
          <Button type="button" size="sm" variant="brand" onClick={onFocusScan}>
            Tap card to test
          </Button>
        )}
        {showPairUsb && (
          <Button type="button" size="sm" variant="outline" disabled={pairingUsb} onClick={onPairUsb}>
            {pairingUsb ? "Pairing…" : "Pair PC/SC reader"}
          </Button>
        )}
        {reader.status === "permission-denied" && onRetry && (
          <Button type="button" size="sm" variant="brand" onClick={onRetry}>
            Allow built-in NFC
          </Button>
        )}
      </div>
    </div>
  );
}
