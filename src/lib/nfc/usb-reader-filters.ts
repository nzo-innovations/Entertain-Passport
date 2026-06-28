/** WebHID filters for USB NFC / smart-card readers (pair dialog). */

export type HidDeviceFilter = {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
};

export type HidDeviceLike = {
  vendorId: number;
  productId: number;
  productName?: string;
};

export type HidApiLike = {
  getDevices(): Promise<HidDeviceLike[]>;
  requestDevice(options: { filters: HidDeviceFilter[] }): Promise<HidDeviceLike>;
  addEventListener(type: "connect" | "disconnect", listener: () => void): void;
  removeEventListener(type: "connect" | "disconnect", listener: () => void): void;
};

/** Vendor IDs for ACS, Identiv, OmniKey, and common OEM NFC readers. */
export const NFC_USB_HID_FILTERS: HidDeviceFilter[] = [
  { vendorId: 0x072f }, // ACS (ACR122U, ACR1252U, …)
  { vendorId: 0x04e6 }, // Identiv / SCM Microsystems
  { vendorId: 0x076b }, // OmniKey
  { vendorId: 0x0483 }, // STMicro
  { vendorId: 0x0ca6 }, // Feitian
  { vendorId: 0x04cc }, // NXP
  { vendorId: 0x08ff }, // AuthenTrend / ACS variants
  { vendorId: 0x1a86 }, // QinHeng (common USB bridge on OEM readers)
  { vendorId: 0x10c4 }, // Silicon Labs
  { vendorId: 0x062a }, // MosArt
  { vendorId: 0x0416 }, // Winbond / OEM
  { vendorId: 0x067b }, // Prolific
  { vendorId: 0x058f }, // Alcor Micro
  { vendorId: 0x0783 }, // CIMX
  { vendorId: 0x2544 }, // ACS
  { vendorId: 0x0951 }, // Kingston OEM
  { vendorId: 0x1fc9 }, // NXP
  { vendorId: 0x0525 }, // NXP / reader OEM
  { vendorId: 0x09cc }, // HID Global
  { vendorId: 0x046a }, // Cherry (some terminals)
  { vendorId: 0x1532 }, // Razer OEM bridges
  { vendorId: 0x2341 }, // Arduino-based prototypes
  { usagePage: 0xff00 }, // Vendor-defined (many NFC firmwares)
  { usagePage: 0xffaa },
  { usagePage: 0x008c, usage: 0x0001 }, // Smart Card
];

const NFC_NAME_RE =
  /nfc|rfid|acr|acs|card reader|smart.?card|contactless|1252|122u|omnikey|identiv|reader|passport/i;

export function deviceKey(device: HidDeviceLike): string {
  return `${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
}

export function isKnownNfcHidDevice(device: HidDeviceLike): boolean {
  return NFC_USB_HID_FILTERS.some(
    (f) => f.vendorId != null && f.vendorId === device.vendorId
  );
}

export function isLikelyNfcHidDevice(device: HidDeviceLike): boolean {
  if (isKnownNfcHidDevice(device)) return true;
  const name = (device.productName ?? "").trim();
  return name.length > 0 && NFC_NAME_RE.test(name);
}

export function hidDeviceLabel(device: HidDeviceLike): string {
  const name = device.productName?.trim();
  if (name) return name;
  return `USB device (${deviceKey(device)})`;
}

export type PairUsbReaderResult =
  | { ok: true; mode: "hid-paired"; label: string }
  | { ok: false; mode: "cancelled" }
  | { ok: false; mode: "keyboard-wedge"; message: string }
  | { ok: false; mode: "error"; message: string };

export const KEYBOARD_WEDGE_HINT =
  "Most USB NFC readers act as a keyboard and cannot appear in the Pair dialog. Focus the UID field below and tap a card - the light turns green when data is received.";
