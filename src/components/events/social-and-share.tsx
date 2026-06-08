"use client";

import * as React from "react";
import {
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Share2,
  Twitter,
  type LucideIcon,
} from "lucide-react";

export function SocialAndShare({
  social,
  title,
}: {
  social: Record<string, string>;
  title: string;
}) {
  const items: { icon: LucideIcon; href: string; label: string }[] = [];
  if (social.instagram)
    items.push({
      icon: Instagram,
      href: `https://instagram.com/${social.instagram.replace("@", "")}`,
      label: "Instagram",
    });
  if (social.twitter)
    items.push({
      icon: Twitter,
      href: `https://twitter.com/${social.twitter.replace("@", "")}`,
      label: "Twitter",
    });
  if (social.facebook) items.push({ icon: Facebook, href: social.facebook, label: "Facebook" });
  if (social.website) items.push({ icon: Globe, href: social.website, label: "Website" });

  const onShare = () => {
    if (typeof navigator !== "undefined" && navigator.share)
      navigator.share({ title, url: window.location.href }).catch(() => {});
  };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Follow &amp; share</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <a
            key={it.label}
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:bg-accent"
          >
            <it.icon className="h-4 w-4" />
            {it.label}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        ))}
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:bg-accent"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </section>
  );
}
