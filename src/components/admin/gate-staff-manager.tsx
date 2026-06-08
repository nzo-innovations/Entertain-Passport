"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Assignment = {
  staffId: string;
  eventId: string;
  eventTitle: string;
  organizationId: string;
  organizationName: string;
  role: string;
};

type Staff = {
  userId: string;
  name: string | null;
  email: string;
  organizations: { id: string; name: string }[];
  assignments: Assignment[];
};

type Org = { id: string; name: string };
type EventLite = { id: string; title: string; organizationId: string; organizationName: string };

export function AdminGateStaffManager({
  organizations,
  events,
  staff,
  serviceConfigured,
}: {
  organizations: Org[];
  events: EventLite[];
  staff: Staff[];
  serviceConfigured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [organizationId, setOrganizationId] = React.useState(organizations[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [assignSel, setAssignSel] = React.useState<Record<string, string>>({});

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/gate-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't add gate staff", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Gate staff added", description: `${email} → ${organizations.find((o) => o.id === organizationId)?.name}` });
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
    const res = await fetch(`/api/admin/gate-staff/${userId}`, { method: "DELETE" });
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
    const res = await fetch(`/api/admin/gate-staff/${userId}`, {
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

  const rename = async (userId: string, currentName: string | null) => {
    const next = prompt("Full name:", currentName ?? "");
    if (!next || next.trim().length < 2) return;
    const res = await fetch(`/api/admin/gate-staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't update", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Name updated" });
    router.refresh();
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

  const eventsForStaff = (orgIds: string[]) =>
    events.filter((ev) => orgIds.includes(ev.organizationId));

  return (
    <div className="space-y-6">
      {!serviceConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            Account creation needs <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in the server
            environment. You can still assign existing gate staff to events below.
          </p>
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserPlus className="h-4 w-4 text-primary" /> Add gate staff on behalf of an organization
        </h2>
        <div className="mt-4 grid gap-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Select organization…</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
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
            disabled={busy || !serviceConfigured || !organizationId || !name || !email || password.length < 6}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Gate staff</th>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Assigned events</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staff.map((s) => {
              const orgIds = s.organizations.map((o) => o.id);
              const assignable = eventsForStaff(orgIds).filter(
                (ev) => !s.assignments.some((a) => a.eventId === ev.id)
              );
              return (
                <tr key={s.userId} className="align-top hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.name ?? s.email}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {s.organizations.map((o) => (
                        <Link
                          key={o.id}
                          href={`/admin/organizations/${o.id}`}
                          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs hover:bg-accent"
                        >
                          <Building2 className="h-3 w-3 text-primary" />
                          {o.name}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {s.assignments.length === 0 && (
                        <span className="text-muted-foreground">No events assigned</span>
                      )}
                      {s.assignments.map((a) => (
                        <Badge key={a.staffId} variant="secondary" className="gap-1 font-normal">
                          <span className="max-w-[140px] truncate">{a.eventTitle}</span>
                          <span className="text-[10px] text-muted-foreground">({a.organizationName})</span>
                          <button
                            type="button"
                            onClick={() => unassign(a.eventId, a.staffId)}
                            className="hover:text-destructive"
                            aria-label={`Remove from ${a.eventTitle}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        value={assignSel[s.userId] ?? ""}
                        onChange={(e) => setAssignSel((m) => ({ ...m, [s.userId]: e.target.value }))}
                        className="h-8 max-w-xs rounded-lg border bg-background px-2 text-xs"
                      >
                        <option value="">Assign to event…</option>
                        {assignable.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.organizationName} · {ev.title}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => assign(s.userId)}
                        disabled={!assignSel[s.userId]}
                      >
                        Assign
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => rename(s.userId, s.name)}>
                        Edit name
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => resetPassword(s.userId)}>
                        Reset password
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(s.userId)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {staff.length === 0 && (
          <div className="border-t p-10 text-center text-muted-foreground">
            No gate staff on the platform yet. Add the first account above.
          </div>
        )}
      </div>
    </div>
  );
}
