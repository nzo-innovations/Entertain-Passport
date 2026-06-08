import { Sparkles, ShieldCheck, Smartphone, Repeat2 } from "lucide-react";

const ITEMS = [
  {
    icon: Sparkles,
    title: "Earn loyalty on every show",
    body: "Stack points on every gig and redeem them on the next one.",
  },
  {
    icon: ShieldCheck,
    title: "100% secure checkout",
    body: "PCI-compliant payments with Visa, Mastercard, and major wallets.",
  },
  {
    icon: Smartphone,
    title: "Tickets in your wallet, instantly",
    body: "Add to Apple/Google Wallet. No printing. No queues. No paper.",
  },
  {
    icon: Repeat2,
    title: "Effortless transfers",
    body: "Can\u2019t make it? Send your ticket to a friend in two taps.",
  },
];

export function ValueProps() {
  return (
    <section className="container">
      <div className="grid gap-3 rounded-3xl border bg-card/60 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-8">
        {ITEMS.map((it) => (
          <div key={it.title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{it.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
