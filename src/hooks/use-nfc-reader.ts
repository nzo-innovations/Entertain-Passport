"use client";

import * as React from "react";
import { useUsbNfcDetection } from "@/hooks/use-usb-nfc-detection";
import { findSignedTagJsonString } from "@/lib/nfc/passport-ndef";

export type NfcReaderMode = "web-nfc" | "hid-wedge" | "manual";
export type NfcConnectionStatus = "connected" | "ready" | "disconnected" | "unsupported" | "permission-denied";

export type NfcReaderPurpose = "verify" | "program-uid";

export type NfcReaderState = {
  mode: NfcReaderMode;
  status: NfcConnectionStatus;
  readerLabel: string;
  detail: string;
  webNfcSupported: boolean;
  inputFocused: boolean;
  webHidSupported: boolean;
  usbPhysicallyConnected: boolean;
};

type NdefReadingEventLike = {
  serialNumber?: string;
  message: { records: Array<{ recordType?: string; data?: BufferSource }> };
};

declare global {
  interface Window {
    NDEFReader?: new () => {
      scan: (options?: { signal?: AbortSignal }) => Promise<void>;
      addEventListener: (type: "reading" | "readingerror", listener: (ev: NdefReadingEventLike) => void) => void;
      removeEventListener: (type: "reading" | "readingerror", listener: (ev: NdefReadingEventLike) => void) => void;
    };
  }
}

function decodeNdefRecord(record: { recordType?: string; data?: BufferSource }): string {
  if (!record.data) return "";
  const buf = new Uint8Array(record.data instanceof ArrayBuffer ? record.data : (record.data as ArrayBufferView).buffer);
  if (record.recordType === "text") {
    const langLen = buf[0] & 0x3f;
    return new TextDecoder().decode(buf.slice(1 + langLen));
  }
  return new TextDecoder().decode(buf);
}

function detectPlatformLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "Tablet";
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile";
  return "Laptop / desktop";
}

function normalizeChipUid(value: string): string {
  return value.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function useNfcReader(options: {
  enabled: boolean;
  onRead: (payload: string) => void;
  purpose?: NfcReaderPurpose;
}) {
  const purpose = options.purpose ?? "verify";
  const onReadRef = React.useRef(options.onRead);
  onReadRef.current = options.onRead;

  const [inputFocused, setInputFocused] = React.useState(false);
  const [webNfcActive, setWebNfcActive] = React.useState(false);
  const [webNfcError, setWebNfcError] = React.useState<string | null>(null);
  const [clock, setClock] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const purposeRef = React.useRef(purpose);
  purposeRef.current = purpose;

  const usb = useUsbNfcDetection(options.enabled);

  const webNfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  React.useEffect(() => {
    if (!options.enabled) return;
    const id = setInterval(() => setClock((c) => c + 1), 5000);
    return () => clearInterval(id);
  }, [options.enabled]);

  const handleReading = React.useCallback(
    (event: NdefReadingEventLike) => {
      usb.reportWedgeActivity();

      if (purposeRef.current === "program-uid" && event.serialNumber?.trim()) {
        const uid = normalizeChipUid(event.serialNumber);
        if (uid) {
          onReadRef.current(uid);
          return;
        }
      }

      const texts: string[] = [];
      for (const record of event.message.records) {
        const text = decodeNdefRecord(record).trim();
        if (text) texts.push(text);
      }

      if (purposeRef.current === "verify") {
        for (const text of texts) {
          const signedJson = findSignedTagJsonString(text);
          if (signedJson) {
            onReadRef.current(signedJson);
            return;
          }
        }
      }

      if (purposeRef.current === "program-uid") {
        for (const text of texts) {
          const uid = normalizeChipUid(text) || text;
          if (uid) {
            onReadRef.current(uid);
            return;
          }
        }
      }

      if (texts[0]) {
        onReadRef.current(texts[0]);
      }
    },
    [usb]
  );

  const startWebNfc = React.useCallback(async (): Promise<{ ok: boolean; denied?: boolean }> => {
    if (!webNfcSupported || !options.enabled) return { ok: false };
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const reader = new window.NDEFReader!();
      const onReadEv = (ev: NdefReadingEventLike) => handleReading(ev);
      reader.addEventListener("reading", onReadEv);
      await reader.scan({ signal: ac.signal });
      setWebNfcActive(true);
      setWebNfcError(null);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "NFC unavailable";
      setWebNfcActive(false);
      if (/denied|not allowed|permission/i.test(msg)) {
        setWebNfcError("permission-denied");
        return { ok: false, denied: true };
      }
      if (!/abort/i.test(msg)) {
        setWebNfcError(msg);
      }
      return { ok: false };
    }
  }, [webNfcSupported, options.enabled, handleReading]);

  React.useEffect(() => {
    if (options.enabled && webNfcSupported) {
      void startWebNfc();
    }
    return () => {
      abortRef.current?.abort();
      setWebNfcActive(false);
    };
  }, [options.enabled, webNfcSupported, startWebNfc]);

  const [requestingAccess, setRequestingAccess] = React.useState(false);
  const [accessDismissed, setAccessDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!options.enabled) {
      setAccessDismissed(false);
    }
  }, [options.enabled]);

  const requestHardwareAccess = React.useCallback(async () => {
    setRequestingAccess(true);
    setAccessDismissed(true);
    try {
      if (webNfcSupported) {
        await startWebNfc();
      }
      if (usb.webHidSupported && !usb.usbPhysicallyConnected) {
        await usb.pairUsbReader();
        await usb.refreshHidDevices();
      }
    } finally {
      setRequestingAccess(false);
    }
  }, [webNfcSupported, usb, startWebNfc]);

  const needsHardwarePermission = React.useMemo(() => {
    if (!options.enabled || accessDismissed) return false;
    if (webNfcSupported && webNfcError === "permission-denied") return true;
    if (webNfcSupported && !webNfcActive && !webNfcError) return true;
    if (
      usb.webHidSupported &&
      !usb.usbPhysicallyConnected &&
      !usb.wedgeLive &&
      !webNfcActive
    ) {
      return true;
    }
    return false;
  }, [
    options.enabled,
    accessDismissed,
    webNfcSupported,
    webNfcError,
    webNfcActive,
    usb.webHidSupported,
    usb.usbPhysicallyConnected,
    usb.wedgeLive,
  ]);

  const reportWedgeInput = React.useCallback(
    (value: string) => {
      const cleaned =
        purpose === "program-uid"
          ? value.trim().replace(/[^a-fA-F0-9]/g, "")
          : value.trim();
      if (cleaned.length >= 4) {
        usb.reportWedgeActivity();
      }
    },
    [purpose, usb]
  );

  const state = React.useMemo((): NfcReaderState => {
    void clock;
    const platform = detectPlatformLabel();
    const tapHint =
      purpose === "program-uid" ? "tap blank NFC chip to read UID" : "tap Entertain Passport on device";

    if (webNfcSupported) {
      if (webNfcError === "permission-denied") {
        return {
          mode: "web-nfc",
          status: "permission-denied",
          readerLabel: "Built-in NFC",
          detail: `${platform} · tap "Allow NFC & USB access" or enable NFC in browser site settings`,
          webNfcSupported: true,
          inputFocused,
          webHidSupported: usb.webHidSupported,
          usbPhysicallyConnected: false,
        };
      }
      if (webNfcActive) {
        return {
          mode: "web-nfc",
          status: "connected",
          readerLabel: "Built-in NFC",
          detail: `${platform} · NFC scanner active · ${tapHint}`,
          webNfcSupported: true,
          inputFocused,
          webHidSupported: usb.webHidSupported,
          usbPhysicallyConnected: false,
        };
      }
      return {
        mode: "web-nfc",
        status: "ready",
        readerLabel: "Built-in NFC",
        detail: `${platform} · starting NFC scanner…`,
        webNfcSupported: true,
        inputFocused,
        webHidSupported: usb.webHidSupported,
        usbPhysicallyConnected: false,
      };
    }

    const primaryHid = usb.hidDevices[0]?.label ?? "USB NFC reader";
    const wedgeConfirmed = usb.wedgeLive;

    if (usb.usbPhysicallyConnected) {
      return {
        mode: "hid-wedge",
        status: "connected",
        readerLabel: primaryHid,
        detail: `${platform} · USB NFC reader detected · tap card on reader`,
        webNfcSupported: false,
        inputFocused,
        webHidSupported: usb.webHidSupported,
        usbPhysicallyConnected: true,
      };
    }

    if (wedgeConfirmed) {
      return {
        mode: "hid-wedge",
        status: "connected",
        readerLabel: "USB / keyboard wedge reader",
        detail: `${platform} · card read detected · reader is working`,
        webNfcSupported: false,
        inputFocused,
        webHidSupported: usb.webHidSupported,
        usbPhysicallyConnected: false,
      };
    }

    if (usb.webHidSupported) {
      return {
        mode: "hid-wedge",
        status: "ready",
        readerLabel: "USB NFC reader",
        detail: `${platform} · ${inputFocused ? "waiting for card tap…" : 'click "Allow NFC & USB access" or tap card on keyboard reader'}`,
        webNfcSupported: false,
        inputFocused,
        webHidSupported: true,
        usbPhysicallyConnected: false,
      };
    }

    return {
      mode: "hid-wedge",
      status: "ready",
      readerLabel: "USB / keyboard wedge reader",
      detail: `${platform} · tap a card on the reader to confirm it is connected`,
      webNfcSupported: false,
      inputFocused,
      webHidSupported: false,
      usbPhysicallyConnected: false,
    };
  }, [
    clock,
    webNfcSupported,
    webNfcActive,
    webNfcError,
    inputFocused,
    purpose,
    usb.hidDevices,
    usb.usbPhysicallyConnected,
    usb.wedgeLive,
    usb.webHidSupported,
  ]);

  return {
    ...state,
    setInputFocused,
    retryWebNfc: startWebNfc,
    reportWedgeInput,
    pairUsbReader: usb.pairUsbReader,
    pairingUsb: usb.pairing,
    pairUsbError: usb.pairError,
    refreshUsbDevices: usb.refreshHidDevices,
    requestHardwareAccess,
    requestingAccess,
    needsHardwarePermission,
  };
}
