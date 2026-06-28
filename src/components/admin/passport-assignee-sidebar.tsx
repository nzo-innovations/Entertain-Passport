"use client";

import { CreditCard, Ticket, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/format";
import type { CardTestEventTicket, CardTestOwner } from "@/lib/passport/passport-test-service";

export type PassportCardSummaryData = {
  formattedPassportNumber: string;
  status: string;
  cardTypeLabel: string;
  batchCode: string | null;
};

export function PassportCardSummaryPanel({
  card,
  loading,
  emptyHint,
}: {
  card: PassportCardSummaryData | null;
  loading: boolean;
  emptyHint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5" />
        Passport card
      </p>
      {loading && <p className="mt-3 text-sm text-muted-foreground animate-pulse">Loading card…</p>}
      {!loading && !card && <p className="mt-3 text-sm text-muted-foreground">{emptyHint}</p>}
      {!loading && card && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-mono text-base font-semibold">{card.formattedPassportNumber}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{card.status}</Badge>
            <Badge variant="secondary">{card.cardTypeLabel}</Badge>
          </div>
          {card.batchCode && <p className="text-xs text-muted-foreground">Batch {card.batchCode}</p>}
        </div>
      )}
    </div>
  );
}

export function PassportOwnerSidebar({
  owner,
  loading,
  emptyHint = "No assignee loaded yet.",
}: {
  owner: CardTestOwner | null;
  loading: boolean;
  emptyHint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        Card owner
      </p>
      {loading && <p className="mt-3 text-sm text-muted-foreground animate-pulse">Loading owner…</p>}
      {!loading && !owner && <p className="mt-3 text-sm text-muted-foreground">{emptyHint}</p>}
      {!loading && owner && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-display text-lg font-bold">{owner.name ?? "Unnamed member"}</p>
            <p className="text-muted-foreground">{owner.email}</p>
          </div>
          {owner.identity && (
            <div>
              <p className="text-xs text-muted-foreground">Primary ID</p>
              <p className="font-mono text-xs">{owner.identity}</p>
            </div>
          )}
          {owner.phone && (
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p>{owner.phone}</p>
            </div>
          )}
          {owner.assignedAt && (
            <div>
              <p className="text-xs text-muted-foreground">Assigned to card</p>
              <p>{new Date(owner.assignedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PassportEventTicketsSidebar({
  tickets,
  loading,
  emptyHint = "No ongoing event tickets found for this owner.",
}: {
  tickets: CardTestEventTicket[];
  loading: boolean;
  emptyHint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Ticket className="h-3.5 w-3.5" />
        Ongoing event tickets
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Published events that have not ended yet - purchased by or linked to this card.
      </p>
      {loading && <p className="mt-3 text-sm text-muted-foreground animate-pulse">Loading tickets…</p>}
      {!loading && tickets.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{emptyHint}</p>
      )}
      {!loading && tickets.length > 0 && (
        <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
          {tickets.map((ticket) => (
            <li key={ticket.ticketId} className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{ticket.eventTitle}</p>
                <Badge
                  variant={
                    ticket.status === "VALID"
                      ? "outline"
                      : ticket.status === "CHECKED_IN"
                        ? "success"
                        : "secondary"
                  }
                >
                  {ticket.status === "CHECKED_IN" ? "Checked in" : ticket.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatEventDate(ticket.eventStartsAt)}</p>
              <p className="text-xs text-muted-foreground">{ticket.venueName}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">{ticket.packageName}</Badge>
                {ticket.isBuyer && <Badge variant="secondary">Purchaser</Badge>}
                {ticket.linkedToCard && <Badge variant="secondary">On this card</Badge>}
              </div>
              {ticket.holderName && (
                <p className="mt-2 text-xs text-muted-foreground">Guest: {ticket.holderName}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
