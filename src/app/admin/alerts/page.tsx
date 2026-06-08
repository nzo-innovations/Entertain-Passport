import { db } from "@/lib/db";
import { AlertsManager } from "@/components/admin/alerts-manager";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const [alerts, events] = await Promise.all([
    db.adminAlert.findMany({
      orderBy: { createdAt: "desc" },
      include: { event: { select: { title: true } } },
    }),
    db.event.findMany({ orderBy: { startsAt: "asc" }, select: { id: true, title: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Threshold alerts</h1>
        <p className="text-sm text-muted-foreground">
          Get notified when an event hits a sales milestone.
        </p>
      </header>

      <AlertsManager
        alerts={alerts.map((a) => ({
          id: a.id,
          eventTitle: a.event.title,
          thresholdType: a.thresholdType,
          thresholdValue: a.thresholdValue,
          channel: a.channel,
        }))}
        events={events}
      />
    </div>
  );
}
