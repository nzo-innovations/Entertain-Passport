"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CategoryItem = { name: string; slug: string; count: number };

export function FilterBar({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const activeCategory = params.get("category") ?? "all";
  const search = params.get("q") ?? "";

  const update = React.useCallback(
    (k: string, v: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (v == null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
      router.replace(`/events${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [params, router]
  );

  const [localSearch, setLocalSearch] = React.useState(search);
  React.useEffect(() => setLocalSearch(search), [search]);
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) update("q", localSearch || null);
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events, artists, venues..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-12 pl-10 text-base"
          />
        </div>
        <button
          type="button"
          className="flex h-12 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      <div className="scroll-fade-x -mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          <CategoryPill
            label="All categories"
            count={categories.reduce((s, c) => s + c.count, 0)}
            active={activeCategory === "all"}
            onClick={() => update("category", null)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c.slug}
              label={c.name}
              count={c.count}
              active={activeCategory === c.slug}
              onClick={() => update("category", c.slug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent"
      )}
    >
      {label}
      <Badge
        variant={active ? "secondary" : "outline"}
        className={cn("h-5 min-w-[24px] justify-center px-1.5 text-[10px]", active && "bg-white/20 text-white")}
      >
        {count}
      </Badge>
    </button>
  );
}
