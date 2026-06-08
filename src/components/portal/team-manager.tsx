"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Assignment = { staffId: string; eventId: string; eventTitle: string; role: string };
type Staff = { userId: string; name: string | null; email: string; assignments: Assignment[] };
type EventLite = { id: string; title: string };

export function TeamManager({
  orgName,
  events,
  staff,
  serviceConfigured,
}: {
  orgName: string;
  events: EventLite[];
  staff: Staff[];
  serviceConfigured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [assignSel, setAssignSel] = React.useState<Record<string, string>>({});

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/portal/team/gate-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add gate staff", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Gate staff added", description: email });
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string) => {
    if (!confirm("Delete this gate-staff account? This removes their access entirely.")) return;
    const res = await fetch(`/api/portal/team/gate-staff/${userId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't delete", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Gate staff removed" });
    router.refresh();
  };

  const resetPassword = async (userId: string) => {
    const pw = prompt("New password (min 6 characters):");
    if (!pw) return;
    const res = await fetch(`/api/portal/team/gate-staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't update", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated" });
  };

  const assign = async (userId: string) => {
    const eventId = assignSel[userId];
    if (!eventId) return;
    const res = await fetch(`/api/events/${eventId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: "SCANNER" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't assign", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Assigned to event" });
    setAssignSel((m) => ({ ...m, [userId]: "" }));
    router.refresh();
  };

  const unassign = async (eventId: string, staffId: string) => {
    const res = await fetch(`/api/events/${eventId}/staff`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId }),
    });
    if (!res.ok) {
      toast({ title: "Couldn't remove from event", variant: "destructive" });
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {!serviceConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            Creating gate-staff accounts is disabled until the platform admin sets{" "}
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>. You can still assign existing
            gate staff to events below.
          </p>
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserPlus className="h-4 w-4 text-primary" /> Add gate staff to {orgName}
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@work.com" type="email" />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temp password"
            type="text"
          />
          <Button
            variant="brand"
            onClick={create}
            disabled={busy || !serviceConfigured || !name || !email || password.length < 6}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <div className="space-y-3">
        {staff.map((s) => (
          <div key={s.userId} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{s.name ?? s.email}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => resetPassword(s.userId)}>
                  Reset password
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(s.userId)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned events
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.assignments.length === 0 && (
                  <span className="text-sm text-muted-foreground">Not assigned to any event.</span>
                )}
                {s.assignments.map((a) => (
                  <Badge key={a.staffId} variant="secondary" className="gap-1">
                    {a.eventTitle}
                    <button onClick={() => unassign(a.eventId, a.staffId)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <select
                  value={assignSel[s.userId] ?? ""}
                  onChange={(e) => setAssignSel((m) => ({ ...m, [s.userId]: e.target.value }))}
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Assign to event…</option>
                  {events
                    .filter((ev) => !s.assignments.some((a) => a.eventId === ev.id))
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => assign(s.userId)} disabled={!assignSel[s.userId]}>
                  Assign
                </Button>
              </div>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No gate staff yet. Add your first above.
          </div>
        )}
      </div>
    </div>
  );
}
