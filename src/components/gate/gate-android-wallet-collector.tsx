"use client";

import * as React from "react";
import { Loader2, Nfc, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PassportScanInfo } from "@/components/gate/gate-tap-panel";

type Props = {
  eventId: string;
  disabled: boolean;
  onVerified: (result: {
    passportScan: PassportScanInfo;
    ticketId: string;
    message: string;
    stats?: { total: number; checkedIn: number; pending: number };
  }) => void;
  onDenied: (message: string) => void;
};

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Google Wallet uses NFC Smart Tap (not QR). Gate staff run this on an Android tablet
 * with NFC. Guest opens Google Wallet → Entertain Passport → taps phone to the gate device.
 *
 * Full Smart Tap collection requires Google's Android collector SDK; this panel listens
 * for redemption values posted by the gate collector bridge (window EPWalletTap).
 */
export function GateAndroidWalletCollector({ eventId, disabled, onVerified, onDenied }: Props) {
  const [listening, setListening] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const android = isAndroidDevice();

  const verifyRedemption = React.useCallback(
    async (smartTapRedemptionValue: string) => {
      if (busy || disabled) return;
      setBusy(true);
      try {
        const res = await fetch("/api/nfc/wallet-tap/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ smartTapRedemptionValue, eventId, checkIn: true }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        const verdict = data.verdict as string | undefined;

        if (verdict === "ALLOW") {
          const channel = data.credentialChannel;
          const passportNo = data.passportNo as string | undefined;
          const holder = data.holder as string | undefined;
          if (passportNo && holder && channel === "WALLET") {
            onVerified({
              passportScan: {
                passportNo,
                holder,
                packageName: data.packageName as string | undefined,
                credentialChannel: "WALLET",
              },
              ticketId: data.ticketId as string,
              message: (data.reason as string) ?? "Entry granted.",
              stats: data.stats as { total: number; checkedIn: number; pending: number } | undefined,
            });
          }
        } else {
          onDenied((data.reason as string) ?? "Entry denied");
        }
      } catch {
        onDenied("Network error during wallet tap verify.");
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, eventId, onDenied, onVerified]
  );

  React.useEffect(() => {
    if (!listening || !android) return;

    const handler = (value: string) => {
      void verifyRedemption(value);
    };

    const w = window as Window & {
      EPWalletTap?: { onRedemption: (value: string) => void };
    };
    w.EPWalletTap = { onRedemption: handler };

    return () => {
      delete w.EPWalletTap;
    };
  }, [android, listening, verifyRedemption]);

  if (!android) {
    return (
      <div className="rounded-xl border border-muted bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Google Wallet NFC</p>
        <p className="mt-1">
          Wallet tap check-in runs on an <strong className="text-foreground">Android gate tablet with NFC</strong>.
          Physical Entertain Passport cards continue to use the USB NFC reader above.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Google Wallet · NFC tap</p>
          <p className="text-muted-foreground">
            Guest opens Google Wallet, selects Entertain Passport, and taps their phone on this
            device. No QR code - contactless NFC only.
          </p>
        </div>
      </div>

      <Button
        variant={listening ? "brand" : "outline"}
        className="w-full"
        disabled={disabled || busy}
        onClick={() => setListening((v) => !v)}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Nfc className="h-4 w-4" />
        )}
        {listening ? "Listening for wallet tap…" : "Ready for wallet NFC tap"}
      </Button>

      {listening && (
        <p className={cn("text-xs text-center text-muted-foreground animate-pulse")}>
          Hold guest phone near this tablet NFC antenna
        </p>
      )}
    </div>
  );
}

declare global {
  interface Window {
    EPWalletTap?: { onRedemption: (value: string) => void };
  }
}
