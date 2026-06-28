"use client";

import * as React from "react";
import { AlertTriangle, Clock, Loader2, Minus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCart } from "@/lib/cart-store";
import { formatCurrency, cn } from "@/lib/utils";
import { formatEventDate } from "@/lib/format";
import {
  SEAT_HEARTBEAT_SECONDS,
  SEAT_HOLD_DEBOUNCE_MS,
  SEAT_IDLE_RELEASE_MINUTES,
  SEAT_MAX_HOLD_MINUTES,
  SEAT_STATUS_POLL_SECONDS,
} from "@/lib/seating/constants";
import type { SeatMapStatusPayload } from "@/lib/seating/types";
import type { SeatLayoutDocument } from "@/lib/seating/types";
import { computeLayoutExtents } from "@/lib/seating/layout-utils";
import { SeatLayoutPreview, SeatLegend, type SeatVisualStatus } from "./seat-layout-preview";
import { SeatMapViewport } from "./seat-map-viewport";

type EventInfo = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  primaryImage: string;
};

export type SeatedCategoryInfo = {
  id: string;
  name: string;
  price: number;
};

function selectedFromHold(seating: SeatMapStatusPayload): Set<string> {
  if (!seating.hold?.seatIds?.length) return new Set();
  const heldDbIds = new Set(seating.hold.seatIds);
  return new Set(
    seating.seats.filter((s) => heldDbIds.has(s.id)).map((s) => s.externalId)
  );
}

function SeatPickerCanvas({
  layout,
  seatStatusMap,
  selected,
  onToggleSeat,
}: {
  layout: SeatLayoutDocument;
  seatStatusMap: Record<string, SeatVisualStatus>;
  selected: Set<string>;
  onToggleSeat: (id: string) => void;
}) {
  return (
    <SeatLayoutPreview
      layout={layout}
      embedded
      seatStatus={seatStatusMap}
      selectedIds={selected}
      onSeatClick={onToggleSeat}
      interactive
    />
  );
}

function CategorySeatCounters({
  categories,
  selectedByCategory,
  onRemoveOne,
}: {
  categories: SeatedCategoryInfo[];
  selectedByCategory: Record<string, number>;
  onRemoveOne: (categoryId: string) => void;
}) {
  const totalSelected = Object.values(selectedByCategory).reduce((s, n) => s + n, 0);
  const totalCents = categories.reduce(
    (s, c) => s + c.price * (selectedByCategory[c.id] ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold">Select your tickets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap seats on the map - counts update as you pick.
        </p>
      </div>

      <ul className="space-y-2">
        {categories.map((cat) => {
          const picked = selectedByCategory[cat.id] ?? 0;
          return (
            <li
              key={cat.id}
              className={cn(
                "rounded-xl border bg-card p-3 transition-all",
                picked > 0 && "border-primary/40 ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{cat.name}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(cat.price / 100)}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={picked === 0}
                    title="Remove one seat"
                    onClick={() => onRemoveOne(cat.id)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">
                    {picked}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{totalSelected}</span> seat
        {totalSelected !== 1 ? "s" : ""} selected ·{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrency(totalCents / 100)}
        </span>
      </div>
    </div>
  );
}

export function SeatPicker({
  event,
  seatedCategories,
}: {
  event: EventInfo;
  seatedCategories?: SeatedCategoryInfo[];
}) {
  const { toast } = useToast();
  const addSeatedLine = useCart((s) => s.addSeatedLine);
  const openCart = useCart((s) => s.openCart);

  const [data, setData] = React.useState<SeatMapStatusPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [syncing, setSyncing] = React.useState(false);
  const [addingToCart, setAddingToCart] = React.useState(false);
  const pendingToggleRef = React.useRef(0);
  const selectedRef = React.useRef(selected);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdown, setCountdown] = React.useState<string | null>(null);
  const [warnLevel, setWarnLevel] = React.useState<"none" | "idle" | "max">("none");

  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  React.useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    []
  );

  const loadStatus = React.useCallback(
    async (opts?: { silent?: boolean; syncSelection?: boolean }) => {
      const res = await fetch(`/api/events/${event.id}/seats/status`);
      const json = await res.json();
      const seating = json.seating ?? null;
      setData(seating);

      if (opts?.syncSelection) {
        if (seating) {
          setSelected(selectedFromHold(seating));
        } else {
          setSelected(new Set());
        }
      }

      if (!opts?.silent) setLoading(false);
    },
    [event.id]
  );

  const refreshMapOnly = React.useCallback(async () => {
    if (pendingToggleRef.current > 0) return;
    await loadStatus({ silent: true, syncSelection: false });
  }, [loadStatus]);

  React.useEffect(() => {
    void loadStatus({ syncSelection: true });
  }, [loadStatus]);

  /** Refresh availability for other buyers - never overwrite local selection. */
  React.useEffect(() => {
    if (!data) return;
    const poll = () => {
      if (document.visibilityState === "visible") void refreshMapOnly();
    };
    const id = setInterval(poll, SEAT_STATUS_POLL_SECONDS * 1000);
    return () => clearInterval(id);
  }, [data, refreshMapOnly]);

  React.useEffect(() => {
    if (!data?.hold) {
      setCountdown(null);
      setWarnLevel("none");
      return;
    }

    const tick = () => {
      const expires = new Date(data.hold!.expiresAt).getTime();
      const max = new Date(data.hold!.maxExpiresAt).getTime();
      const now = Date.now();
      const ms = Math.max(0, Math.min(expires, max) - now);
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setCountdown(`${mins}:${String(secs).padStart(2, "0")}`);

      const maxRemaining = max - now;
      const idleRemaining = expires - now;
      if (maxRemaining < 5 * 60_000) setWarnLevel("max");
      else if (idleRemaining < 3 * 60_000) setWarnLevel("idle");
      else setWarnLevel("none");

      if (ms <= 0) void loadStatus({ silent: true, syncSelection: true });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.hold, loadStatus]);

  React.useEffect(() => {
    if (!data?.hold) return;
    const id = setInterval(async () => {
      await fetch(`/api/events/${event.id}/seats/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "SELECTING" }),
      });
    }, SEAT_HEARTBEAT_SECONDS * 1000);
    return () => clearInterval(id);
  }, [data?.hold, event.id]);

  const seatStatusMap = React.useMemo(() => {
    const map: Record<string, SeatVisualStatus> = {};
    if (!data) return map;
    for (const s of data.seats) {
      if (!s.enabled) map[s.externalId] = "DISABLED";
      else if (s.status === "SOLD") map[s.externalId] = "SOLD";
      else if (s.status === "HELD" && !s.heldByYou) map[s.externalId] = "HELD";
      else if (s.status === "BLOCKED") map[s.externalId] = "BLOCKED";
      else map[s.externalId] = "AVAILABLE";
    }
    return map;
  }, [data]);

  const categoryCounts = React.useMemo(() => {
    if (!data) return {};
    const counts: Record<string, { available: number; total: number }> = {};
    for (const c of data.categories) {
      counts[c.externalId] = { available: 0, total: 0 };
    }
    for (const s of data.seats) {
      const cid = s.categoryExternalId;
      if (!cid || !counts[cid]) continue;
      counts[cid].total++;
      if (s.enabled && s.status === "AVAILABLE") counts[cid].available++;
    }
    return counts;
  }, [data]);

  const layoutExtents = React.useMemo(
    () => (data?.layout ? computeLayoutExtents(data.layout) : null),
    [data?.layout]
  );

  const layoutWidth = layoutExtents?.width;
  const layoutHeight = layoutExtents?.height;

  const mapContentSize = React.useMemo(
    () =>
      layoutWidth && layoutHeight
        ? { width: layoutWidth, height: layoutHeight }
        : undefined,
    [layoutWidth, layoutHeight]
  );

  const counterCategories = React.useMemo((): SeatedCategoryInfo[] => {
    if (seatedCategories?.length) return seatedCategories;
    if (!data) return [];
    return data.categories
      .filter((c) => (categoryCounts[c.externalId]?.total ?? 0) > 0)
      .map((c) => ({
        id: c.externalId,
        name: c.name,
        price: c.price,
      }));
  }, [seatedCategories, data, categoryCounts]);

  /** Map seat categoryExternalId → counter row id (package id when linked). */
  const counterCategoryKey = React.useMemo(() => {
    const extToCounter = new Map<string, string>();
    for (const counter of counterCategories) {
      extToCounter.set(counter.id, counter.id);
    }
    if (!data) return extToCounter;
    for (const dc of data.categories) {
      if (extToCounter.has(dc.externalId)) continue;
      const match = counterCategories.find(
        (c) => c.name === dc.name && c.price === dc.price
      );
      if (match) extToCounter.set(dc.externalId, match.id);
    }
    return extToCounter;
  }, [data, counterCategories]);

  const selectedByCategory = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (!data) return counts;
    for (const extId of selected) {
      const seat = data.seats.find((s) => s.externalId === extId);
      const cid = seat?.categoryExternalId;
      if (!cid) continue;
      const key = counterCategoryKey.get(cid) ?? cid;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [data, selected, counterCategoryKey]);

  const maxPerCategory = React.useMemo(() => {
    const caps: Record<string, number> = {};
    for (const counter of counterCategories) {
      caps[counter.id] = 0;
    }
    if (!data) return caps;
    for (const s of data.seats) {
      if (!s.enabled || s.status === "SOLD" || s.status === "BLOCKED") continue;
      const cid = s.categoryExternalId;
      if (!cid) continue;
      if (s.status === "HELD" && !s.heldByYou) continue;
      const key = counterCategoryKey.get(cid) ?? cid;
      caps[key] = (caps[key] ?? 0) + 1;
    }
    return caps;
  }, [data, counterCategories, counterCategoryKey]);

  const flushHoldSync = React.useCallback(
    async (seatSet: Set<string>) => {
      pendingToggleRef.current += 1;
      setSyncing(true);
      try {
        if (seatSet.size === 0) {
          await fetch(`/api/events/${event.id}/seats/release`, { method: "POST" });
          await loadStatus({ silent: true, syncSelection: true });
          return;
        }

        const res = await fetch(`/api/events/${event.id}/seats/hold`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seatExternalIds: [...seatSet], phase: "SELECTING" }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast({ title: json.error ?? "Could not hold seats", variant: "destructive" });
          await loadStatus({ silent: true, syncSelection: true });
          return;
        }

        const seating = json.seating as SeatMapStatusPayload;
        setData(seating);

        const confirmed = selectedFromHold(seating);
        setSelected((current) => {
          if (current.size === seatSet.size && [...current].every((id) => seatSet.has(id))) {
            const merged = confirmed.size > 0 ? confirmed : current;
            selectedRef.current = merged;
            return merged;
          }
          return current;
        });
      } catch {
        await loadStatus({ silent: true, syncSelection: true });
      } finally {
        pendingToggleRef.current -= 1;
        setSyncing(false);
      }
    },
    [event.id, loadStatus, toast]
  );

  const scheduleHoldSync = React.useCallback(
    (seatSet: Set<string>) => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        void flushHoldSync(seatSet);
      }, SEAT_HOLD_DEBOUNCE_MS);
    },
    [flushHoldSync]
  );

  const applySelection = React.useCallback(
    (next: Set<string>) => {
      setSelected(next);
      selectedRef.current = next;
      scheduleHoldSync(next);
    },
    [scheduleHoldSync]
  );

  const toggleSeat = React.useCallback(
    (externalId: string) => {
      if (!data) return;
      const seat = data.seats.find((s) => s.externalId === externalId);
      const isMine = selectedRef.current.has(externalId) || seat?.heldByYou;
      const st = seatStatusMap[externalId];
      if (st === "SOLD" || st === "BLOCKED" || st === "DISABLED") return;
      if (st === "HELD" && !isMine) return;

      const next = new Set(selectedRef.current);
      if (next.has(externalId)) {
        next.delete(externalId);
      } else {
        const cid = seat?.categoryExternalId;
        if (cid) {
          const key = counterCategoryKey.get(cid) ?? cid;
          const cap = maxPerCategory[key] ?? 0;
          const picked = [...next].filter((id) => {
            const s = data.seats.find((x) => x.externalId === id);
            if (!s?.categoryExternalId) return false;
            return (counterCategoryKey.get(s.categoryExternalId) ?? s.categoryExternalId) === key;
          }).length;
          if (cap > 0 && picked >= cap) {
            toast({
              title: "No more seats available in this category.",
              variant: "destructive",
            });
            return;
          }
        }
        next.add(externalId);
      }

      applySelection(next);
    },
    [data, seatStatusMap, counterCategoryKey, maxPerCategory, toast, applySelection]
  );

  const removeOneInCategory = React.useCallback(
    (categoryId: string) => {
      if (!data) return;
      const extId = [...selectedRef.current].find((id) => {
        const seat = data.seats.find((s) => s.externalId === id);
        if (!seat?.categoryExternalId) return false;
        const key = counterCategoryKey.get(seat.categoryExternalId) ?? seat.categoryExternalId;
        return key === categoryId;
      });
      if (extId) toggleSeat(extId);
    },
    [data, counterCategoryKey, toggleSeat]
  );

  const totalCents = React.useMemo(() => {
    if (!data) return 0;
    const catMap = new Map(data.categories.map((c) => [c.externalId, c]));
    let sum = 0;
    for (const extId of selected) {
      const seat = data.seats.find((s) => s.externalId === extId);
      if (!seat?.categoryExternalId) continue;
      sum += catMap.get(seat.categoryExternalId)?.price ?? 0;
    }
    return sum;
  }, [data, selected]);

  const handleAddToCart = async () => {
    if (!data || selected.size === 0) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    setAddingToCart(true);
    await flushHoldSync(selectedRef.current);
    setAddingToCart(false);

    if (selectedRef.current.size === 0) return;

    const count = selectedRef.current.size;
    const labels = [...selectedRef.current].map(
      (id) => data.seats.find((s) => s.externalId === id)?.label ?? id
    );
    const cents = [...selectedRef.current].reduce((sum, extId) => {
      const seat = data.seats.find((s) => s.externalId === extId);
      if (!seat?.categoryExternalId) return sum;
      const cat = data.categories.find((c) => c.externalId === seat.categoryExternalId);
      return sum + (cat?.price ?? 0);
    }, 0);

    addSeatedLine({
      eventId: event.id,
      eventTitle: event.title,
      eventSlug: event.slug,
      eventImage: event.primaryImage,
      eventDate: event.startsAt,
      seatExternalIds: [...selectedRef.current],
      seatLabels: labels,
      unitPrice: Math.round(cents / count),
      qty: count,
      totalPrice: cents,
    });
    setSelected(new Set());
    selectedRef.current = new Set();
    openCart();
    toast({ title: `${count} seat(s) added to cart` });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading seat map…</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Assigned seating is not available for this event yet.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {counterCategories.length > 0 && (
        <CategorySeatCounters
          categories={counterCategories}
          selectedByCategory={selectedByCategory}
          onRemoveOne={removeOneInCategory}
        />
      )}

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
        <p className="font-medium">Seat hold policy</p>
        <p className="mt-1 text-muted-foreground dark:text-amber-200/80">
          Seats are held while you select and checkout. If you leave without paying, they release
          after {SEAT_IDLE_RELEASE_MINUTES} minutes. Maximum hold is {SEAT_MAX_HOLD_MINUTES}{" "}
          minutes - then you must re-select. Zoom in with + if seats are hard to tap.
        </p>
      </div>

      {countdown && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
            warnLevel === "max" && "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
            warnLevel === "idle" && "border-red-400 bg-red-50/80 text-red-600 dark:bg-red-950/20",
            warnLevel === "none" && "border-border text-muted-foreground"
          )}
        >
          {warnLevel !== "none" ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 shrink-0" />
          )}
          <span>
            {warnLevel === "max"
              ? "Final minutes - re-select required soon"
              : warnLevel === "idle"
                ? "Complete checkout soon or seats will release"
                : "Seats held for"}{" "}
            <span className="tabular-nums">{countdown}</span>
          </span>
        </div>
      )}

      <SeatLegend layout={data.layout} counts={categoryCounts} />
      {syncing && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving your selection…
        </p>
      )}
      <SeatMapViewport
        seatCount={data.seats.length}
        minHeight={480}
        forceDetailedSeats
        fluidContent
        minInitialZoom={1.4}
        contentSize={mapContentSize}
      >
        <SeatPickerCanvas
          layout={data.layout}
          seatStatusMap={seatStatusMap}
          selected={selected}
          onToggleSeat={toggleSeat}
        />
      </SeatMapViewport>

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {selected.size} seat{selected.size !== 1 ? "s" : ""} selected ·{" "}
            {formatEventDate(event.startsAt)}
          </p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {formatCurrency(totalCents / 100)}
          </p>
        </div>
        <Button
          variant="brand"
          size="lg"
          disabled={selected.size === 0 || addingToCart}
          onClick={() => void handleAddToCart()}
        >
          {addingToCart ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingBag className="h-4 w-4" />
          )}
          {addingToCart ? "Saving…" : "Add seats to cart"}
        </Button>
      </div>
    </div>
  );
};
