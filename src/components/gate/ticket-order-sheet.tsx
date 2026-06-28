"use client";

import * as React from "react";
import { Mail, Phone, ShoppingBag, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { holderKindBadge } from "@/lib/gate-holders";
import type { HolderKind } from "@/lib/gate-holders";
import { cn } from "@/lib/utils";

export type OrderGroup = {
  orderId: string;
  purchasedAt: string;
  buyer: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    nic?: string | null;
    idType?: string | null;
    idNumber?: string | null;
  };
  packageName: string;
  ticketCount: number;
  tickets: {
    id: string;
    slot: number;
    label: string;
    kind: HolderKind;
    status: string;
    identity: string;
    passportNo: string | null;
    checkedInAt: string | null;
    isHighlighted?: boolean;
  }[];
};

export function TicketOrderSheet({
  open,
  onOpenChange,
  group,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: OrderGroup | null;
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Purchase details
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <p className="mt-6 text-center text-sm text-muted-foreground">Loading…</p>
        )}

        {!loading && group && (
          <div className="mt-4 space-y-5">
            {/* Buyer */}
            <section className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ticket buyer
              </p>
              <p className="mt-2 font-semibold">{group.buyer.name ?? "-"}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {group.buyer.email}
                </p>
                {group.buyer.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {group.buyer.phone}
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {group.packageName} · {group.ticketCount} ticket{group.ticketCount !== 1 ? "s" : ""} ·{" "}
                {new Date(group.purchasedAt).toLocaleString()}
              </p>
            </section>

            {/* All tickets in this purchase */}
            <section>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                All tickets in this purchase
              </p>
              <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                {group.tickets.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      "rounded-xl border p-3 text-sm",
                      t.isHighlighted && "border-primary/50 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{t.label}</span>
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {t.identity}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={t.status === "CHECKED_IN" ? "success" : "outline"}>
                          {t.status === "CHECKED_IN" ? "In" : "Pending"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {holderKindBadge(t.kind)}
                        </Badge>
                      </div>
                    </div>
                    {t.checkedInAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Checked in {new Date(t.checkedInAt).toLocaleTimeString()}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">Ticket {t.slot} of {group.ticketCount}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
