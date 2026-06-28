"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ShowsMainFilter = {
  name: string;
  slug: string;
  count: number;
  subs: { name: string; slug: string; count: number }[];
};

export type TagItem = { name: string; slug: string };

export function FilterBar({
  categoryTree,
  categoryTags,
}: {
  categoryTree: ShowsMainFilter[];
  categoryTags: Record<string, TagItem[]>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const activeMain = params.get("main") ?? params.get("category") ?? "";
  const activeSub = params.get("sub") ?? "";
  const tagsParam = params.get("tags") ?? "";
  const activeTags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const search = params.get("q") ?? "";

  const [tagsOpen, setTagsOpen] = React.useState(activeTags.length > 0);
  const [localSearch, setLocalSearch] = React.useState(search);

  const selectedMain = categoryTree.find((m) => m.slug === activeMain);
  const visibleTags = activeMain ? categoryTags[activeMain] ?? [] : [];

  React.useEffect(() => setLocalSearch(search), [search]);
  React.useEffect(() => {
    if (activeTags.length > 0) setTagsOpen(true);
  }, [activeTags.length]);

  React.useEffect(() => {
    if (!activeMain) setTagsOpen(false);
  }, [activeMain]);

  const update = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`/events${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [params, router]
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) update({ q: localSearch || null });
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const toggleTag = (slug: string) => {
    const next = new Set(activeTags);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    update({ tags: next.size ? [...next].join(",") : null });
  };

  const clearAll = () => {
    setTagsOpen(false);
    router.replace("/events", { scroll: false });
  };

  const hasFilters = !!(search || activeMain || activeSub || activeTags.length);

  return (
    <div className="space-y-3 rounded-2xl border bg-card/50 p-3 sm:space-y-4 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events, artists, venues..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-11 pl-10 sm:h-12"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-accent sm:h-12 sm:flex-none sm:px-4"
            aria-label="More filters (coming soon)"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Filters</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!activeMain) return;
              setTagsOpen((o) => !o);
            }}
            disabled={!activeMain}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:h-12 sm:flex-none sm:px-4",
              !activeMain && "cursor-not-allowed opacity-50",
              tagsOpen && activeMain
                ? "border-primary bg-primary/10 text-primary"
                : "bg-background hover:bg-accent"
            )}
            aria-expanded={tagsOpen}
            aria-label="Toggle tags"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Tags</span>
            {activeTags.length > 0 && (
              <Badge variant="brand" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                {activeTags.length}
              </Badge>
            )}
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="flex h-11 w-11 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:bg-accent hover:text-foreground sm:h-12"
              aria-label="Clear all filters"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Row 1 - main categories only */}
      <div className="scroll-fade-x -mx-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <CategoryPill
            label="All"
            count={categoryTree.reduce((s, c) => s + c.count, 0)}
            active={!activeMain}
            onClick={() => {
              setTagsOpen(false);
              update({ main: null, category: null, sub: null, tags: null });
            }}
          />
          {categoryTree.map((c) => (
            <CategoryPill
              key={c.slug}
              label={c.name}
              count={c.count}
              active={activeMain === c.slug}
              onClick={() => {
                if (activeMain === c.slug) {
                  setTagsOpen(false);
                  update({ main: null, category: null, sub: null, tags: null });
                } else {
                  setTagsOpen(false);
                  update({ main: c.slug, category: null, sub: null, tags: null });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Row 2 - subcategories for selected main */}
      {selectedMain && selectedMain.subs.length > 0 && (
        <div className="scroll-fade-x -mx-1 overflow-x-auto px-1 pb-0.5">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            <SubPill
              label={`All ${selectedMain.name}`}
              active={!activeSub}
              onClick={() => update({ sub: null, tags: activeTags.length ? tagsParam : null })}
            />
            {selectedMain.subs.map((sub) => (
              <SubPill
                key={sub.slug}
                label={sub.name}
                count={sub.count}
                active={activeSub === sub.slug}
                onClick={() =>
                  update({
                    main: selectedMain.slug,
                    sub: activeSub === sub.slug ? null : sub.slug,
                    tags: activeTags.length ? tagsParam : null,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Tags panel - only when Tags button opened and a main category is selected */}
      {tagsOpen && activeMain && (
        <div className="rounded-xl border bg-muted/30 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tags · {selectedMain?.name}
            </p>
            {activeTags.length > 0 && (
              <button
                type="button"
                onClick={() => update({ tags: null })}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear tags
              </button>
            )}
          </div>
          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleTags.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => toggleTag(t.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                    activeTags.includes(t.slug)
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags configured for this category yet.</p>
          )}
        </div>
      )}

      {!activeMain && (
        <p className="text-xs text-muted-foreground sm:text-sm">
          Select a main category to filter by subcategory or tags.
        </p>
      )}
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
        "flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all sm:px-4",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "border-border bg-background hover:border-primary/40 hover:bg-accent"
      )}
    >
      {label}
      <Badge
        variant={active ? "secondary" : "outline"}
        className={cn("h-5 min-w-[22px] justify-center px-1.5 text-[10px]", active && "bg-white/20 text-white")}
      >
        {count}
      </Badge>
    </button>
  );
}

function SubPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {label}
      {count != null && count > 0 && (
        <span className="text-[10px] tabular-nums opacity-70">{count}</span>
      )}
    </button>
  );
}
