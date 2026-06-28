"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, MapPin, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VenuePostData = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  detailLink?: string | null;
  publishedAt: Date | string;
  venueName?: string;
  venueSlug?: string;
  city?: string;
};

type Props = {
  post: VenuePostData;
  variant?: "card" | "agenda";
  className?: string;
};

export function VenuePostItem({ post, variant = "card", className }: Props) {
  const [open, setOpen] = React.useState(false);

  const published = new Date(post.publishedAt);
  const dateLabel = Number.isNaN(published.getTime())
    ? ""
    : published.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <article
      className={cn(
        "rounded-xl border bg-card transition-colors",
        open && "border-primary/30",
        variant === "agenda" ? "px-3 py-3 sm:px-4" : "p-4 sm:p-5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left sm:gap-4"
      >
        {post.imageUrl && (
          <div className="relative hidden h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg sm:block">
            <Image src={post.imageUrl} alt="" fill sizes="72px" className="object-cover" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-snug">{post.title}</h3>
            <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium">
              <Newspaper className="mr-1 h-3 w-3" />
              Update
            </Badge>
          </div>

          {variant === "agenda" && (post.venueName || dateLabel) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {post.venueName && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {post.venueName}
                </span>
              )}
              {post.venueName && dateLabel ? " · " : ""}
              {dateLabel}
              {post.city ? ` · ${post.city}` : ""}
            </p>
          )}

          {!open && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {post.imageUrl && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg sm:hidden">
              <Image src={post.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{post.body}</p>
          <div className="flex flex-wrap gap-2">
            {post.detailLink && (
              <Button variant="brand" size="sm" asChild>
                <a href={post.detailLink} target="_blank" rel="noopener noreferrer">
                  More details
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {post.venueSlug && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/venues/${post.venueSlug}`}>View place</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
