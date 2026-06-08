"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Card = {
  id: string;
  uid: string;
  passportNo: string;
  label: string | null;
  status: string;
  assignedEmail: string | null;
  assignedName: string | null;
};

const STATUS_VARIANT: Record<string, "success" | "outline" | "warning" | "secondary"> = {
  ACTIVE: "success",
  UNASSIGNED: "outline",
  BLOCKED: "warning",
  LOST: "secondary",
};

export function RfidManager({ initial }: { initial: Card[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [uid, setUid] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [assignEmail, setAssignEmail] = React.useState<Record<string, string>>({});

  const program = async () => {
    if (!uid.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/rfid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid.trim(), label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't program", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Passport programmed", description: data.card?.passportNo });
      setUid("");
      setLabel("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, action: string, email?: string) => {
    const res = await fetch(`/api/admin/rfid/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Action failed", description: data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Card updated" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Plus className="h-4 w-4 text-primary" /> Program a passport
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the NFC/RFID chip UID. A passport number is generated automatically.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.5fr_auto]">
          <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Chip UID e.g. 04A1B2C3D4E5" className="font-mono sm:col-span-2 lg:col-span-1" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
          <Button variant="brand" onClick={program} disabled={busy || !uid.trim()} className="w-full sm:w-auto">
            <CreditCard className="h-4 w-4" /> Program
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Passport</th>
              <th className="px-4 py-3 text-left">Chip UID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Holder</th>
              <th className="px-4 py-3 text-left">Assign / actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {initial.map((c) => (
              <tr key={c.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3 font-mono font-medium">{c.passportNo}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.uid}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.assignedName ?? c.assignedEmail ?? "-"}
                  {c.assignedEmail && <div className="text-[11px]">{c.assignedEmail}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!c.assignedEmail ? (
                      <>
                        <Input
                          value={assignEmail[c.id] ?? ""}
                          onChange={(e) => setAssignEmail((m) => ({ ...m, [c.id]: e.target.value }))}
                          placeholder="user@email"
                          className="h-8 w-40"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => act(c.id, "assign", assignEmail[c.id])}
                          disabled={!assignEmail[c.id]}
                        >
                          <UserPlus className="h-4 w-4" /> Assign
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => act(c.id, "unassign")}>
                        Unassign
                      </Button>
                    )}
                    {c.status !== "BLOCKED" ? (
                      <Button variant="ghost" size="sm" onClick={() => act(c.id, "block")}>
                        Block
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => act(c.id, "activate")}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
