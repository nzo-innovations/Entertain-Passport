import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GenreCategoryTree } from "@/components/marketing/genre-category-tree";
import { getShowsCategoryTreeWithCounts } from "@/lib/events";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Genres - Browse by category",
};

export default async function GenresPage() {
  const mains = await getShowsCategoryTreeWithCounts();

  return (
    <div className="container space-y-10 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Genres</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Browse by category</h1>
        <p className="text-muted-foreground">
          Pick a main category, then a subcategory, to explore shows in that genre.
        </p>
      </header>

      <GenreCategoryTree mains={mains} />

      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          See all shows <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
