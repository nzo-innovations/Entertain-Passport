"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ROUTES } from "@/lib/config";

type CatRow = {
  id: string;
  module: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  eventCount: number;
  venueCount: number;
};

type TagRow = { id: string; name: string; slug: string };

export function CatalogAdminManager({
  categories,
  tags,
}: {
  categories: CatRow[];
  tags: TagRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"SHOWS" | "PLACES" | "TAGS">("SHOWS");
  const [name, setName] = React.useState("");
  const [parentId, setParentId] = React.useState("");
  const [tagName, setTagName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const mains = categories.filter((c) => c.module === tab && !c.parentId);
  const rows =
    tab === "TAGS"
      ? []
      : categories.filter((c) => c.module === tab && (c.parentId || !categories.some((x) => x.parentId === c.id && x.module === tab)));

  const addCategory = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          module: tab,
          parentId: parentId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add", description: data?.error, variant: "destructive" });
        return;
      }
      setName("");
      setParentId("");
      toast({ title: "Category added" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const addTag = async () => {
    if (!tagName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add tag", description: data?.error, variant: "destructive" });
        return;
      }
      setTagName("");
      toast({ title: "Tag added" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["SHOWS", "PLACES", "TAGS"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "brand" : "outline"} onClick={() => setTab(t)}>
            {t === "SHOWS" ? "Discover & Shows" : t === "PLACES" ? "Places to Go" : "Tags"}
          </Button>
        ))}
      </div>

      {tab !== "TAGS" ? (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Plus className="h-4 w-4 text-primary" /> Add {parentId ? "subcategory" : "main category"}
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="h-10 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="">Main category (no parent)</option>
                {mains.map((m) => (
                  <option key={m.id} value={m.id}>
                    Sub of: {m.name}
                  </option>
                ))}
              </select>
              <Button variant="brand" onClick={addCategory} disabled={busy || !name.trim()}>
                Add
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Organizers can request categories not listed via{" "}
              <a href={ROUTES.contact} className="text-primary hover:underline">
                Contact Support
              </a>
              .
            </p>
          </section>

          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Parent</th>
                  <th className="px-4 py-3 text-left">Slug</th>
                  <th className="px-4 py-3 text-right">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.parentId ? `↳ ${c.name}` : c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.parentName ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.eventCount + c.venueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Tag className="h-4 w-4 text-primary" /> Add tag
            </h2>
            <div className="mt-4 flex gap-2">
              <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Tag name" />
              <Button variant="brand" onClick={addTag} disabled={busy || !tagName.trim()}>
                Add
              </Button>
            </div>
          </section>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t.id} variant="secondary">
                {t.name}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
