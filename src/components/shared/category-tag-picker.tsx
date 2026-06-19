"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CatalogPick = {
  mainCategoryId: string;
  subCategoryId: string | null;
  tagIds: string[];
};

type Main = { id: string; name: string; slug: string };
type Sub = { id: string; name: string; slug: string };
type TagRow = { id: string; name: string; slug: string };

export function CategoryTagPicker({
  module,
  mains,
  tags,
  value,
  onChange,
  mainLabel = "Main category",
  subLabel = "Subcategory",
  tagsLabel = "Tags (optional)",
  subRequired = true,
  supportHref = "/contact",
  supportMessage = "If your category is not listed, please contact the Entertain Passport support team.",
  className,
}: {
  module: "SHOWS" | "PLACES";
  mains: Main[];
  tags: TagRow[];
  value: CatalogPick;
  onChange: (v: CatalogPick) => void;
  mainLabel?: string;
  subLabel?: string;
  tagsLabel?: string;
  subRequired?: boolean;
  supportHref?: string;
  supportMessage?: string;
  className?: string;
}) {
  const [subs, setSubs] = React.useState<Sub[]>([]);
  const [loadingSubs, setLoadingSubs] = React.useState(false);

  React.useEffect(() => {
    if (!value.mainCategoryId) {
      setSubs([]);
      return;
    }
    let cancelled = false;
    setLoadingSubs(true);
    fetch(`/api/catalog/subcategories?mainId=${encodeURIComponent(value.mainCategoryId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSubs(data.subcategories ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingSubs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value.mainCategoryId]);

  const hasSubs = subs.length > 0;
  const subMissing = subRequired && hasSubs && !value.subCategoryId;

  const toggleTag = (id: string) => {
    const set = new Set(value.tagIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, tagIds: [...set] });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{mainLabel}</span>
        <select
          required
          value={value.mainCategoryId}
          onChange={(e) =>
            onChange({ mainCategoryId: e.target.value, subCategoryId: null, tagIds: value.tagIds })
          }
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {mains.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {value.mainCategoryId && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">
            {subLabel}
            {!hasSubs && !loadingSubs ? " (optional — none yet for this main category)" : ""}
          </span>
          {loadingSubs ? (
            <p className="text-xs text-muted-foreground">Loading subcategories…</p>
          ) : hasSubs ? (
            <select
              required={subRequired}
              value={value.subCategoryId ?? ""}
              onChange={(e) =>
                onChange({ ...value, subCategoryId: e.target.value || null })
              }
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
        </label>
      )}

      {supportMessage && (
        <p className="text-xs text-muted-foreground">
          {supportMessage}{" "}
          <Link href={supportHref} className="font-medium text-primary hover:underline">
            Contact Support
          </Link>
        </p>
      )}

      {tags.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">{tagsLabel}</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const active = value.tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge variant={active ? "brand" : "secondary"}>{t.name}</Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {subMissing && (
        <p className="text-xs text-destructive">Please select a subcategory.</p>
      )}
    </div>
  );
}
