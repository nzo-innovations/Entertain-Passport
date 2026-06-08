import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@/lib/types";
import { TeamManager } from "@/components/portal/team-manager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  const org = await db.organization.findFirst({
    where: { ownerId: session.id },
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        You need an organization before adding gate staff.
      </div>
    );
  }

  const events = await db.event.findMany({
    where: { organizationId: org.id },
    select: { id: true, title: true },
    orderBy: { startsAt: "asc" },
  });

  const members = await db.organizationMember.findMany({
    where: { organizationId: org.id, user: { role: UserRole.GATE_STAFF } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const assignments = await db.eventStaff.findMany({
    where: { event: { organizationId: org.id }, userId: { in: members.map((m) => m.user.id) } },
    include: { event: { select: { id: true, title: true } } },
  });

  const staff = members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    assignments: assignments
      .filter((a) => a.userId === m.user.id)
      .map((a) => ({ staffId: a.id, eventId: a.event.id, eventTitle: a.event.title, role: a.role })),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Team - Gate staff</h1>
        <p className="text-sm text-muted-foreground">
          Create gate-staff accounts and assign them to your events. They sign in
          at the organizer login and can only check in tickets for events you
          assign them to.
        </p>
      </header>

      <TeamManager
        orgName={org.name}
        events={events}
        staff={staff}
        serviceConfigured={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
      />
    </div>
  );
}
