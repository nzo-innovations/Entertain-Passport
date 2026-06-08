"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import { ImageGalleryEditor } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { getCurrency } from "@/lib/money";
import { SRI_LANKA_PROVINCE_NAMES, getDistricts, ENABLED_COUNTRIES } from "@/lib/locations";
import { EventStatus } from "@/lib/types";

type PkgRow = {
  id?: string;
  name: string;
  price: number; // major units
  qtyTotal: number;
  qtySold: number;
  perks: string;
};

export type EventEditInitial = {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  currency: string;
  date: string;
  time: string;
  salesThreshold: number | null;
  status: string;
  commissionPct: number;
  venue: {
    name: string;
    line1: string;
    line2: string;
    city: string;
    district: string;
    province: string;
    country: string;
    mapUrl: string;
  };
  packages: PkgRow[];
  images: string[];
  primaryIndex: number;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export function EventEditForm({
  initial,
  categories,
  isSuperAdmin,
  canDelete,
  redirectAfter,
  deleteRedirect,
}: {
  initial: EventEditInitial;
  categories: { id: string; name: string }[];
  isSuperAdmin: boolean;
  canDelete: boolean;
  redirectAfter: string;
  deleteRedirect: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [v, setV] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const cur = getCurrency(v.currency);
  const districts = getDistricts(v.venue.province);

  const set = <K extends keyof EventEditInitial>(k: K, val: EventEditInitial[K]) =>
    setV((s) => ({ ...s, [k]: val }));
  const setVenue = (k: keyof EventEditInitial["venue"], val: string) =>
    setV((s) => ({ ...s, venue: { ...s.venue, [k]: val } }));
  const setPkg = (i: number, k: keyof PkgRow, val: string | number) =>
    setV((s) => ({ ...s, packages: s.packages.map((p, idx) => (idx === i ? { ...p, [k]: val } : p)) }));
  const addPkg = () =>
    setV((s) => ({ ...s, packages: [...s.packages, { name: "", price: 0, qtyTotal: 100, qtySold: 0, perks: "" }] }));
  const removePkg = (i: number) =>
    setV((s) => ({ ...s, packages: s.packages.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (v.images.length === 0) {
      toast({ title: "Add event photos", description: "Upload at least one image.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: v.title,
          shortDescription: v.shortDescription,
          description: v.description,
          categoryId: v.categoryId,
          currency: v.currency,
          date: v.date,
          time: v.time,
          salesThreshold: v.salesThreshold,
          status: isSuperAdmin ? v.status : undefined,
          commissionPct: isSuperAdmin ? Number(v.commissionPct) : undefined,
          venue: {
            name: v.venue.name,
            line1: v.venue.line1,
            line2: v.venue.line2,
            city: v.venue.city,
            district: v.venue.district,
            province: v.venue.province,
            country: v.venue.country,
            mapUrl: v.venue.mapUrl,
          },
          packages: v.packages.map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            qtyTotal: Number(p.qtyTotal),
            perks: p.perks,
          })),
          images: v.images,
          primaryIndex: v.primaryIndex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Event updated" });
      router.push(redirectAfter);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm("Delete this event permanently? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${initial.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Event deleted" });
      router.push(deleteRedirect);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Event details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={v.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>One-line description</Label>
            <Input value={v.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          </div>
          <div>
            <Label>Full description</Label>
            <textarea
              rows={5}
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <select
                value={v.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <Label>Start time</Label>
              <Input type="time" value={v.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            <div>
              <Label>Sales-threshold alert</Label>
              <Input
                type="number"
                value={v.salesThreshold ?? ""}
                onChange={(e) => set("salesThreshold", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Venue &amp; address</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Venue name</Label>
            <Input value={v.venue.name} onChange={(e) => setVenue("name", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address line 1</Label>
            <Input value={v.venue.line1} onChange={(e) => setVenue("line1", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address line 2</Label>
            <Input value={v.venue.line2} onChange={(e) => setVenue("line2", e.target.value)} />
          </div>
          <div>
            <Label>Country</Label>
            <select
              value={v.venue.country}
              onChange={(e) => setVenue("country", e.target.value)}
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
              value={v.venue.province}
              onChange={(e) => {
                setVenue("province", e.target.value);
                setVenue("district", "");
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
              value={v.venue.district}
              onChange={(e) => setVenue("district", e.target.value)}
              disabled={!v.venue.province}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">{v.venue.province ? "Select..." : "Pick a province"}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Town / City</Label>
            <Input value={v.venue.city} onChange={(e) => setVenue("city", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Google Maps link</Label>
            <Input value={v.venue.mapUrl} onChange={(e) => setVenue("mapUrl", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Event photos</h2>
        <div className="mt-4">
          <ImageGalleryEditor
            images={v.images}
            primaryIndex={v.primaryIndex}
            onChange={(images, primaryIndex) => setV((s) => ({ ...s, images, primaryIndex }))}
            folder="events"
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Ticket packages ({cur.code})</h2>
          <Button variant="outline" size="sm" onClick={addPkg}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <ul className="mt-4 space-y-3">
          {v.packages.map((p, i) => (
            <li key={p.id ?? `new-${i}`} className="rounded-xl border bg-background/40 p-4">
              <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
                <div>
                  <Label>Name</Label>
                  <Input value={p.name} onChange={(e) => setPkg(i, "name", e.target.value)} />
                </div>
                <div>
                  <Label>Price ({cur.code})</Label>
                  <Input type="number" value={p.price} onChange={(e) => setPkg(i, "price", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={p.qtyTotal} onChange={(e) => setPkg(i, "qtyTotal", Number(e.target.value))} />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePkg(i)}
                    disabled={p.qtySold > 0}
                    title={p.qtySold > 0 ? "Has sales - cannot remove" : "Remove"}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3">
                <Label>Perks (comma separated)</Label>
                <Input value={p.perks} onChange={(e) => setPkg(i, "perks", e.target.value)} />
              </div>
              {p.qtySold > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{p.qtySold} sold · quantity can&apos;t go below this.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Commission &amp; status</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Platform commission (%)</Label>
            {isSuperAdmin ? (
              <Input
                type="number"
                step="0.1"
                value={v.commissionPct}
                onChange={(e) => set("commissionPct", Number(e.target.value))}
              />
            ) : (
              <div className="flex h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{v.commissionPct}%</span>
                <span className="text-muted-foreground">set by nZO</span>
              </div>
            )}
          </div>
          {isSuperAdmin && (
            <div>
              <Label>Status</Label>
              <select
                value={v.status}
                onChange={(e) => set("status", e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {Object.values(EventStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="brand" size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {canDelete && (
          <Button variant="destructive" size="lg" onClick={del} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting..." : "Delete event"}
          </Button>
        )}
      </div>
    </div>
  );
}
