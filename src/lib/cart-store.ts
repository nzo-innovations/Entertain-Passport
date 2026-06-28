"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  packageId: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventImage: string;
  eventDate: string;
  packageName: string;
  unitPrice: number;
  qty: number;
  perks: string[];
};

export type SeatedCartLine = {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventImage: string;
  eventDate: string;
  seatExternalIds: string[];
  seatLabels: string[];
  unitPrice: number;
  qty: number;
  totalPrice: number;
};

type CartState = {
  lines: CartLine[];
  seatedLines: SeatedCartLine[];
  /** Passport card order awaiting payment at checkout (Pay now flow). */
  passportCheckoutOrderId: string | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addLine: (line: CartLine) => void;
  addSeatedLine: (line: SeatedCartLine) => void;
  removeSeatedLine: (eventId: string) => void;
  updateQty: (packageId: string, qty: number) => void;
  removeLine: (packageId: string) => void;
  setPassportCheckoutOrderId: (id: string | null) => void;
  clear: () => void;
  totals: (passportCardMinor?: number) => {
    subtotal: number;
    fees: number;
    total: number;
    loyaltyEarned: number;
    passportCard: number;
  };
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      seatedLines: [],
      passportCheckoutOrderId: null,
      isOpen: false,
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
      addLine: (line) => {
        const lines = [...get().lines];
        const existing = lines.find((l) => l.packageId === line.packageId);
        if (existing) existing.qty += line.qty;
        else lines.push(line);
        set({ lines, isOpen: true });
      },
      addSeatedLine: (line) => {
        const seatedLines = get().seatedLines.filter((l) => l.eventId !== line.eventId);
        seatedLines.push(line);
        set({ seatedLines, isOpen: true });
      },
      removeSeatedLine: (eventId) =>
        set({ seatedLines: get().seatedLines.filter((l) => l.eventId !== eventId) }),
      updateQty: (packageId, qty) => {
        if (qty <= 0) {
          set({ lines: get().lines.filter((l) => l.packageId !== packageId) });
          return;
        }
        set({
          lines: get().lines.map((l) => (l.packageId === packageId ? { ...l, qty } : l)),
        });
      },
      removeLine: (packageId) =>
        set({ lines: get().lines.filter((l) => l.packageId !== packageId) }),
      setPassportCheckoutOrderId: (id) => set({ passportCheckoutOrderId: id }),
      clear: () => set({ lines: [], seatedLines: [], passportCheckoutOrderId: null }),
      totals: (passportCardMinor = 0) => {
        const lines = get().lines;
        const seatedLines = get().seatedLines;
        const ticketSubtotal =
          lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) +
          seatedLines.reduce((s, l) => s + l.totalPrice, 0);
        const subtotal = ticketSubtotal + passportCardMinor;
        const fees = Math.round(subtotal * 0.025);
        const total = subtotal + fees;
        const loyaltyEarned = Math.floor(ticketSubtotal / 10_000);
        return { subtotal: ticketSubtotal, fees, total, loyaltyEarned, passportCard: passportCardMinor };
      },
    }),
    { name: "nzo-cart" }
  )
);
