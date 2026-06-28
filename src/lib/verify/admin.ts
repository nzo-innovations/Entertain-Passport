// ============================================================
// Super-Admin read models for the verification plane (monitoring + mgmt)
// ============================================================
// Used only by Super-Admin server components / routes (guarded by
// requireSuperAdmin upstream). Reads the isolated verification DB.
import { verifyDb } from "@/lib/verify-db";
import { currentPeriod, effectiveLimits } from "./limits";

export async function getVerifyDashboard() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const period = currentPeriod();

  const [
    totalReqs24h,
    validReqs24h,
    deniedReqs24h,
    verdictGroups,
    recentLogs,
    usageThisPeriod,
    partnerCount,
    activeKeys,
    cardCount,
  ] = await Promise.all([
    verifyDb.apiRequestLog.count({ where: { createdAt: { gte: since24h } } }),
    verifyDb.apiRequestLog.count({ where: { createdAt: { gte: since24h }, verdict: "VALID" } }),
    verifyDb.apiRequestLog.count({ where: { createdAt: { gte: since24h }, verdict: "DENIED" } }),
    verifyDb.apiRequestLog.groupBy({
      by: ["verdict"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    verifyDb.apiRequestLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { partner: { select: { name: true } } },
    }),
    verifyDb.usageCounter.findMany({
      where: { period },
      include: { partner: { select: { name: true } } },
    }),
    verifyDb.partner.count(),
    verifyDb.apiClient.count({ where: { status: "ACTIVE" } }),
    verifyDb.verifIdentity.count(),
  ]);

  const revenueMinor = usageThisPeriod.reduce((sum, u) => sum + u.amountMinor, 0);
  const billableThisPeriod = usageThisPeriod.reduce((sum, u) => sum + u.billableCount, 0);

  return {
    period,
    kpis: {
      totalReqs24h,
      validReqs24h,
      deniedReqs24h,
      partnerCount,
      activeKeys,
      cardCount,
      revenueMinor,
      billableThisPeriod,
    },
    verdictBreakdown: verdictGroups.map((g) => ({ verdict: g.verdict, count: g._count._all })),
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      partner: l.partner?.name ?? "-",
      verdict: l.verdict,
      httpStatus: l.httpStatus,
      latencyMs: l.latencyMs,
      ip: l.ip,
      reason: l.reason,
      billable: l.billable,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export async function listPartnersForAdmin() {
  const period = currentPeriod();
  const partners = await verifyDb.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      apiClients: {
        orderBy: { createdAt: "desc" },
        select: { id: true, keyId: true, label: true, status: true, lastUsedAt: true, ipAllowlist: true, rateLimitRpm: true },
      },
      usage: { where: { period } },
      consents: { where: { status: "ACTIVE" }, orderBy: { acceptedAt: "desc" }, take: 1 },
    },
  });

  return partners.map((p) => {
    const limits = effectiveLimits(p);
    const usage = p.usage.reduce(
      (acc, u) => ({
        count: acc.count + u.count,
        billable: acc.billable + u.billableCount,
        amountMinor: acc.amountMinor + u.amountMinor,
      }),
      { count: 0, billable: 0, amountMinor: 0 }
    );
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      planCode: p.plan?.code ?? null,
      planName: p.plan?.name ?? null,
      limits,
      hasConsent: p.consents.length > 0,
      consentVersion: p.consents[0]?.termsVersion ?? null,
      consentLegalBasis: p.consents[0]?.legalBasis ?? null,
      overrides: {
        unitPriceMinor: p.overrideUnitPriceMinor,
        monthlyQuota: p.overrideMonthlyQuota,
        rateLimitRpm: p.overrideRateLimitRpm,
      },
      activeKeys: p.apiClients.filter((c) => c.status === "ACTIVE").length,
      totalKeys: p.apiClients.length,
      keys: p.apiClients.map((c) => ({
        id: c.id,
        keyId: c.keyId,
        label: c.label,
        status: c.status,
        lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
        ipAllowlist: c.ipAllowlist,
        rateLimitRpm: c.rateLimitRpm,
      })),
      usage,
    };
  });
}

export async function getPartnerDetailForAdmin(partnerId: string) {
  const period = currentPeriod();
  const partner = await verifyDb.partner.findUnique({
    where: { id: partnerId },
    include: {
      plan: true,
      apiClients: { orderBy: { createdAt: "desc" } },
      consents: { orderBy: { acceptedAt: "desc" } },
      usage: { orderBy: { period: "desc" }, take: 12 },
    },
  });
  if (!partner) return null;
  const plans = await verifyDb.verifPlan.findMany({ orderBy: { unitPriceMinor: "desc" } });
  return { partner, plans, period };
}
