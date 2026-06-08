import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canScanEventTickets } from "@/lib/permissions";
import { db } from "@/lib/db";
import { TicketScanner } from "@/components/portal/ticket-scanner";

export default async function PortalScanPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canScan = await canScanEventTickets(session.id, params.id, session.role);
  if (!canScan) notFound();

  const event = await db.event.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/portal/events/${event.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to event
      </Link>
      <TicketScanner eventId={event.id} eventTitle={event.title} />
    </div>
  );
}
