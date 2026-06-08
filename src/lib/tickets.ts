import { randomBytes } from "crypto";

/** Generate a unique scannable barcode for tickets (e.g. NZO-XXXX-XXXX-XXXX). */
export function generateBarcode(): string {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `NZO-${part()}-${part()}-${part()}`;
}

/** Full token stored in QR (includes ticket id prefix for lookup). */
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
