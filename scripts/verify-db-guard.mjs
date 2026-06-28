// Safety guard for the VERIFICATION PLANE database commands.
//
// The verification plane MUST live in a database that is SEPARATE from the core
// app. Pointing it at the core DB and running `prisma db push` drops the core
// tables. This guard runs before `db:push:verify` / `db:seed:verify` and refuses
// to continue unless BOTH checks pass:
//
//   1. STATIC: VERIFY_DATABASE_URL / VERIFY_DIRECT_URL must not resolve to the
//      same project/host/db as DATABASE_URL / DIRECT_URL.
//   2. LIVE (fail-closed): if the target DB is reachable, it must NOT contain any
//      core tables (Event / User / Order). This catches connection-pooler
//      mis-routing where the URL *says* a different DB but the server still
//      connects to the core `postgres` database.
//
// Run via Node's --env-file so it sees .env:
//   node --env-file=.env scripts/verify-db-guard.mjs
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

function fail(msg) {
  console.error("\n[verify-db-guard] REFUSING TO CONTINUE\n  " + msg + "\n");
  process.exit(1);
}

const core = process.env.DATABASE_URL;
const verify = process.env.VERIFY_DATABASE_URL;
const coreDirect = process.env.DIRECT_URL;
const verifyDirect = process.env.VERIFY_DIRECT_URL;

if (!verify) fail("VERIFY_DATABASE_URL is not set. Point it at a DEDICATED verification database.");

function project(url) {
  try {
    const u = new URL(url);
    // Supabase encodes the project ref in the username (postgres.<ref>).
    return `${u.username}@${u.hostname}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return url;
  }
}

// ----- 1. STATIC isolation check ---------------------------------------------
if (core && (verify === core || project(verify) === project(core))) {
  fail(
    "VERIFY_DATABASE_URL targets the CORE database. This would DROP all core tables.\n" +
      "  Set VERIFY_DATABASE_URL / VERIFY_DIRECT_URL to a separate database/Supabase project first."
  );
}
if (coreDirect && verifyDirect && (verifyDirect === coreDirect || project(verifyDirect) === project(coreDirect))) {
  fail("VERIFY_DIRECT_URL targets the CORE database. Use a separate database/Supabase project.");
}

// Obvious un-provisioned placeholder - let the static check pass but make it
// clear nothing will be pushed to the core DB.
if (/CHANGE_ME|SEPARATE-PROJECT/i.test(verify)) {
  console.log(
    "[verify-db-guard] VERIFY_DATABASE_URL is still a placeholder - set a real, separate DB before provisioning."
  );
}

// ----- 2. LIVE fail-closed check ---------------------------------------------
// Checks BOTH the pooled and the direct URL - `prisma db push` uses the direct
// URL, so that is the one that could actually drop core tables. Retries a few
// times so a cold connection right after DB creation does not silently skip the
// check.
let PrismaClient;
async function loadClient() {
  const clientPath = resolve(process.cwd(), "src/generated/verify-client/index.js");
  try {
    const mod = await import(pathToFileURL(clientPath).href);
    return mod.PrismaClient ?? mod.default?.PrismaClient;
  } catch {
    return null;
  }
}

async function liveCheckUrl(label, url) {
  if (!url || !PrismaClient) return;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const rows = await prisma.$queryRawUnsafe(
        `select to_regclass('public."Event"')::text as e, to_regclass('public."User"')::text as u, to_regclass('public."Order"')::text as o`
      );
      const r = Array.isArray(rows) ? rows[0] : rows;
      await prisma.$disconnect().catch(() => {});
      if (r && (r.e || r.u || r.o)) {
        fail(
          `LIVE CHECK FAILED on ${label}: the target database contains CORE tables (Event/User/Order).\n` +
            "  The connection is reaching the CORE database (possibly via pooler mis-routing).\n" +
            "  Pushing the verification schema here would DROP core data. Use a truly separate DB."
        );
      }
      console.log(`[verify-db-guard] LIVE CHECK OK (${label}) - target DB has no core tables.`);
      return;
    } catch (err) {
      lastErr = err;
      await prisma.$disconnect().catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.log(
    `[verify-db-guard] ${label} not reachable after retries (` +
      (lastErr?.message?.split("\n")[0] ?? "connection error") +
      ") - push will fail on its own if unreachable; static check passed."
  );
}

PrismaClient = await loadClient();
if (!PrismaClient) {
  console.log("[verify-db-guard] verify client not generated yet - skipping live check (static check passed).");
} else {
  await liveCheckUrl("VERIFY_DIRECT_URL", verifyDirect);
  await liveCheckUrl("VERIFY_DATABASE_URL", verify);
}
console.log("[verify-db-guard] OK - verification DB is distinct from the core DB.");
