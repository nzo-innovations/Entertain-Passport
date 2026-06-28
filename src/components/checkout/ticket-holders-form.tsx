"use client";

import * as React from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/format";
import { ID_TYPE_OPTIONS, type IdentityType } from "@/lib/identity";
import type { CartLine, SeatedCartLine } from "@/lib/cart-store";
import type { TicketHolderInput } from "@/lib/checkout-holders";

export type TicketSlot = {
  key: string;
  ticketNumber: number;
  eventTitle: string;
  packageName: string;
  eventDate: string;
};

export function buildTicketSlots(lines: CartLine[], seatedLines: SeatedCartLine[] = []): TicketSlot[] {
  const slots: TicketSlot[] = [];
  let n = 1;
  for (const line of lines) {
    for (let i = 0; i < line.qty; i++) {
      slots.push({
        key: `${line.packageId}-${i}`,
        ticketNumber: n++,
        eventTitle: line.eventTitle,
        packageName: line.packageName,
        eventDate: line.eventDate,
      });
    }
  }
  for (const line of seatedLines) {
    for (let i = 0; i < line.qty; i++) {
      slots.push({
        key: `${line.eventId}-seat-${i}`,
        ticketNumber: n++,
        eventTitle: line.eventTitle,
        packageName: `Seat ${line.seatLabels[i] ?? i + 1}`,
        eventDate: line.eventDate,
      });
    }
  }
  return slots;
}

type SlotState = {
  mode: "self" | "passport" | "identity";
  passportQuery: string;
  lookupName: string | null;
  lookupPassportNo: string | null;
  confirmed: boolean;
  idType: IdentityType;
  idNumber: string;
  holderName: string;
};

function defaultSlotState(isSelf: boolean): SlotState {
  return {
    mode: isSelf ? "self" : "passport",
    passportQuery: "",
    lookupName: null,
    lookupPassportNo: null,
    confirmed: isSelf,
    idType: "NIC",
    idNumber: "",
    holderName: "",
  };
}

export function TicketHoldersForm({
  slots,
  buyerName,
  onChange,
}: {
  slots: TicketSlot[];
  buyerName: string;
  onChange: (holders: TicketHolderInput[], allAssigned: boolean) => void;
}) {
  const [states, setStates] = React.useState<SlotState[]>(() =>
    slots.map((_, i) => defaultSlotState(i === 0))
  );
  const [searching, setSearching] = React.useState<number | null>(null);

  const slotKey = slots.map((s) => s.key).join("|");
  React.useEffect(() => {
    setStates(slots.map((_, i) => defaultSlotState(i === 0)));
  }, [slotKey, slots]);

  React.useEffect(() => {
    const holders: TicketHolderInput[] = states.map((s) => {
      if (s.mode === "self") return { type: "self" };
      if (s.mode === "passport") {
        return {
          type: "passport",
          passportNo: s.confirmed && s.lookupPassportNo ? s.lookupPassportNo : "",
          name: s.lookupName ?? undefined,
        };
      }
      return {
        type: "identity",
        idType: s.idType,
        idNumber: s.confirmed ? s.idNumber.trim() : "",
        name: s.holderName.trim() || undefined,
      };
    });

    const allAssigned = states.every((s) => {
      if (s.mode === "self") return true;
      if (s.mode === "passport") return s.confirmed && !!s.lookupPassportNo;
      return s.confirmed && !!s.idNumber.trim();
    });

    onChange(holders, allAssigned);
  }, [states, onChange]);

  function patch(index: number, patch: Partial<SlotState>) {
    setStates((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function searchPassport(index: number) {
    const query = states[index].passportQuery.trim();
    if (!query) return;
    setSearching(index);
    try {
      const res = await fetch("/api/checkout/lookup-passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportNo: query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patch(index, { lookupName: null, lookupPassportNo: null, confirmed: false });
        return;
      }
      if (data.found) {
        patch(index, {
          lookupName: data.displayName,
          lookupPassportNo: data.passportNo,
          confirmed: false,
        });
      } else {
        patch(index, { lookupName: null, lookupPassportNo: null, confirmed: false });
      }
    } finally {
      setSearching(null);
    }
  }

  if (slots.length === 0) return null;

  return (
    <div className="space-y-4">
      {slots.map((slot, index) => {
        const s = states[index];
        const isSelf = s.mode === "self";

        return (
          <div key={slot.key} className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Ticket {slot.ticketNumber}</Badge>
                  {s.confirmed && (
                    <Badge variant="success" className="gap-1">
                      <Check className="h-3 w-3" />
                      Assigned
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium">{slot.eventTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {slot.packageName} · {formatEventDate(slot.eventDate)}
                </p>
              </div>
              {index === 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={isSelf ? "brand" : "outline"}
                  onClick={() =>
                    patch(index, {
                      mode: "self",
                      confirmed: true,
                      lookupName: null,
                      lookupPassportNo: null,
                    })
                  }
                >
                  Use my account
                </Button>
              )}
            </div>

            {isSelf ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-emerald-500" />
                Holder: <span className="font-medium text-foreground">{buyerName}</span> (you)
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className={
                      s.mode === "passport" ? "font-semibold text-primary" : "text-muted-foreground"
                    }
                    onClick={() =>
                      patch(index, {
                        mode: "passport",
                        confirmed: false,
                        lookupName: null,
                        lookupPassportNo: null,
                      })
                    }
                  >
                    Entertain Passport number
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className={
                      s.mode === "identity" ? "font-semibold text-primary" : "text-muted-foreground"
                    }
                    onClick={() =>
                      patch(index, {
                        mode: "identity",
                        confirmed: false,
                        lookupName: null,
                        lookupPassportNo: null,
                      })
                    }
                  >
                    NIC / Passport ID
                  </button>
                </div>

                {s.mode === "passport" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={s.passportQuery}
                        onChange={(e) =>
                          patch(index, {
                            passportQuery: e.target.value.toUpperCase(),
                            lookupName: null,
                            lookupPassportNo: null,
                            confirmed: false,
                          })
                        }
                        placeholder="EP-XXXX-XXXX"
                        className="h-9"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={searching === index || !s.passportQuery.trim()}
                        onClick={() => void searchPassport(index)}
                      >
                        {searching === index ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        Search
                      </Button>
                    </div>
                    {s.lookupName && s.lookupPassportNo && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                        <span>
                          Found: <strong>{s.lookupName}</strong> · {s.lookupPassportNo}
                        </span>
                        {!s.confirmed && (
                          <Button
                            type="button"
                            size="sm"
                            variant="brand"
                            onClick={() => patch(index, { confirmed: true })}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add
                          </Button>
                        )}
                      </div>
                    )}
                    {s.passportQuery && !s.lookupName && searching !== index && (
                      <p className="text-xs text-muted-foreground">
                        No member found - try another number or add NIC / passport ID manually.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs sm:col-span-2">
                      <span className="font-medium">Residency</span>
                      <select
                        value={s.idType}
                        onChange={(e) =>
                          patch(index, {
                            idType: e.target.value as IdentityType,
                            confirmed: false,
                          })
                        }
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        {ID_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">
                        {s.idType === "NIC" ? "NIC number" : "Passport number"}
                      </span>
                      <Input
                        value={s.idNumber}
                        onChange={(e) =>
                          patch(index, {
                            idNumber: e.target.value.toUpperCase(),
                            confirmed: false,
                          })
                        }
                        placeholder={s.idType === "NIC" ? "200012345678" : "N1234567"}
                        className="h-9"
                      />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">Holder name (optional)</span>
                      <Input
                        value={s.holderName}
                        onChange={(e) => patch(index, { holderName: e.target.value, confirmed: false })}
                        placeholder="Friend's name"
                        className="h-9"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        disabled={!s.idNumber.trim()}
                        onClick={() => patch(index, { confirmed: true })}
                      >
                        Confirm holder
                      </Button>
                    </div>
                  </div>
                )}

                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      patch(index, {
                        mode: "self",
                        confirmed: true,
                        lookupName: null,
                        lookupPassportNo: null,
                      })
                    }
                  >
                    Assign to me instead
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function holdersReady(states: TicketHolderInput[], slotCount: number): boolean {
  if (states.length !== slotCount) return false;
  return states.every((h) => {
    if (h.type === "self") return true;
    if (h.type === "passport") return !!h.passportNo?.trim();
    if (h.type === "identity") return !!h.idNumber?.trim();
    return false;
  });
}
