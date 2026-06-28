"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Music2, Newspaper, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlacesCategoryTreeItem, PlacesFilterMeta } from "@/lib/venues";
import { PlacesViewToggle } from "@/components/venues/places-view-toggle";

type TagItem = { name: string; slug: string };

type Props = {
  meta: PlacesFilterMeta;
  categoryTree: PlacesCategoryTreeItem[];
  categoryTags: Record<string, TagItem[]>;
  resultCount: number;
  agendaCount?: number;
  view?: "grid" | "agenda";
};

export function PlacesFilterBar({
  meta,
  categoryTree,
  categoryTags,
  resultCount,
  agendaCount,
  view = "grid",
}: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const kind = params.get("kind") ?? "";
  const main = params.get("main") ?? "";
  const sub = params.get("sub") ?? "";
  const tagsParam = params.get("tags") ?? "";
  const activeTags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const city = params.get("city") ?? "";
  const district = params.get("district") ?? "";
  const live = params.get("live") === "1";
  const updates = params.get("updates") === "1";
  const sort = params.get("sort") ?? "name";

  const selectedMain = categoryTree.find((m) => m.slug === main);
  const tagCountMap = new Map(meta.tags.map((t) => [t.slug, t.count]));

  const [localSearch, setLocalSearch] = React.useState(q);
  React.useEffect(() => setLocalSearch(q), [q]);

  const update = React.useCallback(
    (updatesMap: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updatesMap)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if ("city" in updatesMap && updatesMap.city !== city) next.delete("district");
      if ("main" in updatesMap && updatesMap.main !== main) next.delete("sub");
      router.replace(`/venues${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [params, router, city, main]
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== q) update({ q: localSearch || null });
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, q, update]);

  const hasFilters = !!(
    q ||
    kind ||
    main ||
    sub ||
    tagsParam ||
    city ||
    district ||
    live ||
    updates ||
    sort !== "name"
  );

  const toggleTag = (slug: string) => {
    const next = new Set(activeTags);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    update({ tags: next.size ? [...next].join(",") : null });
  };

  const activeCityDistricts = city ? meta.districts.filter((d) => d.count > 0) : meta.districts;
  const visibleKinds = meta.kinds.filter((k) => k.count > 0 || kind === k.value);

  const visibleTags = main
    ? (categoryTags[main] ?? []).map((t) => ({
        ...t,
        count: tagCountMap.get(t.slug) ?? 0,
      }))
    : meta.tags.filter((t) => t.count > 0 || activeTags.includes(t.slug));

  const totalPlaces =
    categoryTree.reduce((sum, c) => sum + c.count, 0) || meta.total;

  return (
    <div className="space-y-4 rounded-2xl border bg-card/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, city or area…"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-11 pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            label="City"
            icon={MapPin}
            value={city}
            onChange={(v) => update({ city: v || null })}
            options={[
              { value: "", label: "All cities" },
              ...meta.cities.map((c) => ({
                value: c.city,
                label: `${c.city} (${c.count})`,
              })),
            ]}
          />
          {city && activeCityDistricts.length > 0 && (
            <SelectField
              label="Area"
              value={district}
              onChange={(v) => update({ district: v || null })}
              options={[
                { value: "", label: "All areas" },
                ...activeCityDistricts.map((d) => ({
                  value: d.district,
                  label: `${d.district} (${d.count})`,
                })),
              ]}
            />
          )}
          {view === "grid" && (
            <SelectField
              label="Sort"
              value={sort}
              onChange={(v) => update({ sort: v === "name" ? null : v })}
              options={[
                { value: "name", label: "A → Z" },
                { value: "programs", label: "Most live nights" },
                { value: "posts", label: "Most updates" },
              ]}
            />
          )}
          <PlacesViewToggle />
        </div>
      </div>

      <div className="scroll-fade-x -mx-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex w-max flex-wrap gap-2 sm:w-auto">
          <KindPill
            label="All categories"
            count={totalPlaces}
            active={!main}
            onClick={() => update({ main: null, sub: null, tags: null })}
          />
          {categoryTree.map((m) => (
            <KindPill
              key={m.slug}
              label={m.name}
              count={m.count}
              active={main === m.slug}
              onClick={() =>
                update({
                  main: main === m.slug ? null : m.slug,
                  sub: null,
                  tags: null,
                })
              }
            />
          ))}
        </div>
      </div>

      {selectedMain && selectedMain.subs.length > 0 && (
        <div className="scroll-fade-x -mx-1 overflow-x-auto px-1 pb-0.5">
          <div className="flex w-max flex-wrap gap-2 sm:w-auto">
            <SubPill
              label={`All ${selectedMain.name}`}
              active={!sub}
              onClick={() => update({ sub: null })}
            />
            {selectedMain.subs.map((s) => (
              <SubPill
                key={s.slug}
                label={s.name}
                count={s.count}
                active={sub === s.slug}
                onClick={() =>
                  update({
                    main: selectedMain.slug,
                    sub: sub === s.slug ? null : s.slug,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {visibleTags.length > 0 && (
        <div className="scroll-fade-x -mx-1 overflow-x-auto px-1 pb-0.5">
          <div className="flex w-max flex-wrap gap-2 sm:w-auto">
            {visibleTags.map((t) => (
              <TogglePill
                key={t.slug}
                icon={Music2}
                label={t.count > 0 ? `${t.name} (${t.count})` : t.name}
                active={activeTags.includes(t.slug)}
                onClick={() => toggleTag(t.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {!main && (
        <p className="text-xs text-muted-foreground sm:text-sm">
          Select a category to filter by subcategory or tags.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {visibleKinds.length > 1 && (
          <>
            <KindPill
              label="All types"
              count={meta.total}
              active={!kind}
              onClick={() => update({ kind: null })}
            />
            {visibleKinds.map((k) => (
              <KindPill
                key={k.value}
                label={k.label}
                count={k.count}
                active={kind === k.value}
                onClick={() => update({ kind: kind === k.value ? null : k.value })}
              />
            ))}
          </>
        )}
        <TogglePill
          icon={Music2}
          label="Live nights"
          active={live}
          onClick={() => update({ live: live ? null : "1" })}
        />
        <TogglePill
          icon={Newspaper}
          label="News & updates"
          active={updates}
          onClick={() => update({ updates: updates ? null : "1" })}
        />
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => router.replace("/venues", { scroll: false })}
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {view === "agenda" ? (
          resultCount === 0 ? (
            "No published places match your filters."
          ) : agendaCount != null && agendaCount > 0 ? (
            <>
              {agendaCount} {agendaCount === 1 ? "item" : "items"} this week from {resultCount}{" "}
              {resultCount === 1 ? "place" : "places"}
            </>
          ) : (
            <>
              No listings this week from {resultCount} matching {resultCount === 1 ? "place" : "places"}
            </>
          )
        ) : resultCount === 0 ? (
          "No published places match your filters."
        ) : (
          `Showing ${resultCount} published ${resultCount === 1 ? "place" : "places"}`
        )}
        {city ? ` in ${city}` : ""}
        {district ? ` · ${district}` : ""}
      </p>
    </div>
  );
}

function SelectField({
  label,
  icon: Icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative min-w-[132px] flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border bg-background py-2 pr-8 text-sm",
          Icon ? "pl-9" : "pl-3"
        )}
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KindPill({
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
        "flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
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
      {count != null && (
        <span className="text-[10px] tabular-nums opacity-70">{count}</span>
      )}
    </button>
  );
}

function TogglePill({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
