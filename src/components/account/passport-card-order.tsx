"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, CreditCard, Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";

type CardOrder = {
  id: string;
  status: string;
  paymentTiming: string;
  quantity: number;
  total: number;
  createdAt: string | Date;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "outline" | "secondary"> = {
  PAID: "success",
  PENDING_PAYMENT: "warning",
  DEFERRED: "warning",
  FULFILLED: "success",
  CANCELLED: "secondary",
  REQUESTED: "outline",
};

function statusLabel(status: string) {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PENDING_PAYMENT":
      return "Awaiting payment";
    case "DEFERRED":
      return "Deferred";
    case "FULFILLED":
      return "Shipped";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Requested";
  }
}

export function PassportCardOrderPanel({
  hasPassport,
  canShip,
  price,
  shippingSummary,
  latestOrder,
  deferredTotal,
}: {
  hasPassport: boolean;
  canShip: boolean;
  price: number;
  shippingSummary: string | null;
  latestOrder: CardOrder | null;
  deferredTotal: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const setPassportCheckoutOrderId = useCart((s) => s.setPassportCheckoutOrderId);
  const [busy, setBusy] = React.useState<"PAY_NOW" | "DEFER_TO_NEXT_ORDER" | null>(null);

  const order = async (paymentTiming: "PAY_NOW" | "DEFER_TO_NEXT_ORDER") => {
    setBusy(paymentTiming);
    try {
      const res = await fetch("/api/account/passport-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentTiming, quantity: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Couldn't order card",
          description: data?.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (paymentTiming === "PAY_NOW" && data.checkout && data.order?.id) {
        setPassportCheckoutOrderId(data.order.id);
        router.push("/checkout");
        return;
      }

      toast({
        title: "Card order deferred",
        description: "The card fee will be added to your next ticket purchase.",
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">
              {hasPassport ? "Order another Entertain Passport card" : "Order an Entertain Passport card"}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Physical membership card, shipped by SL registered post.
          </p>
          <p className="mt-3 text-2xl font-bold tabular-nums">{formatCurrency(price / 100)}</p>
        </div>
        {latestOrder && (
          <Badge variant={STATUS_VARIANT[latestOrder.status] ?? "outline"}>
            {statusLabel(latestOrder.status)}
          </Badge>
        )}
      </div>

      <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">Delivery address</p>
            {shippingSummary ? (
              <p className="text-muted-foreground">{shippingSummary}</p>
            ) : (
              <p className="text-muted-foreground">
                Add your mobile number and address before ordering a card.
              </p>
            )}
          </div>
        </div>
      </div>

      {deferredTotal > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <Clock className="h-4 w-4" />
          {formatCurrency(deferredTotal / 100)} will be collected with your next ticket order.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="brand"
          disabled={!canShip || !!busy}
          onClick={() => order("PAY_NOW")}
          className="w-full sm:w-auto"
        >
          {busy === "PAY_NOW" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Pay now
        </Button>
        <Button
          variant="outline"
          disabled={!canShip || !!busy}
          onClick={() => order("DEFER_TO_NEXT_ORDER")}
          className="w-full sm:w-auto"
        >
          {busy === "DEFER_TO_NEXT_ORDER" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Add to next order
        </Button>
        {!canShip && (
          <Button variant="ghost" asChild>
            <Link href="/account/profile">Complete profile</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
