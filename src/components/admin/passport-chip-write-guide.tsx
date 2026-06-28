"use client";

import * as React from "react";
import { Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isWebNfcWriteSupported } from "@/lib/nfc/write-ndef-tag";

type Props = {
  publicDisplay: string;
  tagJson: string;
  onCopy?: (label: string) => void;
};

export function PassportChipWriteGuide({ publicDisplay, tagJson, onCopy }: Props) {
  const [webWriteSupported, setWebWriteSupported] = React.useState(false);

  React.useEffect(() => {
    setWebWriteSupported(isWebNfcWriteSupported());
  }, []);

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    onCopy?.(label);
  };

  const minifiedJson = React.useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(tagJson) as unknown);
    } catch {
      return tagJson.trim();
    }
  }, [tagJson]);

  if (webWriteSupported) {
    return (
      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Web write available:</strong> use{" "}
        <strong className="text-foreground">Write to chip</strong> on this device (Chrome / Edge with built-in NFC,
        usually Android).
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-muted-foreground space-y-3">
      <p className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span>
          <strong className="text-foreground">This PC cannot write NFC tags in the browser.</strong> USB keyboard
          readers only read UID - they do not write. Desktop Chrome on Windows typically has no Web NFC write support
          unless the laptop has built-in NFC hardware.
        </span>
      </p>

      <div className="space-y-2">
        <p className="font-medium text-foreground">Recommended: Android phone + NFC Tools</p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>Install <strong className="text-foreground">NFC Tools</strong> (free) on an Android phone with NFC.</li>
          <li>Open <strong className="text-foreground">Write</strong> → add <strong className="text-foreground">Text</strong> record → paste display text (record 1).</li>
          <li>Add another <strong className="text-foreground">Text</strong> record → paste signed JSON (record 2).</li>
          <li>Tap <strong className="text-foreground">Write</strong> and hold the blank card on the phone.</li>
          <li>Verify on the Test card tab (UID or full read).</li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => copy(publicDisplay, "Display text copied")}>
            <Copy className="h-3.5 w-3.5" /> Copy record 1 (display)
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(minifiedJson, "JSON copied")}>
            <Copy className="h-3.5 w-3.5" /> Copy record 2 (JSON)
          </Button>
        </div>
      </div>

      <div className="space-y-1 border-t border-sky-500/20 pt-2">
        <p className="font-medium text-foreground">Alternative: phone browser</p>
        <p>
          Open this admin page on an Android phone in Chrome, program the card, then use{" "}
          <strong className="text-foreground">Write to chip</strong> - Web NFC write works there.
        </p>
      </div>
    </div>
  );
}
