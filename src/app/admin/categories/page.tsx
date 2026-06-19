import { db } from "@/lib/db";
import { CatalogAdminManager } from "@/components/admin/catalog-admin-manager";
import { ROUTES } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [categories, tags] = await Promise.all([
    db.category.findMany({
      orderBy: [{ module: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { name: true } },
        _count: { select: { events: true, venuesMain: true, venuesSub: true } },
      },
    }),
    db.tag.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Catalog · categories &amp; tags</h1>
        <p className="text-sm text-muted-foreground">
          Manage Discover &amp; Shows and Places to Go hierarchies plus shared tags. Organizers request
          missing categories via{" "}
          <a href={ROUTES.contact} className="text-primary hover:underline">
            Contact Support
          </a>
          .
        </p>
      </header>

      <CatalogAdminManager
        categories={categories.map((c) => ({
          id: c.id,
          module: c.module,
          name: c.name,
          slug: c.slug,
          parentId: c.parentId,
          parentName: c.parent?.name ?? null,
          eventCount: c._count.events,
          venueCount: c._count.venuesMain + c._count.venuesSub,
        }))}
        tags={tags}
      />
    </div>
  );
}
