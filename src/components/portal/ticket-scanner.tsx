"use client";

import * as React from "react";
import { CheckCircle2, Nfc, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TicketScanner({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const scan = async (identity: string) => {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/gate/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: identity, eventId }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.ok && data.result === "CHECKED_IN") {
      setResult({
        ok: true,
        message: "Entry granted",
        detail: `${data.ticket?.holder ?? "Guest"} - ${data.ticket?.packageName ?? "Ticket"}`,
      });
    } else {
      setResult({
        ok: false,
        message: data.message ?? data.error ?? "Invalid ticket",
        detail: data.ticket?.identity,
      });
    }
    setCode("");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <Nfc className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-bold">Gate check-in</h2>
        <p className="text-sm text-muted-foreground">{eventTitle}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tap card or enter NIC / passport number
        </label>
        <div className="mt-2 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="NIC, passport number, NFC UID or EP-number"
            className="font-mono text-lg tracking-wider"
            onKeyDown={(e) => e.key === "Enter" && code && scan(code)}
            autoFocus
          />
          <Button variant="brand" disabled={!code || loading} onClick={() => scan(code)}>
            Check in
          </Button>
        </div>
      </div>

      {result && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-5",
            result.ok
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-red-500/40 bg-red-500/10"
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-red-500" />
          )}
          <div>
            <p className="font-semibold">{result.message}</p>
            {result.detail && <p className="mt-1 text-sm text-muted-foreground">{result.detail}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
