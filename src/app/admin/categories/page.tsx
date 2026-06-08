import { db } from "@/lib/db";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Event categories</h1>
        <p className="text-sm text-muted-foreground">
          Only Super Admin can add, edit or remove categories. Organizers request
          new ones via the contact page.
        </p>
      </header>

      <CategoriesManager
        initial={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          iconKey: c.iconKey,
          eventCount: c._count.events,
        }))}
      />
    </div>
  );
}
