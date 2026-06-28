/** Labels each ticket holder in a bulk order for gate-staff display. */

export type HolderKind = "buyer" | "platform" | "guest" | "unknown";

export function describeTicketHolder(
  ticket: {
    holderUserId: string | null;
    holderName: string | null;
    holderNic: string | null;
    holder?: { name: string | null; email?: string | null } | null;
  },
  buyer: { id: string; name: string | null; email: string },
  index: number,
  total: number
): { label: string; kind: HolderKind } {
  const buyerName = buyer.name ?? buyer.email;

  if (ticket.holderUserId && ticket.holderUserId !== buyer.id) {
    return {
      label: ticket.holder?.name ?? ticket.holderName ?? "Platform member",
      kind: "platform",
    };
  }
  if (ticket.holderName?.trim() && ticket.holderName.trim() !== buyerName) {
    return { label: ticket.holderName.trim(), kind: "guest" };
  }
  if (ticket.holderNic?.trim()) {
    return { label: `Guest · ID ${ticket.holderNic.trim()}`, kind: "guest" };
  }
  // Bulk order: extra tickets still default-linked to buyer = not assigned yet.
  if (total > 1 && index > 0 && ticket.holderUserId === buyer.id) {
    return { label: `Unknown member ${index}`, kind: "unknown" };
  }
  return { label: buyerName, kind: "buyer" };
}

export function holderKindBadge(kind: HolderKind): string {
  switch (kind) {
    case "buyer":
      return "Buyer";
    case "platform":
      return "On platform";
    case "guest":
      return "Guest";
    case "unknown":
      return "Not assigned";
  }
}
