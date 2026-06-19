import { db } from "@/lib/db";
import { verifyDb } from "@/lib/verify-db";
import { TicketStatus } from "@/lib/types";

export type CardUsageStats = {
  rfidCardId: string;
  passportNo: string;
  cardStatus: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  loyaltyPoints: number;
  internalCheckIns: number;
  externalVerifications: number;
  totalUsage: number;
};

async function externalValidTapCount(passportNo: string): Promise<number> {
  try {
    return await verifyDb.apiRequestLog.count({
      where: { passportNo, verdict: "VALID" },
    });
  } catch {
    return 0;
  }
}

/** Usage for one Entertain Passport (internal gate taps + partner verification taps). */
export async function getCardUsageStats(passportNo: string): Promise<CardUsageStats | null> {
  const card = await db.rfidCard.findUnique({
    where: { passportNo },
    include: {
      assignedUser: { select: { id: true, name: true, email: true, loyaltyPoints: true } },
    },
  });
  if (!card) return null;

  const [internalCheckIns, externalVerifications] = await Promise.all([
    db.ticket.count({
      where: { rfidCardId: card.id, status: TicketStatus.CHECKED_IN },
    }),
    externalValidTapCount(passportNo),
  ]);

  return {
    rfidCardId: card.id,
    passportNo: card.passportNo,
    cardStatus: card.status,
    userId: card.assignedUserId,
    userName: card.assignedUser?.name ?? null,
    userEmail: card.assignedUser?.email ?? null,
    loyaltyPoints: card.assignedUser?.loyaltyPoints ?? 0,
    internalCheckIns,
    externalVerifications,
    totalUsage: internalCheckIns + externalVerifications,
  };
}

/** Batch usage stats for active assigned passports (loyalty offer targeting). */
export async function listActiveCardUsageStats(): Promise<CardUsageStats[]> {
  const cards = await db.rfidCard.findMany({
    where: { status: "ACTIVE", assignedUserId: { not: null } },
    select: { passportNo: true },
    orderBy: { passportNo: "asc" },
  });

  const stats = await Promise.all(cards.map((c) => getCardUsageStats(c.passportNo)));
  return stats.filter((s): s is CardUsageStats => s !== null);
}

/** Search passports / holders for Super-Admin offer targeting. */
export async function searchCardsWithUsage(q: string, limit = 25): Promise<CardUsageStats[]> {
  const term = q.trim();
  if (!term) return listActiveCardUsageStats();

  const cards = await db.rfidCard.findMany({
    where: {
      OR: [
        { passportNo: { contains: term, mode: "insensitive" } },
        { uid: { contains: term, mode: "insensitive" } },
        { assignedUser: { email: { contains: term, mode: "insensitive" } } },
        { assignedUser: { name: { contains: term, mode: "insensitive" } } },
      ],
    },
    select: { passportNo: true },
    take: limit,
    orderBy: { passportNo: "asc" },
  });

  const stats = await Promise.all(cards.map((c) => getCardUsageStats(c.passportNo)));
  return stats.filter((s): s is CardUsageStats => s !== null);
}
