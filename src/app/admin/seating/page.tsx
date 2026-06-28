import { listLayoutTemplates } from "@/lib/seating/template-service";
import { SeatingTemplatesManager } from "@/components/admin/seating-templates-manager";

export const dynamic = "force-dynamic";

export default async function AdminSeatingPage() {
  const templates = await listLayoutTemplates();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Seating layouts</h1>
        <p className="text-sm text-muted-foreground">
          Manage system and custom venue templates. Export JSON for backup or import layouts from
          other environments.
        </p>
      </header>

      <SeatingTemplatesManager
        initial={templates.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description,
          isSystem: t.isSystem,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
