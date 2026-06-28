import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import { ensureEventSeatMap } from "@/lib/seating/event-seat-map-service";
import { listLayoutTemplates } from "@/lib/seating/template-service";
import { parseLayoutJson } from "@/lib/seating/layout-utils";
import { parseTicketKind } from "@/lib/seating/package-sync";
import { EventSeatingConfig } from "@/components/seating/event-seating-config";

export const dynamic = "force-dynamic";

export default async function PortalEventSeatingPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) notFound();
  if (!(await canManageEvent(session.id, params.id, session.role))) notFound();

  const event = await db.event.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!event) notFound();

  const map = await ensureEventSeatMap(params.id);
  const templates = await listLayoutTemplates();
  const packages = await db.ticketPackage.findMany({
    where: { eventId: params.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      qtyTotal: true,
      qtySold: true,
      ticketKind: true,
      sortOrder: true,
    },
  });

  return (
    <EventSeatingConfig
      eventId={event.id}
      eventTitle={event.title}
      ticketPackages={packages.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        qtyTotal: p.qtyTotal,
        qtySold: p.qtySold,
        ticketKind: parseTicketKind(p.ticketKind),
        sortOrder: p.sortOrder,
      }))}
      templates={templates.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        isSystem: t.isSystem,
      }))}
      initial={{
        seatingEnabled: map.seatingEnabled,
        published: map.published,
        layout: parseLayoutJson(map.layoutJson),
      }}
    />
  );
}
