import { format } from "date-fns";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { buildPlacesVenueWhere, type PlacesFilter } from "./venues";
import { ACT_TYPE_LABELS, type ActType } from "./types";

export const PLACES_AGENDA_DAYS = 7;

export type PlacesAgendaItem = {
  id: string;
  kind: "program" | "post";
  title: string;
  subtitle?: string;
  body?: string;
  detailLink?: string | null;
  venueSlug: string;
  venueName: string;
  city: string;
  startAt: Date;
  timeLabel: string;
  href: string;
  imageUrl?: string;
  badge?: string;
};

export type PlacesAgendaDay = {
  dateKey: string;
  label: string;
  items: PlacesAgendaItem[];
};

export type PlacesAgendaResult = {
  days: PlacesAgendaDay[];
  totalItems: number;
  rangeLabel: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function enumerateDays(from: Date, count: number) {
  const start = startOfDay(from);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function combineDateAndTime(date: Date, timeHHmm: string) {
  const [h, m] = timeHHmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

function formatTimeLabel(timeHHmm: string) {
  const [h, m] = timeHHmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return format(d, "h:mm a");
}

function formatDayLabel(date: Date) {
  return format(date, "EEEE d MMMM");
}

function formatRangeLabel(start: Date, end: Date) {
  return `${format(start, "EEEE d MMMM")} – ${format(end, "EEEE d MMMM")}`;
}

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function isWithinRange(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  return t >= startOfDay(start).getTime() && t <= endOfDay(end).getTime();
}

async function fetchPlacesAgenda(
  filter?: PlacesFilter,
  daysAhead = PLACES_AGENDA_DAYS
): Promise<PlacesAgendaResult> {
  const rangeStart = startOfDay(new Date());
  const rangeEnd = endOfDay(
    (() => {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + daysAhead - 1);
      return d;
    })()
  );

  const includePrograms = !filter?.updates || !!filter?.live;
  const includePosts = !filter?.live || !!filter?.updates;

  const venues = await db.venue.findMany({
    where: buildPlacesVenueWhere(filter),
    select: {
      slug: true,
      name: true,
      city: true,
      programs: {
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
      },
      posts: {
        where: {
          isPublished: true,
          publishedAt: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: [{ publishedAt: "desc" }, { sortOrder: "asc" }],
      },
    },
  });

  const items: PlacesAgendaItem[] = [];
  const calendarDays = enumerateDays(rangeStart, daysAhead);

  for (const venue of venues) {
    if (includePrograms) {
      for (const program of venue.programs) {
        const act = ACT_TYPE_LABELS[program.actType as ActType] ?? program.actType;
        const title = program.performerName?.trim() || program.title;
        const subtitle = program.performerName?.trim() ? program.title : act;

        if (program.recurrence === "WEEKLY" && program.dayOfWeek != null) {
          for (const day of calendarDays) {
            if (day.getDay() !== program.dayOfWeek) continue;
            const startAt = combineDateAndTime(day, program.startTime);
            items.push({
              id: `${program.id}-${dateKey(day)}`,
              kind: "program",
              title,
              subtitle,
              venueSlug: venue.slug!,
              venueName: venue.name,
              city: venue.city,
              startAt,
              timeLabel: formatTimeLabel(program.startTime),
              href: `/venues/${venue.slug}`,
              badge: "Live night",
            });
          }
        } else if (program.recurrence === "ONE_OFF" && program.specificDate) {
          const specific = new Date(program.specificDate);
          if (!isWithinRange(specific, rangeStart, rangeEnd)) continue;
          const day = startOfDay(specific);
          items.push({
            id: program.id,
            kind: "program",
            title,
            subtitle,
            venueSlug: venue.slug!,
            venueName: venue.name,
            city: venue.city,
            startAt: combineDateAndTime(day, program.startTime),
            timeLabel: formatTimeLabel(program.startTime),
            href: `/venues/${venue.slug}`,
            badge: "Special night",
          });
        }
      }
    }

    if (includePosts) {
      for (const post of venue.posts) {
        const publishedAt = new Date(post.publishedAt);
        items.push({
          id: post.id,
          kind: "post",
          title: post.title,
          body: post.body,
          detailLink: post.detailLink,
          venueSlug: venue.slug!,
          venueName: venue.name,
          city: venue.city,
          startAt: publishedAt,
          timeLabel: format(publishedAt, "h:mm a"),
          href: `/venues/${venue.slug}#updates`,
          imageUrl: post.imageUrl ?? undefined,
          badge: "Update",
        });
      }
    }
  }

  items.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.title.localeCompare(b.title));

  const byDay = new Map<string, PlacesAgendaItem[]>();
  for (const day of calendarDays) {
    byDay.set(dateKey(day), []);
  }
  for (const item of items) {
    const key = dateKey(item.startAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(item);
  }

  const days: PlacesAgendaDay[] = calendarDays.map((day) => {
    const key = dateKey(day);
    return {
      dateKey: key,
      label: formatDayLabel(day),
      items: byDay.get(key) ?? [],
    };
  });

  return {
    days,
    totalItems: items.length,
    rangeLabel: formatRangeLabel(rangeStart, calendarDays[calendarDays.length - 1]!),
  };
}

const cachedPlacesAgenda = unstable_cache(
  async (key: string, days: number) =>
    fetchPlacesAgenda(key === "all" ? undefined : (JSON.parse(key) as PlacesFilter), days),
  ["places-agenda"],
  { revalidate: 60, tags: ["venues"] }
);

export async function getPlacesAgenda(
  filter?: PlacesFilter,
  daysAhead = PLACES_AGENDA_DAYS
): Promise<PlacesAgendaResult> {
  const key = filter && Object.keys(filter).length > 0 ? JSON.stringify(filter) : "all";
  return cachedPlacesAgenda(key, daysAhead);
}
