import { redirect } from "next/navigation";
import { EventWizard } from "@/components/events/event-wizard";
import { getMainCategories, getTagsForModule, CatalogModule } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_COMMISSION_PCT } from "@/lib/config";
import { getOrgVenueForUser } from "@/lib/venues";

export const dynamic = "force-dynamic";

export default async function PortalNewEventPage({
  searchParams,
}: {
  searchParams: { venueId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  const [showsMains, showsTags, org, settings, orgRow] = await Promise.all([
    getMainCategories(CatalogModule.SHOWS),
    getTagsForModule(CatalogModule.SHOWS),
    db.organization.findFirst({
      where: { OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }] },
      orderBy: { createdAt: "asc" },
      select: { commissionPct: true },
    }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
    getOrgVenueForUser(session.id),
  ]);

  const platformDefault = settings?.defaultCommissionPct ?? DEFAULT_COMMISSION_PCT;
  const effectiveCommission = org?.commissionPct ?? platformDefault;
  const orgVenue =
    orgRow?.venue && (!searchParams.venueId || orgRow.venue.id === searchParams.venueId)
      ? orgRow.venue
      : searchParams.venueId
      ? orgRow?.venue?.id === searchParams.venueId
        ? orgRow.venue
        : null
      : orgRow?.venue ?? null;

  return (
    <EventWizard
      showsMains={showsMains}
      showsTags={showsTags}
      canEditCommission={false}
      defaultCommission={effectiveCommission}
      orgVenue={orgVenue}
      backHref="/portal"
      listHref="/portal/events"
    />
  );
}
