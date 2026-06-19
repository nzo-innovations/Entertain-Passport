import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLACES_LABEL, ROUTES, SUPPORT_CONTACTS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact & Support",
  description: "Contact Entertain Passport support by phone or WhatsApp.",
};

export default function ContactPage() {
  return (
    <div className="container max-w-2xl py-12 sm:py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Contact &amp; support</h1>
        <p className="text-muted-foreground">
          Need help with organizer registration, {PLACES_LABEL}, or a category that is not listed? Reach our team
          on WhatsApp or phone.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {SUPPORT_CONTACTS.map((c) => (
          <section key={c.tel} className="rounded-2xl border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">{c.label}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <a href={`tel:${c.tel}`} className="font-medium text-foreground hover:underline">
                {c.display}
              </a>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="brand" size="sm" asChild>
                <a href={c.whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${c.tel}`}>Call</a>
              </Button>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Organizers signing up as Company / Venue Owner can use this page if their Places to Go category is not
        listed during registration.{" "}
        <Link href={ROUTES.organizerLogin} className="font-medium text-primary hover:underline">
          Back to organizer signup
        </Link>
      </p>
    </div>
  );
}
