import { EventWizard } from "@/components/events/event-wizard";
import { db } from "@/lib/db";
import { DEFAULT_COMMISSION_PCT } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminNewEventPage() {
  const [categories, organizations, settings] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
  ]);

  return (
    <EventWizard
      categories={categories}
      organizations={organizations}
      canEditCommission
      defaultCommission={settings?.defaultCommissionPct ?? DEFAULT_COMMISSION_PCT}
      backHref="/admin"
      listHref="/admin/events"
    />
  );
}
