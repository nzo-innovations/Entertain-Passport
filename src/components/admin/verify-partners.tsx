"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Plus, ShieldCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatMoney, toMajor, toMinor } from "@/lib/money";

type Plan = {
  code: string;
  name: string;
  unitPriceMinor: number;
  currency: string;
  monthlyQuota: number | null;
  rateLimitRpm: number;
};

type Key = {
  id: string;
  keyId: string;
  label: string | null;
  status: string;
  lastUsedAt: string | null;
  ipAllowlist: string | null;
  rateLimitRpm: number | null;
};

type Partner = {
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string | null;
  planName: string | null;
  limits: { unitPriceMinor: number; monthlyQuota: number | null; rateLimitRpm: number; currency: string; includedAllowance: number };
  overrides: { unitPriceMinor: number | null; monthlyQuota: number | null; rateLimitRpm: number | null };
  hasConsent: boolean;
  consentVersion: string | null;
  consentLegalBasis: string | null;
  activeKeys: number;
  totalKeys: number;
  keys: Key[];
  usage: { count: number; billable: number; amountMinor: number };
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  REVOKED: "secondary",
};

export function VerifyPartnersManager({ partners, plans }: { partners: Partner[]; plans: Plan[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [planCode, setPlanCode] = React.useState(plans[0]?.code ?? "");
  const [busy, setBusy] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<{ keyId: string; secret: string } | null>(null);

  const createPartner = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/verify/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactEmail, planCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't create partner", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Partner created", description: data.partner?.name });
      setName("");
      setContactEmail("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Plus className="h-4 w-4 text-primary" /> Onboard a partner
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner name" />
          <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email (optional)" />
          <select
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} · {formatMoney(p.unitPriceMinor, p.currency)}/tap
              </option>
            ))}
          </select>
          <Button variant="brand" onClick={createPartner} disabled={busy || !name.trim()}>
            <Building2 className="h-4 w-4" /> Create
          </Button>
        </div>
      </section>

      <div className="space-y-3">
        {partners.map((p) => (
          <PartnerCard
            key={p.id}
            partner={p}
            plans={plans}
            open={openId === p.id}
            onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
            onSecret={(s) => setSecret(s)}
          />
        ))}
        {partners.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            No partners yet. Onboard your first B2B consumer above.
          </div>
        )}
      </div>

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
    </div>
  );
}

function PartnerCard({
  partner,
  plans,
  open,
  onToggle,
  onSecret,
}: {
  partner: Partner;
  plans: Plan[];
  open: boolean;
  onToggle: () => void;
  onSecret: (s: { keyId: string; secret: string }) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const patchPartner = async (body: Record<string, unknown>, okMsg: string) => {
    const res = await fetch(`/api/admin/verify/partners/${partner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Update failed", description: data?.error, variant: "destructive" });
      return false;
    }
    toast({ title: okMsg });
    router.refresh();
    return true;
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{partner.name}</span>
            <Badge variant={STATUS_VARIANT[partner.status] ?? "secondary"}>{partner.status}</Badge>
            {partner.hasConsent ? (
              <Badge variant="success" className="gap-1"><ShieldCheck className="h-3 w-3" /> Consent {partner.consentVersion}</Badge>
            ) : (
              <Badge variant="warning">No consent on file</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {partner.planName ?? "No plan"} · {formatMoney(partner.limits.unitPriceMinor, partner.limits.currency)}/tap ·
            {partner.limits.monthlyQuota === null ? " unlimited" : ` ${partner.limits.monthlyQuota.toLocaleString()}/mo`} ·
            {` ${partner.limits.rateLimitRpm} rpm · ${partner.activeKeys}/${partner.totalKeys} keys active`}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{partner.usage.billable.toLocaleString()} billable</div>
          <div>{formatMoney(partner.usage.amountMinor, partner.limits.currency)}</div>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t bg-muted/10 px-5 py-5">
          <PlanAndStatus partner={partner} plans={plans} onPatch={patchPartner} />
          <Overrides partner={partner} onPatch={patchPartner} />
          <Consent partner={partner} />
          <Keys partner={partner} onSecret={onSecret} />
        </div>
      )}
    </div>
  );
}

function PlanAndStatus({
  partner,
  plans,
  onPatch,
}: {
  partner: Partner;
  plans: Plan[];
  onPatch: (body: Record<string, unknown>, okMsg: string) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</span>
      <select
        defaultValue={partner.planCode ?? ""}
        onChange={(e) => onPatch({ planCode: e.target.value || null }, "Plan updated")}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">No plan</option>
        {plans.map((p) => (
          <option key={p.code} value={p.code}>{p.name}</option>
        ))}
      </select>
      <div className="ml-auto flex gap-2">
        {partner.status === "ACTIVE" ? (
          <Button variant="outline" size="sm" onClick={() => onPatch({ status: "SUSPENDED" }, "Partner suspended")}>
            Suspend
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onPatch({ status: "ACTIVE" }, "Partner reactivated")}>
            Reactivate
          </Button>
        )}
      </div>
    </div>
  );
}

function Overrides({
  partner,
  onPatch,
}: {
  partner: Partner;
  onPatch: (body: Record<string, unknown>, okMsg: string) => Promise<boolean>;
}) {
  const [price, setPrice] = React.useState(
    partner.overrides.unitPriceMinor != null ? String(toMajor(partner.overrides.unitPriceMinor)) : ""
  );
  const [quota, setQuota] = React.useState(partner.overrides.monthlyQuota != null ? String(partner.overrides.monthlyQuota) : "");
  const [rpm, setRpm] = React.useState(partner.overrides.rateLimitRpm != null ? String(partner.overrides.rateLimitRpm) : "");

  const save = () =>
    onPatch(
      {
        overrideUnitPriceMinor: price.trim() === "" ? null : toMinor(Number(price)),
        overrideMonthlyQuota: quota.trim() === "" ? null : Math.max(0, Math.floor(Number(quota))),
        overrideRateLimitRpm: rpm.trim() === "" ? null : Math.max(1, Math.floor(Number(rpm))),
      },
      "Per-partner pricing saved"
    );

  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Per-partner overrides (blank = inherit plan)
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Unit price ({partner.limits.currency}/tap)
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="inherit" className="mt-1 h-9" />
        </label>
        <label className="text-xs">
          Monthly quota
          <Input value={quota} onChange={(e) => setQuota(e.target.value)} inputMode="numeric" placeholder="inherit" className="mt-1 h-9" />
        </label>
        <label className="text-xs">
          Rate limit (rpm)
          <Input value={rpm} onChange={(e) => setRpm(e.target.value)} inputMode="numeric" placeholder="inherit" className="mt-1 h-9" />
        </label>
      </div>
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={save}>Save pricing</Button>
      </div>
    </div>
  );
}

function Consent({ partner }: { partner: Partner }) {
  const router = useRouter();
  const { toast } = useToast();
  const [version, setVersion] = React.useState(partner.consentVersion ?? "2026-06-v1");
  const [legalBasis, setLegalBasis] = React.useState(partner.consentLegalBasis ?? "CONTRACT");
  const [acceptedBy, setAcceptedBy] = React.useState("");

  const record = async () => {
    const res = await fetch(`/api/admin/verify/partners/${partner.id}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termsVersion: version, legalBasis, acceptedByName: acceptedBy, sharedFields: ["validation_status"] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't record consent", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Consent recorded" });
    router.refresh();
  };

  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Data-sharing & consent (returns validation status only)
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Terms version
          <Input value={version} onChange={(e) => setVersion(e.target.value)} className="mt-1 h-9" />
        </label>
        <label className="text-xs">
          Legal basis
          <select value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="CONTRACT">Contract</option>
            <option value="CONSENT">Consent</option>
            <option value="LEGITIMATE_INTEREST">Legitimate interest</option>
          </select>
        </label>
        <label className="text-xs">
          Accepted by
          <Input value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} placeholder="Name / title" className="mt-1 h-9" />
        </label>
      </div>
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={record}>Record acceptance</Button>
      </div>
    </div>
  );
}

function Keys({ partner, onSecret }: { partner: Partner; onSecret: (s: { keyId: string; secret: string }) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [label, setLabel] = React.useState("");
  const [ipAllowlist, setIpAllowlist] = React.useState("");

  const issue = async () => {
    const res = await fetch(`/api/admin/verify/partners/${partner.id}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, ipAllowlist }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't issue key", description: data?.error, variant: "destructive" });
      return;
    }
    onSecret({ keyId: data.keyId, secret: data.secret });
    setLabel("");
    setIpAllowlist("");
    router.refresh();
  };

  const keyAction = async (id: string, action: string) => {
    const res = await fetch(`/api/admin/verify/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Action failed", description: data?.error, variant: "destructive" });
      return;
    }
    if (action === "rotate" && data.secret) onSecret({ keyId: data.keyId, secret: data.secret });
    else toast({ title: "Key updated" });
    router.refresh();
  };

  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <KeyRound className="h-4 w-4" /> API keys (scope: verify:tap)
      </p>

      <div className="mt-3 space-y-2">
        {partner.keys.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <span className="font-mono text-xs">{k.keyId}</span>
            {k.label && <span className="text-xs text-muted-foreground">· {k.label}</span>}
            <Badge variant={STATUS_VARIANT[k.status] ?? "secondary"}>{k.status}</Badge>
            <span className="text-[11px] text-muted-foreground">
              {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : "never used"}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => keyAction(k.id, "rotate")}>Rotate</Button>
              {k.status === "ACTIVE" ? (
                <Button variant="ghost" size="sm" onClick={() => keyAction(k.id, "revoke")}>Revoke</Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => keyAction(k.id, "activate")}>Activate</Button>
              )}
            </div>
          </div>
        ))}
        {partner.keys.length === 0 && <p className="text-xs text-muted-foreground">No keys issued yet.</p>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1.6fr_auto]">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Key label (optional)" className="h-9" />
        <Input value={ipAllowlist} onChange={(e) => setIpAllowlist(e.target.value)} placeholder="IP allowlist CIDRs (optional)" className="h-9 font-mono text-xs" />
        <Button variant="brand" size="sm" onClick={issue}>Issue key</Button>
      </div>
    </div>
  );
}

function SecretDialog({ secret, onClose }: { secret: { keyId: string; secret: string } | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      {secret && (
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Signing secret — shown once</DialogTitle>
            <DialogDescription>
              Copy and share this securely with the partner. It cannot be retrieved again; if lost,
              rotate the key to issue a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Key ID</p>
              <p className="font-mono text-sm">{secret.keyId}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Secret</p>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <code className="flex-1 break-all text-xs">{secret.secret}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(secret.secret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
