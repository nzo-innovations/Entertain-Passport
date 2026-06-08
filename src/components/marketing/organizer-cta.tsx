import Link from "next/link";
import { ArrowRight, BarChart3, Image as ImageIcon, ShieldCheck, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Tags, label: "Multi-tier pricing: GA, VIP, booths, bundles" },
  { icon: ImageIcon, label: "Rich galleries, partners, T&C, social" },
  { icon: BarChart3, label: "Real-time sales analytics & alerts" },
  { icon: ShieldCheck, label: "Built-in commission & weekly payouts" },
];

export function OrganizerCTA() {
  return (
    <section className="container">
      <div className="relative isolate overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-8 shadow-xl sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              For Promoters &amp; Venues
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
              Put your show on stage in minutes.{" "}
              <span className="gradient-text">Sell out faster.</span>
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Set up tiers, upload your gallery, configure seating, and watch sales come in live. We
              handle payments, tickets, and fan support so you can focus on the music.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="brand" size="lg" asChild>
                <Link href="/promoters">
                  Publish your show
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/organizer/login">Organizer sign in</Link>
              </Button>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-start gap-3 rounded-2xl border bg-background/60 p-4 backdrop-blur"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium leading-snug">{f.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
