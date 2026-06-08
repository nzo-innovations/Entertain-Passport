"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export function SettingsForm({
  initial,
}: {
  initial: { defaultCommissionPct: number; freeStaffPerEvent: number; extraStaffMonthlyFee: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [commission, setCommission] = React.useState(initial.defaultCommissionPct);
  const [freeStaff, setFreeStaff] = React.useState(initial.freeStaffPerEvent);
  // Stored in cents; edit in major LKR units.
  const [extraFee, setExtraFee] = React.useState(initial.extraStaffMonthlyFee / 100);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCommissionPct: Number(commission),
          freeStaffPerEvent: Math.round(Number(freeStaff)),
          extraStaffMonthlyFee: Math.round(Number(extraFee) * 100),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Settings saved", description: "Platform defaults updated." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Commission</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Default platform commission applied to new events. Per-organization
          overrides are set on each organization.
        </p>
        <div className="mt-4 max-w-xs">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Default commission (%)
          </label>
          <Input
            type="number"
            step="0.1"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Event staff</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Free staff slots per event, then a monthly fee for each extra slot.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Free staff per event
            </label>
            <Input
              type="number"
              value={freeStaff}
              onChange={(e) => setFreeStaff(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Extra staff fee (LKR / month)
            </label>
            <Input
              type="number"
              value={extraFee}
              onChange={(e) => setExtraFee(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <Button variant="brand" size="lg" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Save settings"}
      </Button>
    </div>
  );
}
