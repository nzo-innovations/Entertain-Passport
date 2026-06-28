/**
 * One-off: copy verification-plane data from legacy Supabase (Sydney) into
 * VERIFY_DIRECT_URL (Mumbai). Does NOT touch the core auth/sales database.
 *
 *   npm run verify:migrate
 *
 * Requires VERIFY_MIGRATE_SOURCE_URL + VERIFY_DIRECT_URL in .env.
 */
import { PrismaClient } from "../src/generated/verify-client";

const SOURCE_URL = process.env.VERIFY_MIGRATE_SOURCE_URL;
const TARGET_URL = process.env.VERIFY_DIRECT_URL;
const CORE_URL = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

function projectRef(url: string) {
  try {
    const u = new URL(url);
    if (u.username.startsWith("postgres.")) return u.username.slice("postgres.".length);
    const host = u.hostname;
    const m = host.match(/^db\.([^.]+)\.supabase\.co$/);
    return m?.[1] ?? host;
  } catch {
    return url;
  }
}

function fail(msg: string): never {
  console.error(`\n[migrate-verify-db] ${msg}\n`);
  process.exit(1);
}

async function assertNoCoreTables(client: PrismaClient, label: string) {
  const rows = await client.$queryRawUnsafe<
    { e: string | null; u: string | null; o: string | null }[]
  >(
    `select to_regclass('public."Event"')::text as e, to_regclass('public."User"')::text as u, to_regclass('public."Order"')::text as o`
  );
  const r = rows[0];
  if (r?.e || r?.u || r?.o) {
    fail(`${label} looks like the CORE database (Event/User/Order present). Aborting.`);
  }
}

async function truncateTarget(target: PrismaClient) {
  await target.$executeRawUnsafe(`
    truncate table
      public."ApiNonce",
      public."ApiRequestLog",
      public."UsageCounter",
      public."PartnerConsent",
      public."ApiClient",
      public."VerifCardKey",
      public."VerifIdentity",
      public."Partner",
      public."VerifPlan"
    restart identity cascade
  `);
}

async function main() {
  if (!SOURCE_URL) {
    fail("Set VERIFY_MIGRATE_SOURCE_URL to the legacy verify DB direct URL (port 5432).");
  }
  if (!TARGET_URL) fail("VERIFY_DIRECT_URL is not set.");
  if (CORE_URL && (SOURCE_URL === CORE_URL || TARGET_URL === CORE_URL)) {
    fail("Source or target must not be the core DATABASE_URL.");
  }

  const srcRef = projectRef(SOURCE_URL);
  const tgtRef = projectRef(TARGET_URL);
  console.log(`[migrate-verify-db] source: ${srcRef}`);
  console.log(`[migrate-verify-db] target: ${tgtRef}`);
  if (srcRef === tgtRef) fail("Source and target are the same project.");

  const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
  const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

  try {
    await assertNoCoreTables(source, "Source");
    await assertNoCoreTables(target, "Target");

    const [
      plans,
      partners,
      identities,
      cardKeys,
      clients,
      consents,
      usage,
      logs,
      nonces,
    ] = await Promise.all([
      source.verifPlan.findMany(),
      source.partner.findMany(),
      source.verifIdentity.findMany(),
      source.verifCardKey.findMany(),
      source.apiClient.findMany(),
      source.partnerConsent.findMany(),
      source.usageCounter.findMany(),
      source.apiRequestLog.findMany(),
      source.apiNonce.findMany(),
    ]);

    const counts = {
      VerifPlan: plans.length,
      Partner: partners.length,
      VerifIdentity: identities.length,
      VerifCardKey: cardKeys.length,
      ApiClient: clients.length,
      PartnerConsent: consents.length,
      UsageCounter: usage.length,
      ApiRequestLog: logs.length,
      ApiNonce: nonces.length,
    };

    console.log("[migrate-verify-db] source counts:", counts);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      console.log("[migrate-verify-db] Source is empty - nothing to migrate.");
      return;
    }

    console.log("[migrate-verify-db] truncating target…");
    await truncateTarget(target);

    console.log("[migrate-verify-db] inserting…");
    if (plans.length) await target.verifPlan.createMany({ data: plans });
    if (partners.length) await target.partner.createMany({ data: partners });
    if (identities.length) await target.verifIdentity.createMany({ data: identities });
    if (cardKeys.length) await target.verifCardKey.createMany({ data: cardKeys });
    if (clients.length) await target.apiClient.createMany({ data: clients });
    if (consents.length) await target.partnerConsent.createMany({ data: consents });
    if (usage.length) await target.usageCounter.createMany({ data: usage });
    if (logs.length) await target.apiRequestLog.createMany({ data: logs });
    if (nonces.length) await target.apiNonce.createMany({ data: nonces });

    const after = {
      VerifPlan: await target.verifPlan.count(),
      Partner: await target.partner.count(),
      VerifIdentity: await target.verifIdentity.count(),
      VerifCardKey: await target.verifCardKey.count(),
      ApiClient: await target.apiClient.count(),
      PartnerConsent: await target.partnerConsent.count(),
      UsageCounter: await target.usageCounter.count(),
      ApiRequestLog: await target.apiRequestLog.count(),
      ApiNonce: await target.apiNonce.count(),
    };
    console.log("[migrate-verify-db] target counts:", after);
    console.log(`\n[migrate-verify-db] Done - ${total} rows migrated. Run: npm run verify:rls`);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
