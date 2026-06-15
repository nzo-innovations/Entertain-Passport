import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { verifyDb } from "@/lib/verify-db";
import { listPartnersForAdmin } from "@/lib/verify/admin";
import { VerifyPartnersManager } from "@/components/admin/verify-partners";
import { VerifySetupNotice } from "@/components/admin/verify-setup-notice";

export const dynamic = "force-dynamic";

export default async function AdminVerifyPartnersPage() {
  try {
    const [partners, planRows] = await Promise.all([
      listPartnersForAdmin(),
      verifyDb.verifPlan.findMany({ where: { isActive: true }, orderBy: { unitPriceMinor: "desc" } }),
    ]);

    const plans = planRows.map((p) => ({
      code: p.code,
      name: p.name,
      unitPriceMinor: p.unitPriceMinor,
      currency: p.currency,
      monthlyQuota: p.monthlyQuota,
      rateLimitRpm: p.rateLimitRpm,
    }));

    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/api" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Verification API
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">Partners & API keys</h1>
          <p className="text-sm text-muted-foreground">
            Onboard B2B consumers, issue HMAC-signed keys, set per-partner pricing/limits, and record
            data-sharing consent. All actions are Super-Admin only.
          </p>
        </div>

        <VerifyPartnersManager partners={partners} plans={plans} />
      </div>
    );
  } catch (err) {
    console.error("verification partners load failed", err);
    return <VerifySetupNotice />;
  }
}
