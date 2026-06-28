import { db } from "@/lib/db";

export type NfcAnalyticsSummary = {
  cardsByStatus: Record<string, number>;
  totalCards: number;
  scans24h: { allow: number; deny: number; total: number };
  failedSignatures24h: number;
  blockedAttempts24h: number;
  recentScans: Array<{
    id: string;
    verdict: string;
    reason: string;
    scanType: string;
    passportId: string;
    cardUid: string;
    eventTitle: string | null;
    createdAt: Date;
  }>;
  pendingOrders: number;
  fulfilledOrders: number;
};

export async function getNfcAnalyticsSummary(): Promise<NfcAnalyticsSummary> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [statusGroups, scans24h, failedSig, blockedAttempts, recentScans, pendingOrders, fulfilledOrders] =
    await Promise.all([
      db.rfidCard.groupBy({ by: ["status"], _count: { _all: true } }),
      db.gateScan.groupBy({
        by: ["verdict"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.gateScan.count({
        where: { createdAt: { gte: since }, reason: "INVALID_SIGNATURE" },
      }),
      db.gateScan.count({
        where: {
          createdAt: { gte: since },
          reason: { in: ["CARD_BLOCKED", "CARD_LOST"] },
        },
      }),
      db.gateScan.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { event: { select: { title: true } } },
      }),
      db.passportCardOrder.count({ where: { status: { in: ["PAID", "DEFERRED"] } } }),
      db.passportCardOrder.count({ where: { status: "FULFILLED" } }),
    ]);

  const cardsByStatus: Record<string, number> = {};
  let totalCards = 0;
  for (const g of statusGroups) {
    cardsByStatus[g.status] = g._count._all;
    totalCards += g._count._all;
  }

  let allow = 0;
  let deny = 0;
  for (const s of scans24h) {
    if (s.verdict === "ALLOW") allow = s._count._all;
    if (s.verdict === "DENY") deny = s._count._all;
  }

  return {
    cardsByStatus,
    totalCards,
    scans24h: { allow, deny, total: allow + deny },
    failedSignatures24h: failedSig,
    blockedAttempts24h: blockedAttempts,
    recentScans: recentScans.map((s) => ({
      id: s.id,
      verdict: s.verdict,
      reason: s.reason,
      scanType: s.scanType,
      passportId: s.passportId,
      cardUid: s.cardUid,
      eventTitle: s.event?.title ?? null,
      createdAt: s.createdAt,
    })),
    pendingOrders,
    fulfilledOrders,
  };
}

export async function listPendingPassportOrders() {
  return db.passportCardOrder.findMany({
    where: { status: { in: ["PAID", "DEFERRED"] } },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      rfidCards: { select: { id: true, passportNo: true, uid: true } },
    },
  });
}
