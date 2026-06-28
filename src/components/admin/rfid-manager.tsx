"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Copy,
  CreditCard,
  Plus,
  RefreshCw,
  ShieldBan,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type { NfcAnalyticsSummary } from "@/lib/nfc/analytics";

type Card = {
  id: string;
  uid: string;
  passportId: string;
  passportNo: string;
  label: string | null;
  status: string;
  keyVersion: number;
  counter: number;
  issuedAt: string;
  assignedEmail: string | null;
  assignedName: string | null;
  orderId: string | null;
};

type PendingOrder = {
  id: string;
  userEmail: string;
  userName: string | null;
  quantity: number;
  fulfilledCount: number;
  status: string;
};

const STATUS_VARIANT: Record<string, "success" | "outline" | "warning" | "secondary"> = {
  ACTIVE: "success",
  UNASSIGNED: "outline",
  BLOCKED: "warning",
  LOST: "secondary",
};

export function RfidManager({
  initial,
  pendingOrders,
  analytics,
}: {
  initial: Card[];
  pendingOrders: PendingOrder[];
  analytics: NfcAnalyticsSummary;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [uid, setUid] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [assignEmail, setAssignEmail] = React.useState<Record<string, string>>({});
  const [reprogramUid, setReprogramUid] = React.useState<Record<string, string>>({});
  const [replaceUid, setReplaceUid] = React.useState<Record<string, string>>({});
  const [orderUid, setOrderUid] = React.useState<Record<string, string>>({});
  const [lastTagPayload, setLastTagPayload] = React.useState<string | null>(null);

  const copyPayload = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied tag payload", description: "Write this JSON to the NFC chip." });
  };

  const program = async (opts?: { orderId?: string; reprogramCardId?: string; cardUid?: string }) => {
    const chipUid = (opts?.cardUid ?? uid).trim();
    if (!chipUid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/nfc/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardUid: chipUid,
          label: label || undefined,
          email: email || undefined,
          orderId: opts?.orderId,
          reprogramCardId: opts?.reprogramCardId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't program", description: data?.reason ?? data?.error, variant: "destructive" });
        return;
      }
      const payloadJson = JSON.stringify(data.tagPayload, null, 2);
      setLastTagPayload(payloadJson);
      toast({
        title: opts?.reprogramCardId ? "Passport reprogrammed" : "Passport programmed",
        description: data.card?.passportNo,
      });
      setUid("");
      setLabel("");
      setEmail("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, action: string, extra?: { email?: string; newCardUid?: string }) => {
    const res = await fetch(`/api/admin/nfc/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email: extra?.email, newCardUid: extra?.newCardUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Action failed", description: data?.error, variant: "destructive" });
      return;
    }
    if (data.tagPayload) {
      setLastTagPayload(JSON.stringify(data.tagPayload, null, 2));
      toast({ title: "New tag payload ready", description: "Copy and write to the replacement chip." });
    } else {
      toast({ title: "Card updated" });
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Total cards</p>
          <p className="font-display text-2xl font-bold">{analytics.totalCards}</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Allows (24h)</p>
          <p className="font-display text-2xl font-bold text-emerald-600">{analytics.scans24h.allow}</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Denials (24h)</p>
          <p className="font-display text-2xl font-bold text-red-600">{analytics.scans24h.deny}</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Pending orders</p>
          <p className="font-display text-2xl font-bold">{analytics.pendingOrders}</p>
        </div>
      </section>

      {pendingOrders.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Fulfill passport orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Program NFC tags for paid customer orders. The customer is assigned automatically.
          </p>
          <ul className="mt-4 space-y-3">
            {pendingOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{o.userName ?? o.userEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.fulfilledCount}/{o.quantity} fulfilled · {o.status}
                  </p>
                </div>
                <Input
                  value={orderUid[o.id] ?? ""}
                  onChange={(e) => setOrderUid((m) => ({ ...m, [o.id]: e.target.value }))}
                  placeholder="Chip UID"
                  className="h-8 w-40 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="brand"
                  disabled={busy || !orderUid[o.id]?.trim() || o.fulfilledCount >= o.quantity}
                  onClick={() => program({ orderId: o.id, cardUid: orderUid[o.id] })}
                >
                  Program & assign
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Plus className="h-4 w-4 text-primary" /> Manual program
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the NFC chip UID. A UUID passport ID and HMAC signature are generated server-side.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1.2fr_auto]">
          <Input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Chip UID e.g. 04A1B2C3D4E5"
            className="font-mono sm:col-span-2 lg:col-span-1"
          />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Assign email (optional)"
            type="email"
          />
          <Button variant="brand" onClick={() => program()} disabled={busy || !uid.trim()} className="w-full sm:w-auto">
            <CreditCard className="h-4 w-4" /> Program
          </Button>
        </div>
      </section>

      {lastTagPayload && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold">Tag payload - write to NFC chip</h3>
            <Button size="sm" variant="outline" onClick={() => copyPayload(lastTagPayload)}>
              <Copy className="h-3.5 w-3.5" /> Copy JSON
            </Button>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
            {lastTagPayload}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Contains only passportId, cardUid, keyVersion, issuedAt, counter, and signature. No PII.
          </p>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Passport</th>
                <th className="px-4 py-3 text-left">Passport ID</th>
                <th className="px-4 py-3 text-left">Chip UID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Holder</th>
                <th className="px-4 py-3 text-left">Crypto</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initial.map((c) => (
                <tr key={c.id} className="align-top hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-medium">{c.passportNo}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{c.passportId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.uid}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.assignedName ?? c.assignedEmail ?? "-"}
                    {c.assignedEmail && <div className="text-[11px]">{c.assignedEmail}</div>}
                    {c.orderId && <div className="text-[10px] text-primary">Order linked</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    v{c.keyVersion} · cnt {c.counter}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-xs flex-col gap-2">
                      {!c.assignedEmail ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Input
                            value={assignEmail[c.id] ?? ""}
                            onChange={(e) => setAssignEmail((m) => ({ ...m, [c.id]: e.target.value }))}
                            placeholder="user@email"
                            className="h-8 w-36"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => act(c.id, "assign", { email: assignEmail[c.id] })}
                            disabled={!assignEmail[c.id]}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => act(c.id, "unassign")}>
                          Unassign
                        </Button>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {c.status !== "BLOCKED" && c.status !== "LOST" && (
                          <Button variant="ghost" size="sm" onClick={() => act(c.id, "report_lost_temp")}>
                            <ShieldBan className="h-3.5 w-3.5" /> Temp block
                          </Button>
                        )}
                        {c.status === "BLOCKED" && (
                          <Button variant="ghost" size="sm" onClick={() => act(c.id, "activate")}>
                            Reactivate
                          </Button>
                        )}
                        {c.status !== "LOST" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => act(c.id, "report_lost_permanent")}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" /> Decline
                          </Button>
                        )}
                      </div>

                      {c.status !== "LOST" && (
                        <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                          <Input
                            value={reprogramUid[c.id] ?? ""}
                            onChange={(e) => setReprogramUid((m) => ({ ...m, [c.id]: e.target.value }))}
                            placeholder="New UID reprogram"
                            className="h-8 w-32 font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!reprogramUid[c.id]?.trim()}
                            onClick={() =>
                              act(c.id, "reprogram", { newCardUid: reprogramUid[c.id] })
                            }
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {c.status === "LOST" && (
                        <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                          <Input
                            value={replaceUid[c.id] ?? ""}
                            onChange={(e) => setReplaceUid((m) => ({ ...m, [c.id]: e.target.value }))}
                            placeholder="Replacement UID"
                            className="h-8 w-32 font-mono text-xs"
                          />
                          <Button
                            variant="brand"
                            size="sm"
                            disabled={!replaceUid[c.id]?.trim()}
                            onClick={() => act(c.id, "replace", { newCardUid: replaceUid[c.id] })}
                          >
                            Issue new tag
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {initial.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No passports programmed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
