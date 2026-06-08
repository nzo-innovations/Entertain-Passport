import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import { db } from "@/lib/db";
import { eventToEditInitial } from "@/lib/event-update";
import { EventEditForm } from "@/components/events/event-edit-form";

export const dynamic = "force-dynamic";

export default async function PortalEventEditPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  const allowed = await canManageEvent(session.id, params.id, session.role);
  if (!allowed) notFound();

  const [event, categories] = await Promise.all([
    db.event.findUnique({
      where: { id: params.id },
      include: { venue: true, packages: { orderBy: { sortOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" } } },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!event) notFound();

  const hasSales = event.packages.some((p) => p.qtySold > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/portal/events/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to event
      </Link>
      <header>
        <h1 className="font-display text-2xl font-bold">Edit event</h1>
        <p className="text-sm text-muted-foreground">
          Update details and ticket quantities. Commission is set by nZO.
        </p>
      </header>

      <EventEditForm
        initial={eventToEditInitial(event)}
        categories={categories}
        isSuperAdmin={false}
        canDelete={!hasSales}
        redirectAfter={`/portal/events/${params.id}`}
        deleteRedirect="/portal/events"
      />
    </div>
  );
}
