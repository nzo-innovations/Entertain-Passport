import Link from "next/link";
import {
  Disc3,
  Mic2,
  Music,
  PartyPopper,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICONS: Record<string, LucideIcon> = {
  music: Music,
  "party-popper": PartyPopper,
  "disc-3": Disc3,
  "mic-2": Mic2,
  star: Star,
};

export type GenreMain = {
  name: string;
  slug: string;
  iconKey?: string | null;
  count: number;
  subs: { name: string; slug: string; count: number }[];
};

export function GenreCategoryTree({ mains }: { mains: GenreMain[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mains.map((main) => {
        const Icon = ICONS[main.iconKey ?? ""] ?? Music;
        return (
          <section
            key={main.slug}
            className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30"
          >
            <Link
              href={`/events?main=${main.slug}`}
              className="group flex items-start gap-3"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-brand text-white shadow-md shadow-primary/20">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold group-hover:text-primary">
                    {main.name}
                  </h2>
                  <Badge variant="secondary" className="tabular-nums">
                    {main.count}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Main category</p>
              </div>
            </Link>

            {main.subs.length > 0 ? (
              <ul className="mt-4 space-y-1 border-t pt-4">
                {main.subs.map((sub) => (
                  <li key={sub.slug}>
                    <Link
                      href={`/events?main=${main.slug}&sub=${sub.slug}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span>{sub.name}</span>
                      <span className="text-xs tabular-nums">{sub.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">
                Subcategories coming soon.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
