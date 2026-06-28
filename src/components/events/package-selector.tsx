"use client";

import * as React from "react";
import { Check, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart-store";
import { formatCurrency, cn } from "@/lib/utils";
import { formatEventDate } from "@/lib/format";

export type Pkg = {
  id: string;
  name: string;
  description?: string | null;
  price: number; // cents
  qtyTotal: number;
  qtySold: number;
  perks: string[];
};

type Event = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date | string;
  primaryImage: string;
};

export function PackageSelector({
  event,
  packages,
  hideTitle,
}: {
  event: Event;
  packages: Pkg[];
  hideTitle?: boolean;
}) {
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const addLine = useCart((s) => s.addLine);
  const openCart = useCart((s) => s.openCart);

  const setQtyFor = (id: string, n: number) => setQty((q) => ({ ...q, [id]: Math.max(0, n) }));

  const totalQty = Object.values(qty).reduce((s, n) => s + n, 0);
  const totalCents = packages.reduce((s, p) => s + p.price * (qty[p.id] ?? 0), 0);

  const handleAddAll = () => {
    let added = 0;
    for (const p of packages) {
      const n = qty[p.id] ?? 0;
      if (n > 0) {
        addLine({
          packageId: p.id,
          eventId: event.id,
          eventTitle: event.title,
          eventSlug: event.slug,
          eventImage: event.primaryImage,
          eventDate: typeof event.startsAt === "string" ? event.startsAt : event.startsAt.toISOString(),
          packageName: p.name,
          unitPrice: p.price,
          qty: n,
          perks: p.perks,
        });
        added += n;
      }
    }
    if (added > 0) {
      setQty({});
      openCart();
    }
  };

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Choose your tickets</h2>
          <p className="text-xs text-muted-foreground">
            Add as many packages as you like - they all go into one cart.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {packages.map((p) => {
          const n = qty[p.id] ?? 0;
          const remaining = p.qtyTotal - p.qtySold;
          const lowStock = remaining < 50 && remaining > 0;
          const soldOut = remaining <= 0;

          return (
            <li
              key={p.id}
              className={cn(
                "rounded-2xl border bg-card p-4 transition-all",
                n > 0 && "border-primary/50 ring-2 ring-primary/20"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    {soldOut ? (
                      <Badge variant="outline">Sold out</Badge>
                    ) : lowStock ? (
                      <Badge variant="live">Only {remaining} left</Badge>
                    ) : null}
                  </div>
                  {p.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  {p.perks.length > 0 && (
                    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-1.5 text-xs">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {formatCurrency(p.price / 100)}
                  </p>
                  <div className="flex items-center gap-1 rounded-full border bg-background">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={n === 0 || soldOut}
                      onClick={() => setQtyFor(p.id, n - 1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{n}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={soldOut || n >= remaining}
                      onClick={() => setQtyFor(p.id, n + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Separator />

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border bg-background/90 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {totalQty} {totalQty === 1 ? "ticket" : "tickets"} selected · {formatEventDate(event.startsAt)}
          </p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {formatCurrency(totalCents / 100)}
          </p>
          {totalQty > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Earn {Math.floor(totalCents / 10000)} loyalty points on this purchase.
            </p>
          )}
        </div>
        <Button
          variant="brand"
          size="lg"
          disabled={totalQty === 0}
          onClick={handleAddAll}
          className="shrink-0"
        >
          <ShoppingBag className="h-4 w-4" />
          Add to cart
        </Button>
      </div>
    </div>
  );
}
