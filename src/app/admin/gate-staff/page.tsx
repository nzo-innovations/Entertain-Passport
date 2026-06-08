import { db } from "@/lib/db";
import { listAllGateStaff } from "@/lib/gate-staff";
import { AdminGateStaffManager } from "@/components/admin/gate-staff-manager";

export const dynamic = "force-dynamic";

export default async function AdminGateStaffPage() {
  const [organizations, events, staff] = await Promise.all([
    db.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.event.findMany({
      select: {
        id: true,
        title: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
      orderBy: { startsAt: "desc" },
    }),
    listAllGateStaff(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Gate staff</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage gate-staff accounts on behalf of any organization. See which
          staff belong to which org and which events they can scan tickets for.
        </p>
      </header>

      <AdminGateStaffManager
        organizations={organizations}
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          organizationId: e.organizationId,
          organizationName: e.organization.name,
        }))}
        staff={staff}
        serviceConfigured={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
      />
    </div>
  );
}
