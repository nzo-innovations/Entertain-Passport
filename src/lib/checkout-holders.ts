import type { Prisma } from "@prisma/client";
import { validateIdentity, type IdentityType } from "./identity";

export type TicketHolderInput = {
  type: "self" | "passport" | "identity";
  passportNo?: string;
  idType?: IdentityType;
  idNumber?: string;
  name?: string;
};

type Tx = Prisma.TransactionClient;

function displayName(user: {
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null): string | null {
  if (!user) return null;
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fromParts || user.name;
}

export async function resolveTicketHolder(
  buyerId: string,
  input: TicketHolderInput,
  buyerPassportId: string | null,
  tx: Tx
) {
  if (input.type === "self") {
    return {
      holderUserId: buyerId,
      holderName: null as string | null,
      holderNic: null as string | null,
      rfidCardId: buyerPassportId,
    };
  }

  if (input.type === "passport") {
    const passportNo = input.passportNo?.trim();
    if (!passportNo) throw new Error("Entertain Passport number is required.");
    const card = await tx.rfidCard.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ passportNo }, { uid: passportNo }],
      },
      include: {
        assignedUser: { select: { id: true, name: true, firstName: true, lastName: true } },
      },
    });
    if (!card) throw new Error(`No active Entertain Passport found for ${passportNo}.`);
    return {
      holderUserId: card.assignedUserId,
      holderName: displayName(card.assignedUser) ?? input.name ?? null,
      holderNic: null as string | null,
      rfidCardId: card.id,
    };
  }

  if (input.type === "identity") {
    const idType = input.idType ?? "NIC";
    const validated = validateIdentity(idType, input.idNumber ?? "");
    if (!validated.ok) throw new Error(validated.error ?? "Invalid ID number.");
    const friend = await tx.user.findFirst({
      where: {
        OR: [{ nic: validated.normalized }, { idNumber: validated.normalized }],
      },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    return {
      holderUserId: friend?.id ?? null,
      holderName: input.name?.trim() || displayName(friend) || null,
      holderNic: validated.normalized,
      rfidCardId: null as string | null,
    };
  }

  throw new Error("Each ticket needs a holder assigned.");
}

export function validateTicketHolders(
  holders: TicketHolderInput[] | undefined,
  ticketCount: number
): TicketHolderInput[] {
  if (ticketCount === 0) return [];
  if (!holders || holders.length !== ticketCount) {
    throw new Error("Assign a holder for every ticket before checkout.");
  }
  for (let i = 0; i < holders.length; i++) {
    const h = holders[i];
    if (h.type === "self") continue;
    if (h.type === "passport" && h.passportNo?.trim()) continue;
    if (h.type === "identity" && h.idNumber?.trim()) {
      const v = validateIdentity(h.idType ?? "NIC", h.idNumber);
      if (!v.ok) throw new Error(`Ticket ${i + 1}: ${v.error}`);
      continue;
    }
    throw new Error(`Ticket ${i + 1}: assign a holder or use your account.`);
  }
  return holders;
}
