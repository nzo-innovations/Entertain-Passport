import { db } from "@/lib/db";
import { SettingsForm } from "@/components/admin/settings-form";
import { DEFAULT_COMMISSION_PCT } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await db.platformSettings.findUnique({ where: { id: "default" } });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Platform settings</h1>
        <p className="text-sm text-muted-foreground">
          Global defaults for commission, event staffing and Passport cards.
        </p>
      </header>

      <SettingsForm
        initial={{
          defaultCommissionPct: settings?.defaultCommissionPct ?? DEFAULT_COMMISSION_PCT,
          freeStaffPerEvent: settings?.freeStaffPerEvent ?? 2,
          extraStaffMonthlyFee: settings?.extraStaffMonthlyFee ?? 1500,
          passportCardPrice: settings?.passportCardPrice ?? 50_000,
        }}
      />
    </div>
  );
}
