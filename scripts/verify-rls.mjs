// Enable Row Level Security on every verification-plane table.
//
// The verification plane is accessed only server-side via Prisma using the
// privileged Postgres role (VERIFY_DATABASE_URL), which is the table OWNER and
// therefore BYPASSES RLS. Enabling RLS with NO policies blocks the project's
// public `anon` / `authenticated` roles (Supabase client libraries / PostgREST)
// from reading or writing these tables directly — defense in depth for hashed
// identities, KMS-wrapped keys, partner secrets and audit logs.
//
// Idempotent and safe to re-run. Wired into `db:push:verify` so provisioning a
// new environment (dev OR prod) always lands secured.
//
// Run: node --env-file=.env scripts/verify-rls.mjs
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const TABLES = [
  "VerifIdentity",
  "VerifCardKey",
  "VerifPlan",
  "Partner",
  "ApiClient",
  "PartnerConsent",
  "ApiRequestLog",
  "UsageCounter",
  "ApiNonce",
];

const mod = await import(pathToFileURL(resolve(process.cwd(), "src/generated/verify-client/index.js")).href);
const PrismaClient = mod.PrismaClient ?? mod.default?.PrismaClient;
const prisma = new PrismaClient();

try {
  const db = await prisma.$queryRawUnsafe("select current_database() as db");
  console.log(`[verify-rls] target database: ${db[0].db}`);

  for (const t of TABLES) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY;`);
  }

  const rows = await prisma.$queryRawUnsafe(
    `select relname as t, relrowsecurity as rls
       from pg_class
      where relkind='r' and relnamespace = 'public'::regnamespace
        and relname in (${TABLES.map((t) => `'${t}'`).join(",")})
      order by relname`
  );
  const off = rows.filter((r) => !r.rls).map((r) => r.t);
  for (const r of rows) console.log(`  ${r.rls ? "secured " : "OPEN    "} public.${r.t}`);
  if (off.length) {
    console.error(`[verify-rls] FAILED — RLS still off on: ${off.join(", ")}`);
    process.exit(1);
  }
  console.log(`[verify-rls] OK — RLS enabled on all ${rows.length} verification tables.`);
} finally {
  await prisma.$disconnect().catch(() => {});
}
