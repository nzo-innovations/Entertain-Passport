"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Info,
  Lock,
  MapPin,
  Plus,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Wand2,
} from "lucide-react";
import { ImageGalleryEditor } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  ENABLED_CURRENCIES,
  ALL_CURRENCIES,
  DEFAULT_CURRENCY,
  getCurrency,
  formatMoneyMajor,
} from "@/lib/money";
import { SRI_LANKA_PROVINCE_NAMES, getDistricts, ENABLED_COUNTRIES } from "@/lib/locations";
import { CategoryTagPicker, type CatalogPick } from "@/components/shared/category-tag-picker";
import { ROUTES } from "@/lib/config";
import { resolveLeafCategoryId } from "@/lib/catalog";

const STEPS = ["Basics", "Location", "Media", "Tickets", "Settings", "Review"] as const;
type Step = (typeof STEPS)[number];

type Pkg = { name: string; price: number; qtyTotal: number; perks: string };

export type EventWizardProps = {
  categories?: { id: string; name: string }[];
  showsMains?: { id: string; name: string; slug: string }[];
  showsTags?: { id: string; name: string; slug: string }[];
  canEditCommission: boolean;
  defaultCommission: number;
  organizations?: { id: string; name: string }[];
  orgVenue?: {
    id: string;
    name: string;
    address: string;
    line2?: string | null;
    city: string;
    district?: string | null;
    province?: string | null;
    country: string;
    mapUrl?: string | null;
    capacity?: number;
  } | null;
  backHref: string;
  listHref: string;
};

export function EventWizard({
  categories = [],
  showsMains = [],
  showsTags = [],
  canEditCommission,
  defaultCommission,
  organizations,
  orgVenue,
  backHref,
  listHref,
}: EventWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>("Basics");
  const stepIndex = STEPS.indexOf(step);

  const [useOrgVenue, setUseOrgVenue] = React.useState(!!orgVenue);

  const [title, setTitle] = React.useState("");
  const [shortDescription, setShortDescription] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [showsPick, setShowsPick] = React.useState<CatalogPick>({
    mainCategoryId: showsMains[0]?.id ?? "",
    subCategoryId: null,
    tagIds: [],
  });
  const [showsSubs, setShowsSubs] = React.useState<{ id: string; name: string }[]>([]);
  const [currency, setCurrency] = React.useState<string>(DEFAULT_CURRENCY);
  const [organizationId, setOrganizationId] = React.useState(organizations?.[0]?.id ?? "");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("19:30");

  // Structured location
  const [venueName, setVenueName] = React.useState(orgVenue?.name ?? "");
  const [country, setCountry] = React.useState(orgVenue?.country ?? "Sri Lanka");
  const [province, setProvince] = React.useState(orgVenue?.province ?? "");
  const [district, setDistrict] = React.useState(orgVenue?.district ?? "");
  const [town, setTown] = React.useState(orgVenue?.city ?? "");
  const [line1, setLine1] = React.useState(orgVenue?.address ?? "");
  const [line2, setLine2] = React.useState(orgVenue?.line2 ?? "");
  const [mapUrl, setMapUrl] = React.useState(orgVenue?.mapUrl ?? "");

  const [images, setImages] = React.useState<string[]>([]);
  const [primaryIdx, setPrimaryIdx] = React.useState(0);
  const [packages, setPackages] = React.useState<Pkg[]>([
    { name: "General Admission", price: 3500, qtyTotal: 1000, perks: "Standing entry" },
    { name: "VIP", price: 12000, qtyTotal: 100, perks: "Front row, meet & greet, signed poster" },
  ]);
  const [commission, setCommission] = React.useState(defaultCommission);
  const [salesThreshold, setSalesThreshold] = React.useState(500);
  const [submitting, setSubmitting] = React.useState(false);

  const cur = getCurrency(currency);
  const districts = getDistricts(province);

  React.useEffect(() => {
    if (!showsPick.mainCategoryId) {
      setShowsSubs([]);
      return;
    }
    fetch(`/api/catalog/subcategories?mainId=${encodeURIComponent(showsPick.mainCategoryId)}`)
      .then((r) => r.json())
      .then((d) => setShowsSubs(d.subcategories ?? []));
  }, [showsPick.mainCategoryId]);

  const useCatalogPicker = showsMains.length > 0;
  const resolvedCategoryId = useCatalogPicker
    ? resolveLeafCategoryId(showsPick.mainCategoryId, showsPick.subCategoryId, showsSubs)
    : categoryId;
  const categoryName = useCatalogPicker
    ? [showsMains.find((m) => m.id === showsPick.mainCategoryId)?.name, showsSubs.find((s) => s.id === showsPick.subCategoryId)?.name]
        .filter(Boolean)
        .join(" · ")
    : categories.find((c) => c.id === categoryId)?.name ?? "";

  const next = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);
  const prev = () => setStep(STEPS[Math.max(stepIndex - 1, 0)]);

  const addPackage = () =>
    setPackages((p) => [...p, { name: "", price: 0, qtyTotal: 100, perks: "" }]);
  const updatePackage = (i: number, k: keyof Pkg, v: string | number) =>
    setPackages((p) => p.map((pkg, idx) => (idx === i ? { ...pkg, [k]: v } : pkg)));
  const removePackage = (i: number) => setPackages((p) => p.filter((_, idx) => idx !== i));

  const handlePublish = async () => {
    if (images.length === 0) {
      toast({ title: "Add event photos", description: "Upload at least one image in the Media step.", variant: "destructive" });
      setStep("Media");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          shortDescription,
          description,
          categoryId: resolvedCategoryId,
          tagIds: useCatalogPicker ? showsPick.tagIds : undefined,
          currency,
          date,
          time,
          organizationId: organizations ? organizationId : undefined,
          commissionPct: canEditCommission ? commission : undefined,
          salesThreshold,
          venue: {
            name: venueName,
            line1,
            line2,
            city: town,
            district,
            province,
            country,
            mapUrl,
          },
          existingVenueId: useOrgVenue && orgVenue ? orgVenue.id : undefined,
          images,
          primaryIndex: primaryIdx,
          packages: packages.map((p) => ({
            name: p.name,
            price: Number(p.price),
            qtyTotal: Number(p.qtyTotal),
            perks: p.perks,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't publish", description: data?.error ?? "Please review your details." });
        return;
      }
      toast({
        title: canEditCommission ? "\u2728 Event published" : "\u2728 Event submitted for review",
        description: canEditCommission
          ? `${title} is now live.`
          : `${title} was submitted. nZO will review it before it goes live.`,
      });
      router.push(listHref);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Publish a new show</h1>
        <p className="text-sm text-muted-foreground">
          Six quick steps from idea to selling tickets.
          {!canEditCommission && " Your show is reviewed by nZO before it goes live."}
        </p>
      </header>

      <Stepper step={step} />

      <div className="rounded-3xl border bg-card p-6 sm:p-8">
        {step === "Basics" && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold">Event basics</h2>

            {organizations && (
              <div>
                <Label>Organization</Label>
                <Select value={organizationId} onChange={setOrganizationId}>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label>Event title</Label>
              <Input
                placeholder="e.g. Aurora Nights: The Colombo Tour"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base"
              />
            </div>
            <div>
              <Label>One-line description</Label>
              <Input
                placeholder="A short hook your customers will see on the event card."
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Full description</Label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell your customers what to expect: line-up, vibe, perks, story..."
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {useCatalogPicker ? (
                  <CategoryTagPicker
                    module="SHOWS"
                    mains={showsMains}
                    tags={showsTags}
                    value={showsPick}
                    onChange={setShowsPick}
                    mainLabel="Main category"
                    subLabel="Subcategory"
                    supportHref={ROUTES.contact}
                    supportMessage="Need a category that is not listed?"
                  />
                ) : (
                  <>
                    <Label>Genre / Category</Label>
                    <Select value={categoryId} onChange={setCategoryId}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Need a new category?{" "}
                  <Link href={ROUTES.contact} className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                    Contact Support
                  </Link>
                </p>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onChange={setCurrency}>
                  {ENABLED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                  {ALL_CURRENCIES.filter((c) => !c.enabled).map((c) => (
                    <option key={c.code} value={c.code} disabled>
                      {c.code} - {c.name} (coming soon)
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  More currencies are coming as nZO expands world-wide.
                </p>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Start time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === "Location" && (
          <div className="space-y-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <MapPin className="h-5 w-5 text-primary" />
              Venue &amp; address
            </h2>

            {orgVenue && (
              <label className="flex items-start gap-3 rounded-xl border bg-primary/5 p-4 text-sm">
                <input
                  type="checkbox"
                  checked={useOrgVenue}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setUseOrgVenue(on);
                    if (on) {
                      setVenueName(orgVenue.name);
                      setLine1(orgVenue.address);
                      setLine2(orgVenue.line2 ?? "");
                      setTown(orgVenue.city);
                      setDistrict(orgVenue.district ?? "");
                      setProvince(orgVenue.province ?? "");
                      setCountry(orgVenue.country);
                      setMapUrl(orgVenue.mapUrl ?? "");
                    }
                  }}
                  className="mt-1 rounded border"
                />
                <span>
                  <strong className="font-medium">Use my venue profile</strong> - {orgVenue.name}. Ticketed
                  events will appear on your venue page and on Shows.
                </span>
              </label>
            )}

            <div>
              <Label>Venue name</Label>
              <Input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Nelum Pokuna Theatre"
                disabled={useOrgVenue && !!orgVenue}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Country</Label>
                <Select value={country} onChange={setCountry}>
                  {ENABLED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Province</Label>
                <Select
                  value={province}
                  onChange={(v) => {
                    setProvince(v);
                    setDistrict("");
                  }}
                >
                  <option value="">Select…</option>
                  {SRI_LANKA_PROVINCE_NAMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>District</Label>
                <Select value={district} onChange={setDistrict} disabled={!province}>
                  <option value="">{province ? "Select…" : "Pick a province first"}</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Town / City</Label>
                <Input value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Colombo 07" />
              </div>
              <div className="sm:col-span-2">
                <Label>Address line 1</Label>
                <Input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" />
              </div>
              <div className="sm:col-span-2">
                <Label>Address line 2</Label>
                <Input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Building, floor, landmark (optional)" />
              </div>
              <div className="sm:col-span-2">
                <Label>Google Maps link (optional)</Label>
                <Input
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Paste a Google Maps location link so fans can find the venue easily.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "Media" && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold">Gallery</h2>
            <ImageGalleryEditor
              images={images}
              primaryIndex={primaryIdx}
              onChange={(next, primary) => {
                setImages(next);
                setPrimaryIdx(primary);
              }}
              folder="events"
            />
          </div>
        )}

        {step === "Tickets" && (
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">Ticket packages</h2>
              <Button variant="outline" size="sm" onClick={addPackage}>
                <Plus className="h-4 w-4" /> Add package
              </Button>
            </div>

            <ul className="space-y-3">
              {packages.map((p, i) => (
                <li key={i} className="rounded-2xl border bg-background/40 p-4">
                  <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
                    <div>
                      <Label>Package name</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => updatePackage(i, "name", e.target.value)}
                        placeholder="e.g. VIP Front Row"
                      />
                    </div>
                    <div>
                      <Label>Price ({cur.code})</Label>
                      <Input
                        type="number"
                        value={p.price}
                        onChange={(e) => updatePackage(i, "price", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={p.qtyTotal}
                        onChange={(e) => updatePackage(i, "qtyTotal", Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePackage(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label>Perks (comma separated)</Label>
                    <Input
                      value={p.perks}
                      onChange={(e) => updatePackage(i, "perks", e.target.value)}
                      placeholder="Reserved seat, Express entry, Souvenir lanyard"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "Settings" && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold">Commission &amp; alerts</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Platform commission (%)</Label>
                {canEditCommission ? (
                  <>
                    <Input
                      type="number"
                      step="0.1"
                      value={commission}
                      onChange={(e) => setCommission(Number(e.target.value))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      As Super Admin you can override the commission for this event.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold tabular-nums">{defaultCommission}%</span>
                      <span className="text-muted-foreground">set by nZO</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Commission is managed by the nZO platform.{" "}
                      <a href={ROUTES.contact} className="text-primary hover:underline">
                        Contact us
                      </a>{" "}
                      to discuss your rate.
                    </p>
                  </>
                )}
              </div>
              <div>
                <Label>Sales-threshold alert</Label>
                <Input
                  type="number"
                  value={salesThreshold}
                  onChange={(e) => setSalesThreshold(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  We&apos;ll email you when {salesThreshold} tickets have been sold.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Smart suggestion
              </p>
              <p className="mt-1 text-muted-foreground">
                Based on similar events, consider an early-bird tier for the first 200 tickets.
              </p>
            </div>
          </div>
        )}

        {step === "Review" && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold">Review &amp; publish</h2>
            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="overflow-hidden rounded-2xl border">
                <div className="relative aspect-[16/10] bg-muted">
                  {images[primaryIdx] && (
                    <Image src={images[primaryIdx]} alt="" fill sizes="50vw" className="object-cover" />
                  )}
                  <div className="absolute left-3 top-3 flex gap-2">
                    <Badge variant="brand">{categoryName}</Badge>
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="font-display text-xl font-semibold">{title || "Untitled event"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {shortDescription || "Add a one-liner in step 1."}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {[venueName, town, district].filter(Boolean).join(", ") || "Add a venue"} ·{" "}
                    {date || "Pick a date"} · {time}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-base font-semibold">Tickets ({cur.code})</h3>
                <ul className="divide-y rounded-2xl border bg-background/40">
                  {packages.map((p, i) => (
                    <li key={i} className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-semibold">{p.name || `Package ${i + 1}`}</p>
                        <p className="text-xs text-muted-foreground">{p.qtyTotal} available</p>
                      </div>
                      <p className="font-semibold tabular-nums">{formatMoneyMajor(p.price, currency)}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 rounded-2xl border bg-muted/30 p-3 text-xs">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Commission {canEditCommission ? commission : defaultCommission}% · alert at{" "}
                  {salesThreshold} tickets
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <Button variant="ghost" onClick={prev} disabled={stepIndex === 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step !== "Review" ? (
            <Button variant="brand" onClick={next}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="brand" size="lg" onClick={handlePublish} disabled={submitting}>
              {submitting ? (
                "Submitting..."
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  {canEditCommission ? "Publish event" : "Submit for review"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  return (
    <ol className="flex w-full items-center gap-2 overflow-x-auto rounded-2xl border bg-card p-3">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
              active && "gradient-brand text-white shadow-md shadow-primary/20",
              done && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
              !active && !done && "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                active ? "bg-white/25 text-white" : done ? "bg-emerald-500/20" : "bg-muted"
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}
