"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Music2, Search, Ticket, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlacesFilterMeta } from "@/lib/venues";

type Props = {
  meta: PlacesFilterMeta;
  resultCount: number;
};

export function PlacesFilterBar({ meta, resultCount }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const kind = params.get("kind") ?? "";
  const city = params.get("city") ?? "";
  const district = params.get("district") ?? "";
  const live = params.get("live") === "1";
  const tickets = params.get("tickets") === "1";
  const sort = params.get("sort") ?? "name";

  const [localSearch, setLocalSearch] = React.useState(q);
  React.useEffect(() => setLocalSearch(q), [q]);

  const update = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if ("city" in updates && updates.city !== city) next.delete("district");
      router.replace(`/venues${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [params, router, city]
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== q) update({ q: localSearch || null });
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, q, update]);

  const hasFilters = !!(q || kind || city || district || live || tickets || sort !== "name");

  const activeCityDistricts = city
    ? meta.districts.filter((d) => d.count > 0)
    : meta.districts;

  return (
    <div className="space-y-4 rounded-2xl border bg-card/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, city or area…"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-11 pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
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
          <SelectField
            label="Sort"
            value={sort}
            onChange={(v) => update({ sort: v === "name" ? null : v })}
            options={[
              { value: "name", label: "A → Z" },
              { value: "programs", label: "Most live nights" },
              { value: "events", label: "Most ticketed shows" },
            ]}
          />
        </div>
      </div>

      <div className="scroll-fade-x -mx-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex w-max flex-wrap gap-2 sm:w-auto">
          <KindPill
            label="All types"
            count={meta.total}
            active={!kind}
            onClick={() => update({ kind: null })}
          />
          {meta.kinds.map((k) => (
            <KindPill
              key={k.value}
              label={k.label}
              count={k.count}
              active={kind === k.value}
              onClick={() => update({ kind: kind === k.value ? null : k.value })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TogglePill
          icon={Music2}
          label="Live music & nights"
          active={live}
          onClick={() => update({ live: live ? null : "1" })}
        />
        <TogglePill
          icon={Ticket}
          label="Ticketed shows"
          active={tickets}
          onClick={() => update({ tickets: tickets ? null : "1" })}
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
        {resultCount === 0
          ? "No published places match your filters."
          : `Showing ${resultCount} published ${resultCount === 1 ? "place" : "places"}`}
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
    <label className="relative min-w-[140px] flex-1 sm:flex-none">
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
