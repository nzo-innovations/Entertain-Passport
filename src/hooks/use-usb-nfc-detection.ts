"use client";

import * as React from "react";
import {
  deviceKey,
  hidDeviceLabel,
  isLikelyNfcHidDevice,
  KEYBOARD_WEDGE_HINT,
  NFC_USB_HID_FILTERS,
  type HidDeviceLike,
  type PairUsbReaderResult,
} from "@/lib/nfc/usb-reader-filters";

declare global {
  interface Navigator {
    hid?: import("@/lib/nfc/usb-reader-filters").HidApiLike;
  }
}

export type UsbNfcDevice = {
  id: string;
  label: string;
};

const WEDGE_ACTIVE_MS = 120_000;
const POLL_MS = 4000;

function acceptHidDevice(device: HidDeviceLike, trustedKeys: Set<string>): boolean {
  return isLikelyNfcHidDevice(device) || trustedKeys.has(deviceKey(device));
}

export function useUsbNfcDetection(enabled: boolean) {
  const [hidDevices, setHidDevices] = React.useState<UsbNfcDevice[]>([]);
  const [lastWedgeAt, setLastWedgeAt] = React.useState<number | null>(null);
  const [pairError, setPairError] = React.useState<string | null>(null);
  const [pairing, setPairing] = React.useState(false);
  const [clock, setClock] = React.useState(0);
  const trustedKeysRef = React.useRef<Set<string>>(new Set());

  const webHidSupported = typeof navigator !== "undefined" && "hid" in navigator;

  React.useEffect(() => {
    if (!enabled || lastWedgeAt == null) return;
    const id = setInterval(() => setClock((c) => c + 1), 5000);
    return () => clearInterval(id);
  }, [enabled, lastWedgeAt]);

  const refreshHidDevices = React.useCallback(async () => {
    if (!webHidSupported || !navigator.hid) {
      setHidDevices([]);
      return;
    }
    try {
      const devices = await navigator.hid.getDevices();
      const trusted = trustedKeysRef.current;
      const nfc = devices.filter((d) => acceptHidDevice(d, trusted));
      setHidDevices(
        nfc.map((d) => ({
          id: deviceKey(d),
          label: hidDeviceLabel(d),
        }))
      );
    } catch {
      setHidDevices([]);
    }
  }, [webHidSupported]);

  React.useEffect(() => {
    if (!enabled || !webHidSupported || !navigator.hid) return;

    void refreshHidDevices();

    const onConnect = () => void refreshHidDevices();
    const onDisconnect = () => void refreshHidDevices();
    navigator.hid.addEventListener("connect", onConnect);
    navigator.hid.addEventListener("disconnect", onDisconnect);

    const poll = setInterval(() => void refreshHidDevices(), POLL_MS);

    return () => {
      clearInterval(poll);
      navigator.hid?.removeEventListener("connect", onConnect);
      navigator.hid?.removeEventListener("disconnect", onDisconnect);
    };
  }, [enabled, webHidSupported, refreshHidDevices]);

  const pairUsbReader = React.useCallback(async (): Promise<PairUsbReaderResult> => {
    if (!webHidSupported || !navigator.hid) {
      return {
        ok: false,
        mode: "keyboard-wedge",
        message: KEYBOARD_WEDGE_HINT,
      };
    }
    setPairing(true);
    setPairError(null);
    try {
      const device = await navigator.hid.requestDevice({ filters: NFC_USB_HID_FILTERS });
      trustedKeysRef.current.add(deviceKey(device));
      await refreshHidDevices();
      return { ok: true, mode: "hid-paired", label: hidDeviceLabel(device) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not pair USB reader.";
      if (/cancel/i.test(msg)) {
        return { ok: false, mode: "cancelled" };
      }
      setPairError(msg);
      return { ok: false, mode: "error", message: msg };
    } finally {
      setPairing(false);
    }
  }, [webHidSupported, refreshHidDevices]);

  const reportWedgeActivity = React.useCallback(() => {
    setLastWedgeAt(Date.now());
  }, []);

  const wedgeLive =
    lastWedgeAt != null && Date.now() - lastWedgeAt < WEDGE_ACTIVE_MS && clock >= 0;
  const usbPhysicallyConnected = hidDevices.length > 0;

  return {
    webHidSupported,
    hidDevices,
    usbPhysicallyConnected,
    wedgeLive,
    lastWedgeAt,
    pairError,
    pairing,
    pairUsbReader,
    reportWedgeActivity,
    refreshHidDevices,
  };
}
