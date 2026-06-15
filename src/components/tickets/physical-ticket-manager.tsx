"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  Plus,
  Settings2,
  Ticket as TicketIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatMoney } from "@/lib/money";
import { formatEventDateLong } from "@/lib/format";
import {
  PhysicalCodeCharset,
  PHYSICAL_CODE_CHARSET_LABELS,
  PhysicalTicketStatus,
  PHYSICAL_TICKET_STATUS_LABELS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type EventInfo = {
  id: string;
  title: string;
  currency: string;
  status: string;
  approvalStatus: string;
  physicalTicketsEnabled: boolean;
  physicalCodeLength: number | null;
  physicalCodeCharset: string;
  venueName: string;
  organizationName: string;
  startsAt: string;
};

type Pkg = { id: string; name: string; price: number; qtyTotal: number; qtySold: number };
type Mismatch = { packageId: string; name: string; qtyTotal: number; refCount: number; ok: boolean };
type Row = { id: string; packageId: string; refCode: string; status: string; soldAt: string | null; note: string | null };

type Payload = {
  event: EventInfo;
  packages: Pkg[];
  mismatches: Mismatch[];
  tickets: Row[];
};

export function PhysicalTicketManager({
  eventId,
  canConfigure,
  showEventHeader = false,
}: {
  eventId: string;
  canConfigure: boolean;
  showEventHeader?: boolean;
}) {
  const { toast } = useToast();
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/physical`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [eventId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading physical tickets…
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Couldn&apos;t load physical ticket information.
      </section>
    );
  }

  const { event, packages, mismatches, tickets } = data;
  const enabled = event.physicalTicketsEnabled;
  const hasMismatch = enabled && mismatches.some((m) => !m.ok);

  return (
    <section className="space-y-5">
      {showEventHeader && (
        <div className="rounded-2xl border bg-primary/5 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Managing physical tickets for
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">{event.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {event.venueName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {formatEventDateLong(event.startsAt)}
            </span>
            <span>· {event.organizationName}</span>
          </p>
        </div>
      )}

      <ConfigCard event={event} canConfigure={canConfigure} onChanged={load} />

      {enabled && (
        <>
          {hasMismatch ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Ticket codes don&apos;t match quantities
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {mismatches
                    .filter((m) => !m.ok)
                    .map((m) => (
                      <li key={m.packageId}>
                        “{m.name}”: {m.refCount} of {m.qtyTotal} codes added.
                      </li>
                    ))}
                </ul>
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  This event can&apos;t be published until every category matches exactly.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" /> All ticket categories match their physical codes.
            </div>
          )}

          <div className="space-y-4">
            {packages.map((p) => (
              <CategoryCard
                key={p.id}
                eventId={eventId}
                pkg={p}
                currency={event.currency}
                mismatch={mismatches.find((m) => m.packageId === p.id)}
                rows={tickets.filter((t) => t.packageId === p.id)}
                onChanged={load}
              />
            ))}
            {packages.length === 0 && (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Add ticket categories to the event first, then assign physical codes here.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ConfigCard({
  event,
  canConfigure,
  onChanged,
}: {
  event: EventInfo;
  canConfigure: boolean;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState(event.physicalTicketsEnabled);
  const [length, setLength] = React.useState<string>(event.physicalCodeLength?.toString() ?? "7");
  const [charset, setCharset] = React.useState(event.physicalCodeCharset || PhysicalCodeCharset.NUMERIC);
  const [saving, setSaving] = React.useState(false);

  const save = async (nextEnabled: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}/physical/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          length: nextEnabled ? Number(length) : null,
          charset,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: json?.error, variant: "destructive" });
        return;
      }
      toast({ title: nextEnabled ? "Physical tickets enabled" : "Physical tickets disabled" });
      setOpen(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  if (!event.physicalTicketsEnabled && !canConfigure) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Physical ticket management is turned off for this event.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Settings2 className="h-5 w-5 text-primary" /> Physical ticket management
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.physicalTicketsEnabled ? (
              <>
                Enabled · {event.physicalCodeLength ?? "any"}-char codes ·{" "}
                {PHYSICAL_CODE_CHARSET_LABELS[event.physicalCodeCharset as PhysicalCodeCharset] ??
                  event.physicalCodeCharset}
              </>
            ) : (
              "Turn this on to register pre-printed ticket reference codes."
            )}
          </p>
        </div>
        {canConfigure && (
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : event.physicalTicketsEnabled ? "Settings" : "Set up"}
          </Button>
        )}
      </div>

      {open && canConfigure && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enable physical ticket management for this event
          </label>

          {enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ref code length
                </p>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="e.g. 7"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Total characters in each printed code (e.g. 7 → 0000010).
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Characters
                </p>
                <select
                  value={charset}
                  onChange={(e) => setCharset(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value={PhysicalCodeCharset.NUMERIC}>
                    {PHYSICAL_CODE_CHARSET_LABELS.NUMERIC}
                  </option>
                  <option value={PhysicalCodeCharset.ALPHANUMERIC}>
                    {PHYSICAL_CODE_CHARSET_LABELS.ALPHANUMERIC}
                  </option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="brand" size="sm" onClick={() => save(enabled)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save settings
            </Button>
            {event.physicalTicketsEnabled && (
              <p className="text-xs text-muted-foreground">
                Changing length/characters won&apos;t alter existing codes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  eventId,
  pkg,
  currency,
  mismatch,
  rows,
  onChanged,
}: {
  eventId: string;
  pkg: Pkg;
  currency: string;
  mismatch?: Mismatch;
  rows: Row[];
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [single, setSingle] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showCodes, setShowCodes] = React.useState(false);

  const refCount = mismatch?.refCount ?? rows.filter((r) => r.status !== PhysicalTicketStatus.VOID).length;
  const ok = mismatch?.ok ?? refCount === pkg.qtyTotal;
  const soldCount = rows.filter((r) => r.status === PhysicalTicketStatus.SOLD).length;

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/physical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add codes", description: json?.error, variant: "destructive" });
        return;
      }
      const added = json.added ?? 0;
      const skipped = json.skipped ?? 0;
      toast({
        title: `Added ${added} code${added === 1 ? "" : "s"}`,
        description: skipped > 0 ? `${skipped} already existed and were skipped.` : undefined,
      });
      setSingle("");
      setStart("");
      setEnd("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-semibold">{pkg.name}</h4>
          <p className="text-sm text-muted-foreground">
            {formatMoney(pkg.price, currency)} · needs {pkg.qtyTotal} codes
          </p>
        </div>
        <Badge variant={ok ? "success" : "warning"}>
          {refCount}/{pkg.qtyTotal} codes{soldCount > 0 ? ` · ${soldCount} sold` : ""}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-background/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add one code
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={single}
              onChange={(e) => setSingle(e.target.value)}
              placeholder="e.g. 0000010"
              className="h-9 font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !single.trim()}
              onClick={() => post({ mode: "single", refCode: single.trim() })}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-background/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add a range (auto-fill)
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="0000010"
              className="h-9 font-mono"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="0056800"
              className="h-9 font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !start.trim() || !end.trim()}
              onClick={() => post({ mode: "range", start: start.trim(), end: end.trim() })}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Fill
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setShowCodes((s) => !s)}>
          <TicketIcon className="h-4 w-4" />
          {showCodes ? "Hide codes" : `View ${rows.length} code${rows.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      {showCodes && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ref code</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <CodeRow key={r.id} eventId={eventId} row={r} onChanged={onChanged} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    No codes yet for this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CodeRow({
  eventId,
  row,
  onChanged,
}: {
  eventId: string;
  row: Row;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/physical/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't update", description: json?.error, variant: "destructive" });
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/physical/${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: json?.error, variant: "destructive" });
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const variant =
    row.status === PhysicalTicketStatus.SOLD
      ? "success"
      : row.status === PhysicalTicketStatus.VOID
      ? "outline"
      : "secondary";

  return (
    <tr className={cn("align-middle", busy && "opacity-50")}>
      <td className="px-3 py-2 font-mono">{row.refCode}</td>
      <td className="px-3 py-2">
        <Badge variant={variant}>{PHYSICAL_TICKET_STATUS_LABELS[row.status as PhysicalTicketStatus] ?? row.status}</Badge>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {row.status === PhysicalTicketStatus.SOLD ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => patch({ status: "AVAILABLE" })}>
              Mark unsold
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || row.status === PhysicalTicketStatus.VOID}
              onClick={() => patch({ status: "SOLD" })}
            >
              Mark sold
            </Button>
          )}
          {row.status === PhysicalTicketStatus.VOID ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => patch({ status: "AVAILABLE" })}>
              Restore
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => patch({ status: "VOID" })}>
              Void
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={del}
            title="Delete code"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
