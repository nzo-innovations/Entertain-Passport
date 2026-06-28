import { db } from "@/lib/db";
import { flattenLayoutSeats, parseLayoutJson, serializeLayout } from "./layout-utils";
import type { SeatLayoutDocument } from "./types";

const SEAT_CREATE_CHUNK = 500;
const SEAT_UPDATE_CHUNK = 50;

type SeatRowInput = {
  eventSeatMapId: string;
  externalId: string;
  sectionId: string | null;
  tableId: string | null;
  label: string;
  rowIndex: number | null;
  colIndex: number | null;
  categoryExternalId: string | null;
  enabled: boolean;
  status: string;
};

type SeatUpdateRow = Omit<SeatRowInput, "eventSeatMapId" | "externalId">;

function resolveSeatStatus(
  prev: { status: string } | undefined,
  preserved: string
): string {
  if (preserved === "SOLD") return "SOLD";
  if (prev?.status === "BLOCKED") return "BLOCKED";
  return preserved;
}

/**
 * Sync normalized seat rows from layout JSON into the database.
 * Avoids Prisma interactive/array transactions - they fail on Supabase PgBouncer (6543).
 */
export async function syncEventSeatMapFromLayout(eventSeatMapId: string, layoutJson: string) {
  const layout = parseLayoutJson(layoutJson);
  const flat = flattenLayoutSeats(layout);

  const existing = await db.seat.findMany({
    where: { eventSeatMapId },
    select: { id: true, externalId: true, status: true },
  });
  const existingByExt = new Map(existing.map((s) => [s.externalId, s]));

  const categoryRows = layout.categories.map((c, i) => ({
    eventSeatMapId,
    externalId: c.id,
    name: c.name,
    color: c.color,
    price: Math.round(Number(c.price) || 0),
    enabled: c.enabled ?? true,
    packageId: c.packageId ?? null,
    sortOrder: c.sortOrder ?? i,
  }));

  const keepExternalIds = new Set<string>();
  const toCreate: SeatRowInput[] = [];
  const toUpdate: { id: string; data: SeatUpdateRow }[] = [];

  for (const seat of flat) {
    keepExternalIds.add(seat.id);
    const prev = existingByExt.get(seat.id);
    const preserved =
      prev?.status === "SOLD" ? "SOLD" : prev?.status === "HELD" ? "HELD" : "AVAILABLE";

    const row: SeatUpdateRow = {
      sectionId: seat.sectionId ?? null,
      tableId: seat.tableId ?? null,
      label: seat.label ?? seat.id,
      rowIndex: seat.rowIndex,
      colIndex: seat.colIndex,
      categoryExternalId: seat.categoryId ?? null,
      enabled: seat.enabled ?? true,
      status: resolveSeatStatus(prev, preserved),
    };

    if (prev) {
      toUpdate.push({ id: prev.id, data: row });
    } else {
      toCreate.push({
        eventSeatMapId,
        externalId: seat.id,
        ...row,
        status: "AVAILABLE",
      });
    }
  }

  const toRemove = existing.filter((s) => !keepExternalIds.has(s.externalId) && s.status !== "SOLD");

  await db.seatCategory.deleteMany({ where: { eventSeatMapId } });
  if (categoryRows.length) {
    await db.seatCategory.createMany({ data: categoryRows });
  }

  if (toRemove.length) {
    await db.seat.deleteMany({ where: { id: { in: toRemove.map((s) => s.id) } } });
  }

  for (let i = 0; i < toCreate.length; i += SEAT_CREATE_CHUNK) {
    await db.seat.createMany({ data: toCreate.slice(i, i + SEAT_CREATE_CHUNK) });
  }

  for (let i = 0; i < toUpdate.length; i += SEAT_UPDATE_CHUNK) {
    const batch = toUpdate.slice(i, i + SEAT_UPDATE_CHUNK);
    await Promise.all(
      batch.map(({ id, data }) =>
        db.seat.update({
          where: { id },
          data,
        })
      )
    );
  }
}

export async function ensureEventSeatMap(eventId: string, layout?: SeatLayoutDocument) {
  const existing = await db.eventSeatMap.findUnique({ where: { eventId } });
  if (existing) return existing;

  const { blankLayout } = await import("./layout-utils");
  const doc = layout ?? blankLayout();
  const json = serializeLayout(doc);

  const map = await db.eventSeatMap.create({
    data: {
      eventId,
      layoutJson: json,
      seatingEnabled: false,
      published: false,
    },
  });
  await syncEventSeatMapFromLayout(map.id, json);
  return map;
}

export async function updateEventSeatMapLayout(
  eventId: string,
  layout: SeatLayoutDocument,
  opts?: { seatingEnabled?: boolean }
) {
  const json = serializeLayout(layout);
  const map = await db.eventSeatMap.upsert({
    where: { eventId },
    create: {
      eventId,
      layoutJson: json,
      seatingEnabled: opts?.seatingEnabled ?? false,
      published: false,
    },
    update: {
      layoutJson: json,
      ...(opts?.seatingEnabled !== undefined ? { seatingEnabled: opts.seatingEnabled } : {}),
    },
  });
  try {
    await syncEventSeatMapFromLayout(map.id, json);
  } catch (err) {
    console.error("[seating] syncEventSeatMapFromLayout failed", err);
    throw err instanceof Error ? err : new Error("Could not sync seats from layout");
  }
  return map;
}

export async function publishEventSeatMap(eventId: string) {
  const map = await db.eventSeatMap.findUnique({ where: { eventId } });
  if (!map) throw new Error("Seat map not found");
  if (!map.seatingEnabled) throw new Error("Enable seating before publishing");

  return db.eventSeatMap.update({
    where: { eventId },
    data: { published: true, publishedAt: new Date() },
  });
}
