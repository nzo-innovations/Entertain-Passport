import { notFound } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageGallery } from "@/components/events/image-gallery";
import { PackageSelector } from "@/components/events/package-selector";
import { SocialAndShare } from "@/components/events/social-and-share";
import { getEventBySlug } from "@/lib/events";
import { formatEventDateLong, formatEventDate } from "@/lib/format";

export const revalidate = 60;

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
  const event = await getEventBySlug(params.slug);
  if (!event) notFound();

  const images = [
    ...(event.primaryImage ? [event.primaryImage.url] : []),
    ...event.images.filter((i) => i.id !== event.primaryImageId).map((i) => i.url),
  ];

  return (
    <div className="container py-10">
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <a href="/events" className="hover:text-foreground">
          Events
        </a>
        <span>/</span>
        <a href={`/events?category=${event.category.slug}`} className="hover:text-foreground">
          {event.category.name}
        </a>
        <span>/</span>
        <span className="text-foreground line-clamp-1">{event.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{event.category.name}</Badge>
              {event.featured && <Badge variant="warning">Featured</Badge>}
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {event.title}
            </h1>
            {event.shortDescription && (
              <p className="mt-3 text-lg text-muted-foreground">{event.shortDescription}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{formatEventDateLong(event.startsAt)}</span>
                <span className="text-muted-foreground">
                  · {formatEventDate(event.startsAt).split("\u00b7")[1]?.trim()}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{event.venue.name}</span>
                <span className="text-muted-foreground">
                  · {event.venue.city}, {event.venue.country}
                </span>
              </span>
            </div>
          </div>

          <ImageGallery images={images} alt={event.title} />

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">About this event</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
              <p className="whitespace-pre-line text-base leading-relaxed">{event.description}</p>
            </div>
          </section>

          {event.partners.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Brought to you by</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {event.partners.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card/50 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {p.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {p.tier ?? "Partner"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {event.termsAndConditions && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Terms &amp; conditions</h2>
              <p className="rounded-2xl border bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground">
                {event.termsAndConditions}
              </p>
            </section>
          )}

          <SocialAndShare social={event.socialLinks} title={event.title} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <PackageSelector
            event={{
              id: event.id,
              slug: event.slug,
              title: event.title,
              startsAt: event.startsAt,
              primaryImage: event.primaryImage?.url ?? images[0] ?? "",
            }}
            packages={event.packages.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              price: p.price,
              qtyTotal: p.qtyTotal,
              qtySold: p.qtySold,
              perks: p.perks,
            }))}
          />
        </aside>
      </div>
    </div>
  );
}

