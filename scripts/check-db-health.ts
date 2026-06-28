/**
 * Health check: core + verify DB connections and verification plane readiness.
 * Run: npm run db:health
 */
import { PrismaClient as CoreClient } from "@prisma/client";
import { PrismaClient as VerifyClient } from "../src/generated/verify-client";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`  [${mark}] ${name}: ${detail}`);
}

async function testCore() {
  const pooled = process.env.DATABASE_URL;
  const direct = process.env.DIRECT_URL;
  if (!pooled) return record("core env", false, "DATABASE_URL missing");
  if (!direct) return record("core env", false, "DIRECT_URL missing");

  const corePooled = new CoreClient({ datasources: { db: { url: pooled } } });
  const coreDirect = new CoreClient({ datasources: { db: { url: direct } } });

  try {
    const users = await corePooled.user.count();
    const events = await corePooled.event.count();
    const cards = await corePooled.rfidCard.count();
    record("core pooled (6543)", true, `User=${users}, Event=${events}, RfidCard=${cards}`);

    await coreDirect.$queryRawUnsafe<{ ok: number }[]>(`select 1 as ok`);
    record("core direct (5432)", true, "connected");
  } catch (err) {
    record("core connection", false, err instanceof Error ? err.message.split("\n")[0] : String(err));
  } finally {
    await corePooled.$disconnect();
    await coreDirect.$disconnect();
  }
}

async function testVerify() {
  const pooled = process.env.VERIFY_DATABASE_URL;
  const direct = process.env.VERIFY_DIRECT_URL;
  if (!pooled) return record("verify env", false, "VERIFY_DATABASE_URL missing");
  if (!direct) return record("verify env", false, "VERIFY_DIRECT_URL missing");

  if (pooled === process.env.DATABASE_URL || direct === process.env.DIRECT_URL) {
    record("verify isolation", false, "VERIFY_* must not equal core DATABASE_URL");
    return;
  }
  record("verify isolation", true, "distinct from core URLs");

  const verifyPooled = new VerifyClient({ datasources: { db: { url: pooled } } });
  const verifyDirect = new VerifyClient({ datasources: { db: { url: direct } } });

  try {
    const rows = await verifyDirect.$queryRawUnsafe<
      { e: string | null; u: string | null; o: string | null }[]
    >(
      `select to_regclass('public."Event"')::text as e, to_regclass('public."User"')::text as u, to_regclass('public."Order"')::text as o`
    );
    const r = rows[0];
    if (r?.e || r?.u || r?.o) {
      record("verify schema", false, "core tables detected on verify DB");
      return;
    }
    record("verify schema", true, "no core Event/User/Order tables");

    const [plans, partners, identities, keys, clients, logs] = await Promise.all([
      verifyPooled.verifPlan.count(),
      verifyPooled.partner.count(),
      verifyPooled.verifIdentity.count(),
      verifyPooled.verifCardKey.count(),
      verifyPooled.apiClient.count(),
      verifyPooled.apiRequestLog.count(),
    ]);
    record(
      "verify pooled (6543)",
      true,
      `VerifPlan=${plans}, Partner=${partners}, VerifIdentity=${identities}, VerifCardKey=${keys}, ApiClient=${clients}, ApiRequestLog=${logs}`
    );

    await verifyDirect.$queryRawUnsafe<{ ok: number }[]>(`select 1 as ok`);
    record("verify direct (5432)", true, "connected");
  } catch (err) {
    record("verify connection", false, err instanceof Error ? err.message.split("\n")[0] : String(err));
  } finally {
    await verifyPooled.$disconnect();
    await verifyDirect.$disconnect();
  }
}

function testVerifyCryptoEnv() {
  const required = [
    "VERIFY_KMS_PROVIDER",
    "VERIFY_KMS_KEY_ID",
    "VERIFY_LOCAL_MASTER_KEY",
    "VERIFY_HASH_PEPPER",
  ] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    record("verify crypto env", false, `missing: ${missing.join(", ")}`);
    return;
  }
  record("verify crypto env", true, `${process.env.VERIFY_KMS_PROVIDER} / pepper set`);
}

async function testSyncPath() {
  const core = new CoreClient();
  try {
    const card = await core.rfidCard.findFirst({
      include: { assignedUser: { select: { name: true, nic: true, phone: true } } },
    });
    if (!card) {
      record("verify sync path", true, "no NFC cards in core (skip live sync test)");
      return;
    }
    const { syncIdentity } = await import("../src/lib/verify/sync");
    await syncIdentity({
      uid: card.uid,
      passportNo: card.passportNo,
      status: card.status,
      adminLabel: card.label,
      name: card.assignedUser?.name ?? null,
      nic: card.assignedUser?.nic ?? null,
      mobile: card.assignedUser?.phone ?? null,
    });
    const verify = new VerifyClient();
    const identity = await verify.verifIdentity.findUnique({
      where: { passportNo: card.passportNo },
    });
    await verify.$disconnect();
    record(
      "verify sync path",
      Boolean(identity),
      identity ? `core→verify sync OK for ${card.passportNo}` : "sync wrote nothing"
    );
  } catch (err) {
    record("verify sync path", false, err instanceof Error ? err.message.split("\n")[0] : String(err));
  } finally {
    await core.$disconnect();
  }
}

async function main() {
  console.log("[db:health] Entertain Passport - connection & verify plane check\n");

  testVerifyCryptoEnv();
  await testCore();
  await testVerify();
  await testSyncPath();

  const failed = checks.filter((c) => !c.ok);
  console.log("");
  if (failed.length === 0) {
    console.log("[db:health] All checks passed.");
    process.exit(0);
  }
  console.log(`[db:health] ${failed.length} check(s) failed.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
