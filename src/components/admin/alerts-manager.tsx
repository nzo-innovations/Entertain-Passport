"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type Alert = {
  id: string;
  eventTitle: string;
  thresholdType: string;
  thresholdValue: number;
  channel: string;
};

const TYPE_LABELS: Record<string, string> = {
  TICKETS_SOLD: "Tickets sold reaches",
  PERCENT_SOLD: "Percent sold reaches",
  REVENUE: "Revenue reaches",
};

export function AlertsManager({
  alerts,
  events,
}: {
  alerts: Alert[];
  events: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [eventId, setEventId] = React.useState(events[0]?.id ?? "");
  const [type, setType] = React.useState("TICKETS_SOLD");
  const [value, setValue] = React.useState(1000);
  const [busy, setBusy] = React.useState(false);

  const create = async () => {
    if (!eventId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, thresholdType: type, thresholdValue: Math.round(Number(value)), channel: "email" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Alert created" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Couldn't delete", variant: "destructive" });
      return;
    }
    toast({ title: "Alert removed" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Plus className="h-4 w-4 text-primary" /> New threshold alert
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1.5fr_1.2fr_0.8fr_auto]">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="TICKETS_SOLD">Tickets sold</option>
            <option value="PERCENT_SOLD">Percent sold</option>
            <option value="REVENUE">Revenue (LKR)</option>
          </select>
          <Input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
          <Button variant="brand" onClick={create} disabled={busy || !eventId}>
            Add
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Condition</th>
              <th className="px-4 py-3 text-left">Channel</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {alerts.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-amber-500" />
                    {a.eventTitle}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {TYPE_LABELS[a.thresholdType] ?? a.thresholdType} {a.thresholdValue.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{a.channel}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(a.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No alerts configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
