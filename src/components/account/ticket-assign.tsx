"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export function TicketAssign({ ticketId, holder }: { ticketId: string; holder: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"passport" | "nic">("passport");
  const [value, setValue] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const save = async (reset = false) => {
    setBusy(true);
    try {
      const body = reset
        ? {}
        : mode === "passport"
        ? { passportNo: value, name }
        : { nic: value, name };
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't assign", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: reset ? "Reassigned to you" : "Ticket assigned", description: data.holder });
      setOpen(false);
      setValue("");
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        <UserPlus className="h-3.5 w-3.5" /> Holder: {holder} (change)
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border bg-muted/20 p-3">
          <div className="flex gap-2 text-xs">
            <button
              className={mode === "passport" ? "font-semibold text-primary" : "text-muted-foreground"}
              onClick={() => setMode("passport")}
            >
              By passport no.
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              className={mode === "nic" ? "font-semibold text-primary" : "text-muted-foreground"}
              onClick={() => setMode("nic")}
            >
              By NIC
            </button>
          </div>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "passport" ? "EP-XXXX-XXXX" : "Friend's NIC number"}
            className="h-8"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's name (optional)"
            className="h-8"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="brand" disabled={busy || !value} onClick={() => save(false)}>
              Assign
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(true)}>
              Reset to me
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
