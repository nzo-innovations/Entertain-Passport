"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart-store";
import { resolveCheckoutDestination } from "@/lib/checkout-gate";
import type { TicketHolderInput } from "@/lib/checkout-holders";
import {
  buildTicketSlots,
  TicketHoldersForm,
} from "@/components/checkout/ticket-holders-form";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { formatEventDate } from "@/lib/format";
import {
  formatCardNumber,
  formatExpiry,
  luhnValid,
  expiryValid,
  cvcValid,
  detectBrand,
} from "@/lib/card";

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const seatedLines = useCart((s) => s.seatedLines);
  const passportCheckoutOrderId = useCart((s) => s.passportCheckoutOrderId);
  const totals = useCart((s) => s.totals);
  const clear = useCart((s) => s.clear);
  const { toast } = useToast();
  const [passportOrderTotal, setPassportOrderTotal] = React.useState(0);
  const t = totals(passportOrderTotal);
  const [submitting, setSubmitting] = React.useState(false);
  const [deferredCardTotal, setDeferredCardTotal] = React.useState(0);
  const [gateReady, setGateReady] = React.useState(false);
  const [contact, setContact] = React.useState({
    name: "",
    email: "",
    phone: "",
    country: "Sri Lanka",
  });
  const [buyerName, setBuyerName] = React.useState("You");
  const [ticketHolders, setTicketHolders] = React.useState<TicketHolderInput[]>([]);
  const [holdersAssigned, setHoldersAssigned] = React.useState(true);

  const ticketSlots = React.useMemo(() => buildTicketSlots(lines, seatedLines), [lines, seatedLines]);

  const [card, setCard] = React.useState("");
  const [exp, setExp] = React.useState("");
  const [cvc, setCvc] = React.useState("");
  const [touched, setTouched] = React.useState<{ card?: boolean; exp?: boolean; cvc?: boolean }>({});

  const brand = detectBrand(card);
  const cardError = !luhnValid(card) ? "Enter a valid card number." : "";
  const expError = !expiryValid(exp) ? "Enter a valid future expiry (MM/YY)." : "";
  const cvcError = !cvcValid(cvc, brand)
    ? `Enter a valid ${brand === "amex" ? "4" : "3"}-digit security code.`
    : "";
  const cardValid = !cardError && !expError && !cvcError;
  const hasTickets = lines.length > 0 || seatedLines.length > 0;
  const hasPassportCheckout = Boolean(passportCheckoutOrderId);
  const extraDeferred = hasPassportCheckout ? 0 : deferredCardTotal;
  const grandTotal = t.total + extraDeferred;
  const needsHolders = ticketSlots.length > 0;

  React.useEffect(() => {
    let cancelled = false;
    resolveCheckoutDestination().then((gate) => {
      if (cancelled) return;
      if (!gate.ok) {
        router.replace(gate.href);
        return;
      }
      setGateReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        setContact({
          name: data.user.displayName ?? "",
          email: data.user.email ?? "",
          phone: data.user.phone ?? "",
          country: data.user.country ?? "Sri Lanka",
        });
        setBuyerName(data.user.displayName ?? "You");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleHoldersChange = React.useCallback(
    (holders: TicketHolderInput[], allAssigned: boolean) => {
      setTicketHolders(holders);
      setHoldersAssigned(allAssigned);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!passportCheckoutOrderId) {
      setPassportOrderTotal(0);
      return;
    }
    fetch("/api/account/passport-cards", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const order =
          data?.orders?.find((o: { id: string }) => o.id === passportCheckoutOrderId) ??
          data?.pendingCheckout;
        setPassportOrderTotal(order?.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setPassportOrderTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [passportCheckoutOrderId]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/account/passport-cards", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.deferredTotal) setDeferredCardTotal(data.deferredTotal);
        else if (!cancelled) setDeferredCardTotal(0);
      })
      .catch(() => {
        if (!cancelled) setDeferredCardTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasTickets && !hasPassportCheckout)
    return (
      <div className="container py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Browse events or order your Entertain Passport card.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="brand" asChild>
            <Link href="/events">Discover events</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/passport">Order Entertain Passport</Link>
          </Button>
        </div>
      </div>
    );

  if (!gateReady) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Preparing checkout…</p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsHolders && !holdersAssigned) {
      toast({
        title: "Assign every ticket",
        description: "Each ticket needs a holder before you can pay.",
        variant: "destructive",
      });
      return;
    }
    if (!cardValid) {
      setTouched({ card: true, exp: true, cvc: true });
      toast({
        title: "Check your card details",
        description: cardError || expError || cvcError,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ packageId: l.packageId, qty: l.qty })),
          seatedItems: seatedLines.map((l) => ({
            eventId: l.eventId,
            seatExternalIds: l.seatExternalIds,
          })),
          ticketHolders: needsHolders ? ticketHolders : undefined,
          passportCardOrderIds: passportCheckoutOrderId ? [passportCheckoutOrderId] : undefined,
        }),
      });

      if (res.status === 401) {
        toast({
          title: "Please sign in",
          description: "Sign in to complete your purchase.",
        });
        router.push("/login?next=/checkout");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Checkout failed",
          description: data?.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      toast({
        title: "Payment confirmed",
        description: hasPassportCheckout && !hasTickets
          ? "Your Entertain Passport card order is confirmed."
          : "Your tickets are ready in your wallet.",
      });
      clear();
      router.push(
        hasPassportCheckout && !hasTickets ? "/account/passport?ok=1" : "/account/tickets?ok=1"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-6xl py-12">
      <h1 className="font-display text-3xl font-bold">
        {hasPassportCheckout && !hasTickets ? "Checkout - Entertain Passport card" : "Checkout"}
      </h1>
      <p className="text-sm text-muted-foreground">
        We hold your seats for 10 minutes while you complete your purchase.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={onSubmit} className="space-y-6">
          <Section title="1. Contact info">
            <div className="grid gap-4 sm:grid-cols-2">
              <ControlledField
                label="Full name"
                value={contact.name}
                onChange={(v) => setContact((c) => ({ ...c, name: v }))}
                required
              />
              <ControlledField
                label="Email"
                type="email"
                value={contact.email}
                onChange={(v) => setContact((c) => ({ ...c, email: v }))}
                required
              />
              <ControlledField
                label="Mobile"
                value={contact.phone}
                onChange={(v) => setContact((c) => ({ ...c, phone: v }))}
                placeholder="+94 77 123 4567"
                required
              />
              <ControlledField
                label="Country"
                value={contact.country}
                onChange={(v) => setContact((c) => ({ ...c, country: v }))}
                required
              />
            </div>
          </Section>

          {needsHolders && (
            <Section title={`2. Ticket holders (${ticketSlots.length})`}>
              <p className="mb-4 text-sm text-muted-foreground">
                Ticket 1 is yours by default. For extra tickets, search a friend by Entertain
                Passport number or add their NIC / passport ID manually.
              </p>
              <TicketHoldersForm
                slots={ticketSlots}
                buyerName={buyerName}
                onChange={handleHoldersChange}
              />
            </Section>
          )}

          <Section title={`${needsHolders ? "3" : "2"}. Payment`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <PaymentMethod active label="Card" hint="Visa · Mastercard · Amex" icon={CreditCard} />
              <PaymentMethod label="KOKO" hint="Pay later - coming soon" icon={Wallet} comingSoon />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm sm:col-span-2">
                <span className="font-medium">
                  Card number
                  {brand !== "unknown" && (
                    <span className="ml-2 text-xs uppercase text-muted-foreground">{brand}</span>
                  )}
                </span>
                <Input
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 1234 1234 1234"
                  value={card}
                  onChange={(e) => setCard(formatCardNumber(e.target.value))}
                  onBlur={() => setTouched((s) => ({ ...s, card: true }))}
                  aria-invalid={touched.card && !!cardError}
                  className={touched.card && cardError ? "border-destructive" : ""}
                />
                {touched.card && cardError && (
                  <span className="text-xs text-destructive">{cardError}</span>
                )}
              </label>
              <Field label="Cardholder name" name="cardname" placeholder="Jane Doe" required autoComplete="cc-name" />
              <div className="grid grid-cols-2 gap-4 sm:col-span-1">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Expiry</span>
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    value={exp}
                    onChange={(e) => setExp(formatExpiry(e.target.value))}
                    onBlur={() => setTouched((s) => ({ ...s, exp: true }))}
                    aria-invalid={touched.exp && !!expError}
                    className={touched.exp && expError ? "border-destructive" : ""}
                  />
                  {touched.exp && expError && (
                    <span className="text-xs text-destructive">{expError}</span>
                  )}
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">CVC</span>
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder={brand === "amex" ? "1234" : "123"}
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onBlur={() => setTouched((s) => ({ ...s, cvc: true }))}
                    aria-invalid={touched.cvc && !!cvcError}
                    className={touched.cvc && cvcError ? "border-destructive" : ""}
                  />
                  {touched.cvc && cvcError && (
                    <span className="text-xs text-destructive">{cvcError}</span>
                  )}
                </label>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Securely processed by WebXPay. We never store your card details on our servers.
            </div>
          </Section>

          <Section title={`${needsHolders ? "4" : "3"}. Review & confirm`}>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <span>
                {hasPassportCheckout && !hasTickets
                  ? "Pay securely with Visa, Mastercard or Amex via WebXPay. Your card will ship by SL registered post after payment."
                  : "Entertain Passport members earn loyalty rewards on ticket purchases. Assign holders above so each guest can enter with their card or ID."}
              </span>
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" required className="mt-0.5" />
              <span>
                I agree to the event&apos;s terms and conditions and the Entertain Passport purchase policy.
              </span>
            </label>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="mt-4 w-full"
              disabled={submitting || !cardValid || (needsHolders && !holdersAssigned)}
            >
              {submitting
                ? "Processing..."
                : hasPassportCheckout && !hasTickets
                  ? `Pay ${formatCurrency(grandTotal / 100)}`
                  : `Buy tickets - ${formatCurrency(grandTotal / 100)}`}
            </Button>
          </Section>
        </form>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-5 py-4">
              <h3 className="font-display text-lg font-semibold">Order summary</h3>
            </div>
            <ul className="divide-y">
              {hasPassportCheckout && passportOrderTotal > 0 && (
                <li className="flex gap-3 p-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Entertain Passport card</p>
                    <p className="text-xs text-muted-foreground">Physical membership card · SL registered post</p>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">x 1</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(passportOrderTotal / 100)}
                      </span>
                    </div>
                  </div>
                </li>
              )}
              {lines.map((l) => (
                <li key={l.packageId} className="flex gap-3 p-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                    <Image src={l.eventImage} alt={l.eventTitle} fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{l.eventTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.packageName} · {formatEventDate(l.eventDate)}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">x {l.qty}</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency((l.unitPrice * l.qty) / 100)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t px-5 py-4 text-sm">
              {t.subtotal > 0 && <Row label="Tickets subtotal" value={formatCurrency(t.subtotal / 100)} />}
              {t.passportCard > 0 && (
                <Row label="Entertain Passport card" value={formatCurrency(t.passportCard / 100)} />
              )}
              <Row label="Service fee" value={formatCurrency(t.fees / 100)} />
              {extraDeferred > 0 && (
                <Row label="Deferred Passport card" value={formatCurrency(extraDeferred / 100)} />
              )}
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(grandTotal / 100)}</span>
              </div>
              {t.loyaltyEarned > 0 && (
                <p className="flex items-center gap-1.5 pt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  You&apos;ll earn {t.loyaltyEarned} loyalty points on this order.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border bg-card/50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">100% buyer protection</p>
              <p className="mt-0.5">Full refund if your event is cancelled. Tickets verified by issuer.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ControlledField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        readOnly={label === "Email"}
        className={label === "Email" ? "bg-muted/40" : undefined}
      />
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function PaymentMethod({
  label,
  hint,
  icon: Icon,
  active,
  comingSoon,
}: {
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={comingSoon}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
        active
          ? "border-primary bg-accent text-foreground"
          : comingSoon
          ? "cursor-not-allowed opacity-60"
          : "hover:border-primary/40"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">
        <span className="flex items-center gap-1.5">
          {label}
          {active && <Badge variant="brand" className="h-4 text-[10px]">Selected</Badge>}
          {comingSoon && <Badge variant="outline" className="h-4 text-[10px]">Soon</Badge>}
        </span>
        {hint && <span className="block text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}
