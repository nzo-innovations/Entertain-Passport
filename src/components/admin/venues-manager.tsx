"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { SRI_LANKA_PROVINCE_NAMES, getDistricts, ENABLED_COUNTRIES } from "@/lib/locations";

export type VenueRow = {
  id: string;
  name: string;
  address: string;
  line2: string | null;
  city: string;
  district: string | null;
  province: string | null;
  country: string;
  mapUrl: string | null;
  capacity: number;
  eventCount: number;
};

type FormState = {
  name: string;
  address: string;
  line2: string;
  city: string;
  district: string;
  province: string;
  country: string;
  mapUrl: string;
  capacity: number;
};

const empty: FormState = {
  name: "",
  address: "",
  line2: "",
  city: "",
  district: "",
  province: "",
  country: "Sri Lanka",
  mapUrl: "",
  capacity: 0,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export function VenuesManager({ initial }: { initial: VenueRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(empty);
  const [busy, setBusy] = React.useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const districts = getDistricts(form.province);

  const openCreate = () => {
    setForm(empty);
    setEditingId(null);
    setShowCreate(true);
  };
  const openEdit = (v: VenueRow) => {
    setForm({
      name: v.name,
      address: v.address,
      line2: v.line2 ?? "",
      city: v.city,
      district: v.district ?? "",
      province: v.province ?? "",
      country: v.country ?? "Sri Lanka",
      mapUrl: v.mapUrl ?? "",
      capacity: v.capacity,
    });
    setEditingId(v.id);
    setShowCreate(false);
  };
  const cancel = () => {
    setShowCreate(false);
    setEditingId(null);
    setForm(empty);
  };

  const save = async () => {
    setBusy(true);
    try {
      const url = editingId ? `/api/admin/venues/${editingId}` : "/api/admin/venues";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, capacity: Math.round(Number(form.capacity)) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: editingId ? "Venue updated" : "Venue added" });
      cancel();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: VenueRow) => {
    if (!confirm(`Delete venue "${v.name}"?`)) return;
    const res = await fetch(`/api/admin/venues/${v.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't delete", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Venue deleted" });
    router.refresh();
  };

  const formOpen = showCreate || editingId !== null;

  return (
    <div className="space-y-6">
      {!formOpen && (
        <Button variant="brand" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add venue
        </Button>
      )}

      {formOpen && (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{editingId ? "Edit venue" : "New venue"}</h2>
            <Button variant="ghost" size="icon" onClick={cancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Venue name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address line 1</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address line 2</Label>
              <Input value={form.line2} onChange={(e) => set("line2", e.target.value)} />
            </div>
            <div>
              <Label>Country</Label>
              <select
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {ENABLED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Province</Label>
              <select
                value={form.province}
                onChange={(e) => {
                  set("province", e.target.value);
                  set("district", "");
                }}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="">Select...</option>
                {SRI_LANKA_PROVINCE_NAMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>District</Label>
              <select
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                disabled={!form.province}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">{form.province ? "Select..." : "Pick a province"}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Town / City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => set("capacity", Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Google Maps link</Label>
              <Input value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="brand" onClick={save} disabled={busy || !form.name.trim() || !form.address.trim() || !form.city.trim()}>
              {busy ? "Saving..." : editingId ? "Save changes" : "Add venue"}
            </Button>
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {initial.map((v) => (
          <div key={v.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  {v.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[v.address, v.city, v.district, v.province, v.country].filter(Boolean).join(", ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Capacity {v.capacity.toLocaleString()} · {v.eventCount} event(s)
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(v)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {initial.length === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground sm:col-span-2">
            No venues yet. Add your first venue above.
          </p>
        )}
      </div>
    </div>
  );
}
