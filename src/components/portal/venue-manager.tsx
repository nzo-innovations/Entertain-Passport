"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  MapPin,
  Music2,
  Phone,
  Plus,
  Save,
  Ticket,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { PLACES_LABEL, ROUTES } from "@/lib/config";
import { VenueProgramSchedule, type ProgramRow } from "@/components/venues/venue-program-schedule";
import {
  CategoryTagPicker,
  type CatalogPick,
} from "@/components/shared/category-tag-picker";
import {
  ACT_TYPE_LABELS,
  DAY_NAMES,
  VENUE_KIND_LABELS,
  ActType,
  ProgramRecurrence,
  VenueKind,
} from "@/lib/types";
import { SRI_LANKA_PROVINCE_NAMES, getDistricts } from "@/lib/locations";
import { CoverImageUpload } from "@/components/shared/image-upload";

type VenueProfile = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  kind: string | null;
  address: string;
  line2: string | null;
  city: string;
  district: string | null;
  province: string | null;
  country: string;
  mapUrl: string | null;
  phone: string | null;
  website: string | null;
  coverImageUrl: string | null;
  capacity: number;
  isPublished: boolean;
  placesMainCategoryId?: string | null;
  placesSubCategoryId?: string | null;
  tagIds?: string[];
};

type CatalogMain = { id: string; name: string; slug: string };
type CatalogTag = { id: string; name: string; slug: string };

const COVER_FALLBACK =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&q=80";

const emptyProgram = {
  title: "",
  description: "",
  performerName: "",
  actType: ActType.FULL_BAND as string,
  recurrence: ProgramRecurrence.WEEKLY as string,
  dayOfWeek: 5,
  specificDate: "",
  startTime: "20:00",
  endTime: "23:30",
  isPublished: true,
};

export function VenueManager({
  orgName,
  placesMains,
  placesTags,
}: {
  orgName: string;
  placesMains: CatalogMain[];
  placesTags: CatalogTag[];
}) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"profile" | "program" | "tickets">("profile");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [venue, setVenue] = React.useState<VenueProfile | null>(null);
  const [programs, setPrograms] = React.useState<ProgramRow[]>([]);
  const [form, setForm] = React.useState({
    name: orgName,
    description: "",
    kind: VenueKind.PUB as string,
    address: "",
    line2: "",
    city: "Colombo",
    district: "",
    province: "",
    country: "Sri Lanka",
    mapUrl: "",
    phone: "",
    website: "",
    coverImageUrl: null as string | null,
    capacity: 200,
    isPublished: false,
  });
  const [programForm, setProgramForm] = React.useState(emptyProgram);
  const [programSaving, setProgramSaving] = React.useState(false);
  const [catalogPick, setCatalogPick] = React.useState<CatalogPick>({
    mainCategoryId: "",
    subCategoryId: null,
    tagIds: [],
  });

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/venue", { cache: "no-store" });
        const data = await res.json();
        if (data.venue) {
          const v = data.venue as VenueProfile;
          setVenue(v);
          setForm({
            name: v.name,
            description: v.description ?? "",
            kind: (v.kind as VenueKind) ?? VenueKind.PUB,
            address: v.address,
            line2: v.line2 ?? "",
            city: v.city,
            district: v.district ?? "",
            province: v.province ?? "",
            country: v.country,
            mapUrl: v.mapUrl ?? "",
            phone: v.phone ?? "",
            website: v.website ?? "",
            coverImageUrl: v.coverImageUrl,
            capacity: v.capacity,
            isPublished: v.isPublished,
          });
          setCatalogPick({
            mainCategoryId: v.placesMainCategoryId ?? "",
            subCategoryId: v.placesSubCategoryId ?? null,
            tagIds: v.tagIds ?? [],
          });
        }
        const progRes = await fetch("/api/portal/venue/program", { cache: "no-store" });
        if (progRes.ok) {
          const progData = await progRes.json();
          setPrograms((progData.programs ?? []) as ProgramRow[]);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [orgName]);

  async function saveProfile() {
    if (!catalogPick.mainCategoryId) {
      toast({ title: "Select a Places to Go category", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/portal/venue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          placesMainCategoryId: catalogPick.mainCategoryId,
          placesSubCategoryId: catalogPick.subCategoryId,
          tagIds: catalogPick.tagIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setVenue(data.venue);
      toast({ title: "Venue saved", description: form.isPublished ? `Your page is live on ${PLACES_LABEL}.` : "Publish when ready." });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function addProgram() {
    if (!venue) {
      toast({ title: "Save venue profile first", variant: "destructive" });
      return;
    }
    setProgramSaving(true);
    try {
      const res = await fetch("/api/portal/venue/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add");
      setPrograms((prev) => [...prev, data.program]);
      setProgramForm(emptyProgram);
      toast({ title: "Program added" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setProgramSaving(false);
    }
  }

  async function deleteProgram(id: string) {
    const res = await fetch(`/api/portal/venue/program/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPrograms((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Removed" });
    }
  }

  const districts = form.province ? getDistricts(form.province) : [];

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading venue…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {(["profile", "program", "tickets"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t)}
          >
            {t === "profile" && <Building2 className="mr-1.5 h-4 w-4" />}
            {t === "program" && <Music2 className="mr-1.5 h-4 w-4" />}
            {t === "tickets" && <Ticket className="mr-1.5 h-4 w-4" />}
            {t === "profile" ? "Venue profile" : t === "program" ? "Weekly program" : "Ticketed nights"}
          </Button>
        ))}
        {venue?.slug && venue.isPublished && (
          <Button variant="ghost" size="sm" asChild className="ml-auto">
            <Link href={`/venues/${venue.slug}`} target="_blank">
              View public page
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      {tab === "profile" && (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {PLACES_LABEL} · category
              </p>
              <CategoryTagPicker
                module="PLACES"
                mains={placesMains}
                tags={placesTags}
                value={catalogPick}
                onChange={setCatalogPick}
                mainLabel="Main category"
                subLabel="Subcategory"
                subRequired={false}
                supportHref={ROUTES.contact}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Venue name</span>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Type</span>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                >
                  {Object.entries(VENUE_KIND_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Capacity</span>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">About</span>
                <textarea
                  className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe your pub, club or restaurant…"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Address line 1</span>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Address line 2</span>
                <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Province</span>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value, district: "" })}
                >
                  <option value="">Select…</option>
                  {SRI_LANKA_PROVINCE_NAMES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">District</span>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  disabled={!form.province}
                >
                  <option value="">Select…</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">City / town</span>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Phone</span>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Website</span>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Google Maps link</span>
                <Input value={form.mapUrl} onChange={(e) => setForm({ ...form, mapUrl: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Cover photo</span>
                <CoverImageUpload
                  value={form.coverImageUrl}
                  onChange={(coverImageUrl) => setForm({ ...form, coverImageUrl })}
                  folder="venues"
                  fallback={COVER_FALLBACK}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="rounded border"
              />
              Publish on <strong className="font-medium">{PLACES_LABEL}</strong> (public listing)
            </label>

            <Button variant="brand" onClick={() => void saveProfile()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save venue"}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-xl">
              <Image src={form.coverImageUrl || COVER_FALLBACK} alt="" fill className="object-cover" />
            </div>
            <p className="mt-3 font-display text-lg font-semibold">{form.name || "Your venue"}</p>
            <p className="text-sm text-muted-foreground">{VENUE_KIND_LABELS[form.kind as VenueKind] ?? form.kind} · {form.city || "City"}</p>
          </div>
        </div>
      )}

      {tab === "program" && (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="font-display text-xl font-semibold">What&apos;s on each week</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              List solo artists, bands and DJ nights that don&apos;t need tickets — e.g. The Long Bar&apos;s daily live music.
            </p>
            <div className="mt-6">
              <VenueProgramSchedule programs={programs} />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h3 className="font-semibold">Add program night</h3>
            <div className="mt-4 space-y-3">
              <Input placeholder="Title e.g. Live Band Night" value={programForm.title} onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })} />
              <Input placeholder="Performer / band name (optional)" value={programForm.performerName} onChange={(e) => setProgramForm({ ...programForm, performerName: e.target.value })} />
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={programForm.actType}
                onChange={(e) => setProgramForm({ ...programForm, actType: e.target.value })}
              >
                {Object.entries(ACT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={programForm.recurrence}
                onChange={(e) => setProgramForm({ ...programForm, recurrence: e.target.value })}
              >
                <option value={ProgramRecurrence.WEEKLY}>Every week</option>
                <option value={ProgramRecurrence.ONE_OFF}>One-off date</option>
              </select>
              {programForm.recurrence === ProgramRecurrence.WEEKLY ? (
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={programForm.dayOfWeek}
                  onChange={(e) => setProgramForm({ ...programForm, dayOfWeek: Number(e.target.value) })}
                >
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              ) : (
                <Input type="date" value={programForm.specificDate} onChange={(e) => setProgramForm({ ...programForm, specificDate: e.target.value })} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" value={programForm.startTime} onChange={(e) => setProgramForm({ ...programForm, startTime: e.target.value })} />
                <Input type="time" value={programForm.endTime} onChange={(e) => setProgramForm({ ...programForm, endTime: e.target.value })} />
              </div>
              <textarea
                className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Notes (optional)"
                value={programForm.description}
                onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
              />
              <Button variant="brand" className="w-full" disabled={programSaving || !programForm.title} onClick={() => void addProgram()}>
                <Plus className="h-4 w-4" />
                Add to program
              </Button>
            </div>

            {programs.length > 0 && (
              <ul className="mt-6 space-y-2 border-t pt-4">
                {programs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{p.title}</span>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => void deleteProgram(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "tickets" && (
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Ticketed special nights</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                When you sell tickets (e.g. a special Friday show), create an event linked to your venue.
                Approved events appear on <strong>Shows</strong> and on your venue page automatically.
              </p>
            </div>
            <Badge variant="secondary">Uses your existing organizer account</Badge>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="brand" asChild>
              <Link href={venue ? `/portal/events/new?venueId=${venue.id}` : "/portal/events/new"}>
                Create ticketed event
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/portal/events">View my events</Link>
            </Button>
          </div>
          {!venue && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Save your venue profile first so ticketed events reuse your address automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
