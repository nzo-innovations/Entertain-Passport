"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export function OrganizationEditor({
  id,
  initial,
  platformDefault,
}: {
  id: string;
  initial: { name: string; phone: string; website: string; isVerified: boolean; commissionPct: number | null };
  platformDefault: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(initial.name);
  const [phone, setPhone] = React.useState(initial.phone);
  const [website, setWebsite] = React.useState(initial.website);
  const [isVerified, setIsVerified] = React.useState(initial.isVerified);
  const [useOverride, setUseOverride] = React.useState(initial.commissionPct !== null);
  const [commission, setCommission] = React.useState(initial.commissionPct ?? platformDefault);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          website,
          isVerified,
          commissionPct: useOverride ? Number(commission) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Organization updated" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Organization settings</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isVerified}
          onChange={(e) => setIsVerified(e.target.checked)}
          className="h-4 w-4"
        />
        Verified organization
      </label>

      <div className="mt-5 rounded-xl border bg-background/50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={useOverride}
            onChange={(e) => setUseOverride(e.target.checked)}
            className="h-4 w-4"
          />
          Override platform commission for this organization
        </label>
        <div className="mt-3 max-w-xs">
          <Label>Commission (%)</Label>
          <Input
            type="number"
            step="0.1"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
            disabled={!useOverride}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {useOverride
              ? "Applied to new events for this organization."
              : `Using platform default (${platformDefault}%).`}
          </p>
        </div>
      </div>

      <Button variant="brand" className="mt-5" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </section>
  );
}
