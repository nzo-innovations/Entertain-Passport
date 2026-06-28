"use client";

import { ShieldCheck, Usb, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NfcHardwareAccessPrompt({
  webNfcSupported,
  webHidSupported,
  requesting,
  onRequestAccess,
  className,
}: {
  webNfcSupported: boolean;
  webHidSupported: boolean;
  requesting: boolean;
  onRequestAccess: () => void;
  className?: string;
}) {
  const showNfc = webNfcSupported;
  const showUsb = webHidSupported;

  if (!showNfc && !showUsb) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Allow NFC hardware access
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Entertain Passport needs your permission to use physical NFC hardware. The browser
            will ask you to allow access - choose your USB reader if listed, or allow built-in NFC
            on phone/tablet.
          </p>
          <ul className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {showNfc && (
              <li className="flex items-center gap-1 rounded-md bg-background/80 px-2 py-1">
                <Smartphone className="h-3 w-3" /> Built-in NFC
              </li>
            )}
            {showUsb && (
              <li className="flex items-center gap-1 rounded-md bg-background/80 px-2 py-1">
                <Usb className="h-3 w-3" /> USB NFC reader
              </li>
            )}
          </ul>
        </div>
        <Button
          type="button"
          variant="brand"
          size="lg"
          className="w-full shrink-0 sm:w-auto"
          disabled={requesting}
          onClick={onRequestAccess}
        >
          {requesting ? "Waiting for permission…" : "Allow NFC & USB access"}
        </Button>
      </div>
    </div>
  );
}
