// Seed default pricing plans into the verification plane.
// Run: npm run db:seed:verify   (after npm run db:push:verify)
import { PrismaClient } from "../../src/generated/verify-client";

const verifyDb = new PrismaClient();

const PLANS = [
  { code: "PAYG", name: "Pay as you go", unitPriceMinor: 1500, monthlyQuota: null, rateLimitRpm: 120, includedAllowance: 0 },
  { code: "STARTER", name: "Starter", unitPriceMinor: 1000, monthlyQuota: 50_000, rateLimitRpm: 240, includedAllowance: 1_000 },
  { code: "PRO", name: "Pro", unitPriceMinor: 700, monthlyQuota: 500_000, rateLimitRpm: 600, includedAllowance: 10_000 },
  { code: "ENTERPRISE", name: "Enterprise", unitPriceMinor: 400, monthlyQuota: null, rateLimitRpm: 1200, includedAllowance: 100_000 },
];

async function main() {
  for (const p of PLANS) {
    await verifyDb.verifPlan.upsert({
      where: { code: p.code },
      create: { ...p, currency: "LKR", isActive: true },
      update: {
        name: p.name,
        unitPriceMinor: p.unitPriceMinor,
        monthlyQuota: p.monthlyQuota,
        rateLimitRpm: p.rateLimitRpm,
        includedAllowance: p.includedAllowance,
      },
    });
  }
  console.log(`Seeded ${PLANS.length} verification plans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => verifyDb.$disconnect());
