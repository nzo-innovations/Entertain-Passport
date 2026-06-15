"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROTATING_TAGS = [
  "Concerts",
  "Festivals",
  "Club Nights",
  "Live Bands",
  "Acoustic",
  "Album Launches",
];

export function Hero({ heroImages }: { heroImages: string[] }) {
  const [tagIndex, setTagIndex] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTagIndex((i) => (i + 1) % ROTATING_TAGS.length), 2200);
    return () => clearInterval(t);
  }, []);

  const [imgIndex, setImgIndex] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setImgIndex((i) => (i + 1) % heroImages.length), 5000);
    return () => clearInterval(t);
  }, [heroImages.length]);

  return (
    <section className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        {heroImages.map((src, i) => (
          <motion.div
            key={src}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: i === imgIndex ? 1 : 0, scale: i === imgIndex ? 1 : 1.05 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          >
            <Image src={src} alt="" fill priority={i === 0} className="object-cover" sizes="100vw" />
          </motion.div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />
        <div className="absolute inset-0 gradient-radial opacity-60" />
      </div>

      <div className="container relative pb-24 pt-16 sm:pb-32 sm:pt-24 lg:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-5xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for music. 100% paperless tickets &amp; instant transfers.
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.25rem] xl:text-7xl">
            Where every beat{" "}
            <span className="block whitespace-nowrap">
              {"finds its\u00a0"}
              <span className="relative inline-block">
                <motion.span
                  key={ROTATING_TAGS[tagIndex]}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45 }}
                  className="gradient-text whitespace-nowrap"
                >
                  {ROTATING_TAGS[tagIndex].toLowerCase()}
                </motion.span>
              </span>
              .
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Discover the next wave of live music - concerts, festivals, club nights, tribute
            shows and more. Pick your seats, earn loyalty points, and get tickets in your wallet
            within seconds.
          </p>

          <form
            action="/events"
            className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border bg-background/70 p-2 backdrop-blur-xl sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search artists, festivals, venues..."
                className="h-12 border-0 bg-transparent pl-10 text-base focus-visible:ring-0"
              />
            </div>
            <Button type="submit" size="lg" variant="brand" className="h-12 px-6">
              Find tickets
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              120+ shows this month
            </span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" />
            <span>Trusted by 40+ promoters &amp; venues</span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" />
            <span>100% secure checkout</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
