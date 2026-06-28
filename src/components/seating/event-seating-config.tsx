"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { SeatLayoutDesigner } from "@/components/seating/seat-layout-designer";
import { TicketPackagesPanel } from "@/components/seating/ticket-packages-panel";
import type { SeatLayoutDocument } from "@/lib/seating/types";
import { normalizeLayout } from "@/lib/seating/layout-utils";
import { syncLayoutCategoriesFromPackages, parseTicketKind, type EventTicketPackage } from "@/lib/seating/package-sync";
import { cn } from "@/lib/utils";

type TemplateOption = { id: string; slug: string; name: string; isSystem: boolean };

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Empty response from server" : `Request failed (${res.status})`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
}

type Props = {
  eventId: string;
  eventTitle: string;
  templates: TemplateOption[];
  ticketPackages: EventTicketPackage[];
  initial: {
    seatingEnabled: boolean;
    published: boolean;
    layout: SeatLayoutDocument;
  };
};

export function EventSeatingConfig({
  eventId,
  eventTitle,
  templates,
  ticketPackages,
  initial,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [seatingEnabled, setSeatingEnabled] = React.useState(initial.seatingEnabled);
  const [published, setPublished] = React.useState(initial.published);
  const [layout, setLayout] = React.useState(() =>
    ticketPackages.length > 0
      ? syncLayoutCategoriesFromPackages(initial.layout, ticketPackages)
      : initial.layout
  );
  const [selectedTemplate, setSelectedTemplate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const save = async (opts?: { publish?: boolean }) => {
    setSaving(true);
    try {
      const payload = normalizeLayout(layout);
      const res = await fetch(`/api/events/${eventId}/seating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatingEnabled,
          layout: payload,
          publish: opts?.publish,
        }),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed");
      if (opts?.publish) setPublished(true);
      if (json.seating && typeof json.seating === "object" && "layout" in json.seating) {
        setLayout(json.seating.layout as SeatLayoutDocument);
      }
      toast({ title: opts?.publish ? "Seat map published" : "Seating saved" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/seating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, seatingEnabled }),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not apply template");
      const load = await fetch(`/api/events/${eventId}/seating`);
      const loaded = await readJsonResponse(load);
      const seating = loaded.seating as { layout?: SeatLayoutDocument } | undefined;
      if (seating?.layout) setLayout(seating.layout);
      toast({ title: "Template applied" });
    } catch (err) {
      toast({
        title: "Could not apply template",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl">Seating - {eventTitle}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Build your seat map in the designer below, then save or publish.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {published ? (
            <Badge variant="brand" className="gap-1">
              <Check className="h-3 w-3" /> Published
            </Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            variant="brand"
            size="sm"
            disabled={saving || !seatingEnabled}
            onClick={() => void save({ publish: true })}
          >
            <Eye className="h-4 w-4" />
            Publish
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={seatingEnabled}
            onChange={(e) => setSeatingEnabled(e.target.checked)}
            className="h-4 w-4 rounded border"
          />
          Enable seat selection for this event
        </label>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setTemplatesOpen((v) => !v)}
        >
          Templates ({templates.length})
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", templatesOpen && "rotate-180")} />
        </button>
      </div>

      {templatesOpen && (
        <div className="flex gap-2 overflow-x-auto rounded-lg border bg-muted/20 p-2 pb-1">
          {templates.map((t) => (
            <Button
              key={t.id}
              variant={selectedTemplate === t.id ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => void applyTemplate(t.id)}
            >
              {t.name}
              {t.isSystem && " ★"}
            </Button>
          ))}
        </div>
      )}

      <TicketPackagesPanel
        eventId={eventId}
        packages={ticketPackages}
        layout={layout}
        onSyncLayout={setLayout}
      />

      <SeatLayoutDesigner layout={layout} onChange={setLayout} ticketPackages={ticketPackages} />
    </div>
  );
}
