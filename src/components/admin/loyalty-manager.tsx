"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Plus, Save, Search, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { LOYALTY_OFFER_STATUS_LABELS } from "@/lib/types";

type Settings = {
  loyaltyEnabled: boolean;
  loyaltyRequiresPassport: boolean;
  loyaltySpendMajorPerPoint: number;
};

type CardRow = {
  rfidCardId: string;
  passportNo: string;
  userName: string | null;
  userEmail: string | null;
  loyaltyPoints: number;
  internalCheckIns: number;
  externalVerifications: number;
  totalUsage: number;
};

type Offer = {
  id: string;
  title: string;
  description: string | null;
  pointsGrant: number;
  status: string;
  audienceMode: string;
  minTotalUsage: number | null;
  maxTotalUsage: number | null;
  minLoyaltyPoints: number | null;
  maxLoyaltyPoints: number | null;
  grantsCount: number;
  eligibleNow: number;
  grantCount: number;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "secondary" | "live"> = {
  ACTIVE: "success",
  DRAFT: "secondary",
  PAUSED: "warning",
  ENDED: "live",
};

export function LoyaltyManager({
  initialSettings,
  initialOffers,
}: {
  initialSettings: Settings;
  initialOffers: Offer[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [settings, setSettings] = React.useState(initialSettings);
  const [offers, setOffers] = React.useState(initialOffers);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pointsGrant, setPointsGrant] = React.useState(50);
  const [audienceMode, setAudienceMode] = React.useState<"ALL_CARDS" | "FILTERED">("ALL_CARDS");
  const [minUsage, setMinUsage] = React.useState("");
  const [maxUsage, setMaxUsage] = React.useState("");
  const [minPoints, setMinPoints] = React.useState("");
  const [maxPoints, setMaxPoints] = React.useState("");

  const [cardQuery, setCardQuery] = React.useState("");
  const [cards, setCards] = React.useState<CardRow[]>([]);
  const [searching, setSearching] = React.useState(false);

  const [adjEmail, setAdjEmail] = React.useState("");
  const [adjDelta, setAdjDelta] = React.useState(100);
  const [adjReason, setAdjReason] = React.useState("");
  const [adjusting, setAdjusting] = React.useState(false);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/loyalty/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't save", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      setSettings(data);
      toast({ title: "Loyalty rules updated" });
      router.refresh();
    } finally {
      setSavingSettings(false);
    }
  };

  const createOffer = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/loyalty/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          pointsGrant,
          status: "DRAFT",
          audienceMode,
          minTotalUsage: minUsage ? Number(minUsage) : null,
          maxTotalUsage: maxUsage ? Number(maxUsage) : null,
          minLoyaltyPoints: minPoints ? Number(minPoints) : null,
          maxLoyaltyPoints: maxPoints ? Number(maxPoints) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't create offer", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Offer created", description: "Activate it when ready to grant rewards." });
      setTitle("");
      setDescription("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const updateOfferStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/loyalty/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Update failed", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      toast({ title: `Offer ${status.toLowerCase()}` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const grantAll = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/loyalty/offers/${id}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Grant failed", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      const ok = data.results?.filter((r: { ok: boolean }) => r.ok).length ?? 0;
      toast({ title: "Rewards granted", description: `${ok} of ${data.eligible} eligible cards.` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const previewEligible = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/loyalty/offers/${id}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Preview failed", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Eligible cards", description: `${data.count} passport(s) match this offer right now.` });
    } finally {
      setBusyId(null);
    }
  };

  const searchCards = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/loyalty/cards?q=${encodeURIComponent(cardQuery)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Search failed", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      setCards(data.cards ?? []);
    } finally {
      setSearching(false);
    }
  };

  const adjustPoints = async () => {
    if (!adjEmail.trim() || !adjReason.trim()) return;
    setAdjusting(true);
    try {
      const res = await fetch("/api/admin/loyalty/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adjEmail.trim(), delta: adjDelta, reason: adjReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Adjustment failed", description: data?.error ?? "Try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Points updated" });
      setAdjReason("");
      router.refresh();
    } finally {
      setAdjusting(false);
    }
  };

  React.useEffect(() => {
    setOffers(initialOffers);
  }, [initialOffers]);

  React.useEffect(() => {
    void searchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Earn rules</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Control how members earn points on ticket purchases. Usage counts combine gate check-ins on
              our platform plus successful partner verification taps on external ticketing platforms.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.loyaltyEnabled}
                  onChange={(e) => setSettings((s) => ({ ...s, loyaltyEnabled: e.target.checked }))}
                />
                Loyalty enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.loyaltyRequiresPassport}
                  onChange={(e) => setSettings((s) => ({ ...s, loyaltyRequiresPassport: e.target.checked }))}
                />
                Requires Entertain Passport
              </label>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  LKR spent per 1 point
                </label>
                <Input
                  type="number"
                  min={1}
                  value={settings.loyaltySpendMajorPerPoint}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, loyaltySpendMajorPerPoint: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <Button className="mt-4" variant="brand" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save earn rules
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Create offer</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Target all active passports or filter by card usage count and current point balance.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Input placeholder="Offer title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            type="number"
            placeholder="Bonus points to grant"
            value={pointsGrant}
            onChange={(e) => setPointsGrant(Number(e.target.value))}
          />
          <Input
            className="lg:col-span-2"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={audienceMode}
            onChange={(e) => setAudienceMode(e.target.value as "ALL_CARDS" | "FILTERED")}
          >
            <option value="ALL_CARDS">All active Entertain Passports</option>
            <option value="FILTERED">Filtered by usage / points</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Min total usage" value={minUsage} onChange={(e) => setMinUsage(e.target.value)} />
            <Input placeholder="Max total usage" value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} />
            <Input placeholder="Min loyalty points" value={minPoints} onChange={(e) => setMinPoints(e.target.value)} />
            <Input placeholder="Max loyalty points" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" variant="brand" onClick={createOffer} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create offer
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Offers</h2>
        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offers yet.</p>
        ) : (
          offers.map((o) => (
            <div key={o.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{o.title}</h3>
                    <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>
                      {LOYALTY_OFFER_STATUS_LABELS[o.status as keyof typeof LOYALTY_OFFER_STATUS_LABELS] ?? o.status}
                    </Badge>
                    <Badge variant="secondary">{o.audienceMode === "ALL_CARDS" ? "All cards" : "Filtered"}</Badge>
                  </div>
                  {o.description && <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>}
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{o.pointsGrant}</span> bonus pts · granted{" "}
                    <span className="font-medium">{o.grantsCount}</span> · eligible now{" "}
                    <span className="font-medium">{o.eligibleNow}</span>
                  </p>
                  {(o.minTotalUsage != null || o.maxTotalUsage != null) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Usage filter: {o.minTotalUsage ?? 0}–{o.maxTotalUsage ?? "∞"} total taps
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.status !== "ACTIVE" && (
                    <Button size="sm" variant="secondary" disabled={busyId === o.id} onClick={() => updateOfferStatus(o.id, "ACTIVE")}>
                      Activate
                    </Button>
                  )}
                  {o.status === "ACTIVE" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => previewEligible(o.id)}>
                        Preview eligible
                      </Button>
                      <Button size="sm" variant="brand" disabled={busyId === o.id} onClick={() => grantAll(o.id)}>
                        Grant to all eligible
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busyId === o.id} onClick={() => updateOfferStatus(o.id, "PAUSED")}>
                        Pause
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Manual point adjustment</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input placeholder="Member email" value={adjEmail} onChange={(e) => setAdjEmail(e.target.value)} />
          <Input type="number" placeholder="Delta (+/-)" value={adjDelta} onChange={(e) => setAdjDelta(Number(e.target.value))} />
          <Input placeholder="Reason" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
        </div>
        <Button className="mt-3" variant="brand" onClick={adjustPoints} disabled={adjusting}>
          {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Apply adjustment
        </Button>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search passports
            </label>
            <Input
              placeholder="Passport no., email, name..."
              value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCards()}
            />
          </div>
          <Button variant="secondary" onClick={searchCards} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Passport</th>
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3 text-right">Points</th>
                <th className="py-2 pr-3 text-right">Our check-ins</th>
                <th className="py-2 pr-3 text-right">Partner taps</th>
                <th className="py-2 text-right">Total usage</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.rfidCardId} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{c.passportNo}</td>
                  <td className="py-2 pr-3">
                    <div>{c.userName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.userEmail ?? ""}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.loyaltyPoints}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.internalCheckIns}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.externalVerifications}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{c.totalUsage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
