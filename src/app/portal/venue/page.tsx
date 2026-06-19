import { redirect } from "next/navigation";
import { VenueManager } from "@/components/portal/venue-manager";
import { getSession } from "@/lib/auth";
import { canManageOrgVenue, getOrgVenueForUser } from "@/lib/venues";
import { getMainCategories, getTagsForModule, CatalogModule } from "@/lib/catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PortalVenuePage() {
  const session = await getSession();
  if (!session) redirect("/organizer/login");

  if (!(await canManageOrgVenue(session))) {
    redirect("/portal");
  }

  const row = await getOrgVenueForUser(session.id);
  const org =
    row?.org ??
    (await db.organization.findFirst({
      where: { OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }] },
      orderBy: { createdAt: "asc" },
    }));

  if (!org) redirect("/portal");

  const [placesMains, placesTags] = await Promise.all([
    getMainCategories(CatalogModule.PLACES),
    getTagsForModule(CatalogModule.PLACES),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">My venue</h1>
        <p className="mt-1 text-muted-foreground">
          Publish your pub, club or restaurant — weekly live music plus ticketed special nights from the
          same organizer account.
        </p>
      </div>
      <VenueManager orgName={org.name} placesMains={placesMains} placesTags={placesTags} />
    </div>
  );
}
