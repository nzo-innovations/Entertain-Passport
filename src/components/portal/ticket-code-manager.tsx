"use client";

import * as React from "react";
import { Search, Ticket as TicketIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Row = {
  id: string;
  holder: string;
  packageName: string;
  status: string;
  ticketCode: string;
  passportNo: string;
};

export function TicketCodeManager({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}/tickets?q=${encodeURIComponent(term)}`, {
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
    if (open) void load("");
  }, [open, load]);

  const save = async (row: Row, patch: Partial<Pick<Row, "ticketCode" | "passportNo">>) => {
    const res = await fetch(`/api/events/${eventId}/tickets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: row.id, ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Couldn't save", description: data?.error, variant: "destructive" });
      void load(q);
      return;
    }
    toast({ title: "Ticket updated" });
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <TicketIcon className="h-5 w-5 text-primary" /> Ticket codes &amp; passports
        </h3>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Manage codes"}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Set a printed ticket code or link an Entertain Passport so gate staff can
        check guests in quickly.
      </p>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                void load(e.target.value);
              }}
              placeholder="Search by name or code"
              className="h-9"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Holder</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Ticket code</th>
                  <th className="px-2 py-2 text-left">Passport no.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <TicketRow key={r.id} row={r} onSave={save} />
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                      {loading ? "Loading..." : "No tickets."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function TicketRow({
  row,
  onSave,
}: {
  row: Row;
  onSave: (row: Row, patch: Partial<Pick<Row, "ticketCode" | "passportNo">>) => void;
}) {
  const [code, setCode] = React.useState(row.ticketCode);
  const [passport, setPassport] = React.useState(row.passportNo);

  return (
    <tr className="align-middle">
      <td className="px-2 py-2">
        <p className="font-medium">{row.holder}</p>
        <p className="text-xs text-muted-foreground">{row.packageName}</p>
      </td>
      <td className="px-2 py-2">
        <Badge variant={row.status === "CHECKED_IN" ? "success" : "outline"}>{row.status}</Badge>
      </td>
      <td className="px-2 py-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => code !== row.ticketCode && onSave(row, { ticketCode: code })}
          placeholder="e.g. A-014"
          className="h-8 w-32 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={passport}
          onChange={(e) => setPassport(e.target.value)}
          onBlur={() => passport !== row.passportNo && onSave(row, { passportNo: passport })}
          placeholder="EP-…"
          className="h-8 w-36 font-mono"
        />
      </td>
    </tr>
  );
}
