import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canManagePhysicalTickets } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PhysicalTicketManager } from "@/components/tickets/physical-ticket-manager";

export const dynamic = "force-dynamic";

export default async function GatePhysicalTicketsPage({ params }: { params: { eventId: string } }) {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  const allowed = await canManagePhysicalTickets(session.id, params.eventId, session.role);
  if (!allowed) notFound();

  const event = await db.event.findUnique({
    where: { id: params.eventId },
    select: { id: true, physicalTicketsEnabled: true },
  });
  if (!event) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/gate/${params.eventId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to check-in
      </Link>

      {/* Gate staff can add/update/delete codes but cannot toggle the feature or
          change the code format (canConfigure=false). */}
      <PhysicalTicketManager eventId={event.id} canConfigure={false} showEventHeader />
    </div>
  );
}
