import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryStrip } from "@/components/marketing/category-strip";
import { getCategoriesWithCounts } from "@/lib/events";

export const revalidate = 60;

export const metadata = {
  title: "Genres - Browse by category",
};

export default async function GenresPage() {
  const categories = await getCategoriesWithCounts();

  return (
    <div className="container space-y-10 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Genres</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Browse by category</h1>
        <p className="text-muted-foreground">
          Pick a genre to explore every show in that category.
        </p>
      </header>

      <CategoryStrip items={categories} />

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
