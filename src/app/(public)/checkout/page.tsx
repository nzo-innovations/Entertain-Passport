"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, Nfc, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart-store";
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
  const totals = useCart((s) => s.totals);
  const clear = useCart((s) => s.clear);
  const { toast } = useToast();
  const t = totals();
  const [submitting, setSubmitting] = React.useState(false);

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

  if (lines.length === 0)
    return (
      <div className="container py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Browse events to add tickets first.</p>
        <Button className="mt-6" variant="brand" asChild>
          <Link href="/events">Discover events</Link>
        </Button>
      </div>
    );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        description: "Your tickets are ready with scannable barcodes.",
      });
      clear();
      router.push("/account/tickets?ok=1");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-6xl py-12">
      <h1 className="font-display text-3xl font-bold">Checkout</h1>
      <p className="text-sm text-muted-foreground">
        We hold your seats for 10 minutes while you complete your purchase.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={onSubmit} className="space-y-6">
          <Section title="1. Contact info">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="name" placeholder="Jane Doe" required />
              <Field label="Email" name="email" type="email" placeholder="jane@email.com" required />
              <Field label="Mobile" name="phone" placeholder="+94 77 123 4567" required />
              <Field label="Country" name="country" defaultValue="Sri Lanka" required />
            </div>
          </Section>

          <Section title="2. Payment">
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

          <Section title="3. Review &amp; confirm">
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Nfc className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <span>
                Entertain Passport holders earn loyalty rewards on this purchase and can tap their
                card at the gate. No passport? You can still buy - rewards apply to passport holders only.
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
              disabled={submitting || !cardValid}
            >
              {submitting ? "Processing..." : `Buy tickets · ${formatCurrency(t.total / 100)}`}
            </Button>
          </Section>
        </form>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-5 py-4">
              <h3 className="font-display text-lg font-semibold">Order summary</h3>
            </div>
            <ul className="divide-y">
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
              <Row label="Subtotal" value={formatCurrency(t.subtotal / 100)} />
              <Row label="Service fee" value={formatCurrency(t.fees / 100)} />
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(t.total / 100)}</span>
              </div>
              <p className="flex items-center gap-1.5 pt-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                You&apos;ll earn {t.loyaltyEarned} loyalty points after this order ships.
              </p>
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
