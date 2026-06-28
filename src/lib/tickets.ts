import { randomBytes } from "crypto";

/** Generate a legacy internal ticket code (not a customer/gate lookup surface). */
export function generateBarcode(): string {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `NZO-${part()}-${part()}-${part()}`;
}

/** Legacy full token retained for existing ticket records. */
export function generateQrPayload(ticketId: string, barcode: string): string {
  return `${ticketId}:${barcode}`;
}

export function parseQrPayload(raw: string): { ticketId?: string; barcode: string } {
  const trimmed = raw.trim();
  if (trimmed.includes(":")) {
    const [ticketId, barcode] = trimmed.split(":");
    return { ticketId, barcode: barcode ?? trimmed };
  }
  return { barcode: trimmed };
}
