import Link from "next/link";
import {
  Album,
  Disc3,
  Guitar,
  Mic,
  Mic2,
  Music,
  PartyPopper,
  Star,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  music: Music,
  "party-popper": PartyPopper,
  "disc-3": Disc3,
  guitar: Guitar,
  "mic-2": Mic2,
  star: Star,
  album: Album,
  mic: Mic,
};

export type CategoryStripItem = {
  name: string;
  slug: string;
  iconKey?: string | null;
  count: number;
};

export function CategoryStrip({ items }: { items: CategoryStripItem[] }) {
  return (
    <section className="container">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Browse by category</h2>
          <p className="mt-1 text-sm text-muted-foreground">Find your kind of night.</p>
        </div>
        <Link
          href="/genres"
          className="text-sm font-medium text-primary hover:underline"
        >
          See all categories
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((c) => {
          const Icon = ICONS[c.iconKey ?? ""] ?? Music;
          return (
            <Link
              key={c.slug}
              href={`/events?category=${c.slug}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl gradient-brand text-white shadow-md shadow-primary/20 transition-transform group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.count} events</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
