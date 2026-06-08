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

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addLine: (line: CartLine) => void;
  updateQty: (packageId: string, qty: number) => void;
  removeLine: (packageId: string) => void;
  clear: () => void;
  totals: () => { subtotal: number; fees: number; total: number; loyaltyEarned: number };
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
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
      clear: () => set({ lines: [] }),
      totals: () => {
        const lines = get().lines;
        const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const fees = Math.round(subtotal * 0.025); // 2.5% service fee, demo
        const total = subtotal + fees;
        const loyaltyEarned = Math.floor(subtotal / 100); // 1pt per $1
        return { subtotal, fees, total, loyaltyEarned };
      },
    }),
    { name: "nzo-cart" }
  )
);
