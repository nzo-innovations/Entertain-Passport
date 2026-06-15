import { Database } from "lucide-react";

export function VerifySetupNotice() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Verification API</h1>
        <p className="text-sm text-muted-foreground">
          Isolated B2B card-validation service · tap-only · verdict-only
        </p>
      </header>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
          <Database className="h-5 w-5" /> Verification plane not provisioned yet
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          The verification database is isolated from the core app and must be set up before this
          section works. From the project root run:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-4 text-xs">
{`# 1. Point VERIFY_DATABASE_URL / VERIFY_DIRECT_URL at a DEDICATED database
#    (a separate Supabase project with no access to core sales data).
# 2. Create the schema + seed default pricing plans:
npm run db:push:verify
npm run db:seed:verify`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          See <code>docs/VERIFICATION_API.md</code> and <code>docs/VERIFICATION_RUNBOOK.md</code> for
          the least-privilege DB role and KMS setup.
        </p>
      </div>
    </div>
  );
}
