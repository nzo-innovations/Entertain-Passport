"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { FREE_STAFF_PER_EVENT } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type StaffRow = {
  id: string;
  role: string;
  isBillable: boolean;
  user: { id: string; name: string | null; email: string };
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  SCANNER: "Gate staff / Scanner",
  DOOR_MANAGER: "Gate manager",
  EVENT_MANAGER: "Event manager",
};

export function EventStaffManager({
  eventId,
  staff: initial,
  availableWorkers,
  extraFeeCents,
}: {
  eventId: string;
  staff: StaffRow[];
  availableWorkers: { id: string; name: string | null; email: string }[];
  extraFeeCents: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [staff, setStaff] = React.useState(initial);
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState("SCANNER");

  const billable = staff.filter((s) => s.isBillable).length;
  const freeUsed = Math.min(staff.length, FREE_STAFF_PER_EVENT);

  const add = async () => {
    if (!userId) return;
    const res = await fetch(`/api/events/${eventId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Failed", description: data.error, variant: "destructive" });
      return;
    }
    setStaff((s) => [...s, data.staff]);
    setUserId("");
    toast({
      title: "Staff assigned",
      description: data.staff.isBillable
        ? `Billable slot - +${formatCurrency(extraFeeCents / 100)}/mo`
        : "Included in free allowance",
    });
    router.refresh();
  };

  const remove = async (staffId: string) => {
    await fetch(`/api/events/${eventId}/staff`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId }),
    });
    setStaff((s) => s.filter((x) => x.id !== staffId));
    router.refresh();
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="h-5 w-5 text-primary" />
            Event staff
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            First {FREE_STAFF_PER_EVENT} staff free per event. Each additional:{" "}
            {formatCurrency(extraFeeCents / 100)}/month.
          </p>
        </div>
        <Badge variant={billable > 0 ? "warning" : "success"}>
          {freeUsed}/{FREE_STAFF_PER_EVENT} free used
          {billable > 0 && ` · ${billable} billable`}
        </Badge>
      </div>

      <ul className="mt-4 space-y-2">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-xl border bg-background/50 p-3">
            <div>
              <p className="text-sm font-medium">{s.user.name ?? s.user.email}</p>
              <p className="text-xs text-muted-foreground">
                {STAFF_ROLE_LABELS[s.role] ?? s.role.replace("_", " ")} {s.isBillable && "· billable"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </li>
        ))}
        {staff.length === 0 && (
          <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No gate staff assigned yet. Add gate staff / scanners for event-day check-in.
          </li>
        )}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">Select worker…</option>
          {availableWorkers
            .filter((w) => !staff.some((s) => s.user.id === w.id))
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.name ?? w.email}
              </option>
            ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="SCANNER">Gate staff / Scanner</option>
          <option value="DOOR_MANAGER">Gate manager</option>
          <option value="EVENT_MANAGER">Event manager</option>
        </select>
        <Button variant="outline" onClick={add} disabled={!userId}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
