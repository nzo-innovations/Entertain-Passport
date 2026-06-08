"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type Row = {
  id: string;
  holder: string;
  packageName: string;
  code: string;
  passportNo: string | null;
  checkedInAt: string | null;
};

export function CheckInManager({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gate/search?eventId=${eventId}&q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        setRows(data.tickets ?? []);
      } finally {
        setLoading(false);
      }
    },
    [eventId]
  );

  React.useEffect(() => {
    void load("");
  }, [load]);

  const rollback = async (ticketId: string) => {
    if (!confirm("Roll back this check-in? The ticket becomes valid again.")) return;
    setBusyId(ticketId);
    try {
      const res = await fetch("/api/gate/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't roll back", description: data?.error, variant: "destructive" });
        return;
      }
      toast({ title: "Check-in rolled back" });
      setRows((r) => r.filter((x) => x.id !== ticketId));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
        <RotateCcw className="h-5 w-5 text-primary" /> Check-ins &amp; rollback
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        As an event manager you can reverse a wrong check-in here.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            void load(e.target.value);
          }}
          placeholder="Search by name, code or passport"
          className="h-9"
        />
      </div>

      <ul className="mt-3 divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.holder}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {r.passportNo ?? r.code} · {r.packageName}
                {r.checkedInAt ? ` · ${new Date(r.checkedInAt).toLocaleTimeString()}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busyId === r.id}
              onClick={() => rollback(r.id)}
            >
              <Undo2 className="h-4 w-4" />
              Roll back
            </Button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            {loading ? "Loading..." : "No check-ins yet."}
          </li>
        )}
      </ul>
    </section>
  );
}
