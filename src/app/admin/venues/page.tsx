import { db } from "@/lib/db";
import { VenuesManager } from "@/components/admin/venues-manager";

export const dynamic = "force-dynamic";

export default async function AdminVenuesPage() {
  const venues = await db.venue.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Venues</h1>
        <p className="text-sm text-muted-foreground">
          Manage the venues events can be hosted at.
        </p>
      </header>

      <VenuesManager
        initial={venues.map((v) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          line2: v.line2,
          city: v.city,
          district: v.district,
          province: v.province,
          country: v.country,
          mapUrl: v.mapUrl,
          capacity: v.capacity,
          eventCount: v._count.events,
        }))}
      />
    </div>
  );
}
