"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/utils";
import { formatEventDate } from "@/lib/format";

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const closeCart = useCart((s) => s.closeCart);
  const lines = useCart((s) => s.lines);
  const updateQty = useCart((s) => s.updateQty);
  const removeLine = useCart((s) => s.removeLine);
  const totals = useCart((s) => s.totals);

  const t = totals();

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : closeCart())}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Your cart
            {lines.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {lines.reduce((s, l) => s + l.qty, 0)}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Multiple events &amp; packages welcome. We hold seats for 10 minutes at checkout.
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">Your cart is empty</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse the line-up and add tickets to get started.
              </p>
            </div>
            <Button onClick={closeCart} variant="brand" asChild>
              <Link href="/events">Discover events</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="space-y-4">
                {lines.map((l) => (
                  <li
                    key={l.packageId}
                    className="flex gap-3 rounded-xl border bg-card/50 p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={l.eventImage}
                        alt={l.eventTitle}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <Link
                        href={`/events/${l.eventSlug}`}
                        className="line-clamp-1 text-sm font-semibold hover:underline"
                        onClick={closeCart}
                      >
                        {l.eventTitle}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {l.packageName} · {formatEventDate(l.eventDate)}
                      </p>

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1 rounded-full border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQty(l.packageId, l.qty - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQty(l.packageId, l.qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrency((l.unitPrice * l.qty) / 100)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLine(l.packageId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border/60 px-6 py-5">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(t.subtotal / 100)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Service fee</span>
                  <span className="tabular-nums">{formatCurrency(t.fees / 100)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(t.total / 100)}</span>
                </div>
                <p className="flex items-center gap-1.5 pt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  You&apos;ll earn {t.loyaltyEarned} loyalty points on this order.
                </p>
              </div>
              <Button variant="brand" size="lg" className="mt-4 w-full" asChild>
                <Link href="/checkout" onClick={closeCart}>
                  Buy tickets
                </Link>
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Visa, Mastercard &amp; Amex via WebXPay. KOKO pay-later coming soon. Tickets issued instantly.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
