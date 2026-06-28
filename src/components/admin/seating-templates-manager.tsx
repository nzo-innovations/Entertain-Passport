"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  LayoutGrid,
  Save,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { SeatLayoutDesigner } from "@/components/seating/seat-layout-designer";
import type { SeatLayoutDocument } from "@/lib/seating/types";

export type TemplateRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  updatedAt: string;
};

export function SeatingTemplatesManager({ initial }: { initial: TemplateRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [layout, setLayout] = React.useState<SeatLayoutDocument | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [saving, setSaving] = React.useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  const saveLayout = async () => {
    if (!selectedId || !layout) return;
    if (selectedTemplate?.isSystem) {
      toast({
        title: "System template",
        description: "Duplicate this template first to save your edits.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/seating/templates/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Template saved" });
      router.refresh();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/seating/templates/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSelectedId(id);
      setLayout(json.template.layout);
    } catch (err) {
      toast({
        title: "Could not load template",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportTemplate = async (id: string) => {
    const res = await fetch(`/api/admin/seating/templates/${id}/export`);
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "Export failed", variant: "destructive" });
      return;
    }
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${json.slug}-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as {
        slug: string;
        name: string;
        description?: string;
        layout: SeatLayoutDocument;
      };
      const res = await fetch("/api/admin/seating/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Template imported" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Invalid JSON",
        variant: "destructive",
      });
    }
  };

  const duplicate = async (id: string, name: string) => {
    const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`;
    const res = await fetch(`/api/admin/seating/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateAs: { slug, name: `${name} (copy)` } }),
    });
    if (res.ok) {
      toast({ title: "Template duplicated" });
      router.refresh();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Templates
          </h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
              }}
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-3.5 w-3.5" />
                Import
              </span>
            </Button>
          </label>
        </div>

        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className={`rounded-xl border p-3 transition-colors ${
                selectedId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void loadTemplate(t.id)}
                >
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.slug}</p>
                </button>
                {t.isSystem && <Badge variant="secondary">System</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => void exportTemplate(t.id)}>
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void duplicate(t.id, t.name)}>
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 space-y-4 rounded-2xl border p-4 lg:col-span-1">
        {!layout ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <LayoutGrid className="h-10 w-10 opacity-40" />
            <p className="text-sm">Select a template to open the layout designer.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold">{layout.name}</h2>
                {selectedTemplate?.isSystem && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    System template - duplicate to save edits.
                  </p>
                )}
              </div>
              {!selectedTemplate?.isSystem && (
                <Button size="sm" disabled={saving} onClick={() => void saveLayout()}>
                  <Save className="h-4 w-4" />
                  Save template
                </Button>
              )}
            </div>
            <SeatLayoutDesigner layout={layout} onChange={setLayout} />
          </>
        )}
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      </div>
    </div>
  );
}
