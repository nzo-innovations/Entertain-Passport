"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = React.useState(0);
  const safeImages = images.length > 0 ? images : [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80",
  ];

  const go = (delta: number) => {
    setActive((i) => (i + delta + safeImages.length) % safeImages.length);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
        {safeImages.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${alt} - ${i + 1}`}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            priority={i === 0}
            className={cn(
              "object-cover transition-opacity duration-500",
              i === active ? "opacity-100" : "opacity-0"
            )}
          />
        ))}

        {safeImages.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {safeImages.map((_, i) => (
                <button
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === active ? "w-6 bg-white" : "w-1.5 bg-white/60"
                  )}
                  onClick={() => setActive(i)}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {safeImages.length > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {safeImages.slice(0, 6).map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition-all",
                i === active
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <Image src={src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
