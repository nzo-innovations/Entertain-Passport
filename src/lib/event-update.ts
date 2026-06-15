import { db } from "./db";
import { toMinor, getCurrency, type CurrencyCode } from "./money";
import { UserRole, ApprovalStatus, EventStatus } from "./types";
import type { SessionUser } from "./auth";
import { assertPhysicalReady } from "./physical-tickets";

export class EventUpdateError extends Error {}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type EventWithRelations = {
  id: string;
  title: string;
  shortDescription: string | null;
  description: string;
  categoryId: string;
  currency: string;
  startsAt: Date;
  salesThreshold: number | null;
  status: string;
  commissionPct: number;
  primaryImageId: string | null;
  venue: {
    name: string;
    address: string;
    line2: string | null;
    city: string;
    district: string | null;
    province: string | null;
    country: string;
    mapUrl: string | null;
  };
  packages: Array<{ id: string; name: string; price: number; qtyTotal: number; qtySold: number; perksJson: string | null }>;
  images: Array<{ id: string; url: string; sortOrder: number }>;
};

/** Maps a DB event (+venue +packages +images) into the shape the edit form expects. */
export function eventToEditInitial(event: EventWithRelations) {
  const d = event.startsAt;
  const minorPer = getCurrency(event.currency).minorUnits;
  const sortedImages = [...event.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryIndex = event.primaryImageId
    ? Math.max(0, sortedImages.findIndex((i) => i.id === event.primaryImageId))
    : 0;
  return {
    id: event.id,
    title: event.title,
    shortDescription: event.shortDescription ?? "",
    description: event.description,
    categoryId: event.categoryId,
    currency: event.currency,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    salesThreshold: event.salesThreshold,
    status: event.status,
    commissionPct: event.commissionPct,
    images: sortedImages.map((i) => i.url),
    primaryIndex: sortedImages.length ? primaryIndex : 0,
    venue: {
      name: event.venue.name,
      line1: event.venue.address,
      line2: event.venue.line2 ?? "",
      city: event.venue.city,
      district: event.venue.district ?? "",
      province: event.venue.province ?? "",
      country: event.venue.country ?? "Sri Lanka",
      mapUrl: event.venue.mapUrl ?? "",
    },
    packages: event.packages.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price / minorPer,
      qtyTotal: p.qtyTotal,
      qtySold: p.qtySold,
      perks: (() => {
        try {
          return p.perksJson ? (JSON.parse(p.perksJson) as string[]).join(", ") : "";
        } catch {
          return "";
        }
      })(),
    })),
  };
}

export type UpdateEventInput = {
  title: string;
  shortDescription?: string;
  description: string;
  categoryId: string;
  currency: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  salesThreshold?: number | null;
  status?: string; // super admin only
  commissionPct?: number; // super admin only
  venue: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    district?: string;
    province?: string;
    country?: string;
    mapUrl?: string;
    capacity?: number;
  };
  packages: Array<{
    id?: string;
    name: string;
    price: number; // major units
    qtyTotal: number;
    perks?: string;
  }>;
  images?: string[];
  primaryIndex?: number;
};

const clean = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
const VALID_STATUS = ["DRAFT", "PUBLISHED", "SOLD_OUT", "CANCELLED", "ENDED"];

/**
 * Edits an event the user is allowed to manage. Organizers can change content
 * and ticketing; only Super Admin can change commission and lifecycle status.
 */
export async function updateEventForUser(user: SessionUser, eventId: string, input: UpdateEventInput) {
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { packages: true, venue: true, images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) throw new EventUpdateError("Event not found.");

  if (input.images !== undefined && input.images.length === 0) {
    throw new EventUpdateError("Add at least one event image.");
  }

  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new EventUpdateError("Please choose a valid category.");

  if (!input.date || !input.time) throw new EventUpdateError("Please set the event date and time.");
  const startsAt = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(startsAt.getTime())) throw new EventUpdateError("Invalid date or time.");
  const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  const currency: CurrencyCode = getCurrency(input.currency).code;

  // Once an event has been approved/published, prices are locked. Quantities can
  // still move up or down, but a price change requires a brand-new category.
  const pricingLocked = event.approvalStatus === ApprovalStatus.APPROVED;
  const minorPerExisting = getCurrency(event.currency).minorUnits;

  // ---- Validate package edits against sold counts ----
  const existingById = new Map(event.packages.map((p) => [p.id, p]));
  const keptIds = new Set(input.packages.filter((p) => p.id).map((p) => p.id as string));

  for (const incoming of input.packages) {
    if (!incoming.name.trim()) throw new EventUpdateError("Each ticket package needs a name.");
    if (incoming.id) {
      const existing = existingById.get(incoming.id);
      if (!existing) throw new EventUpdateError("A ticket package no longer exists.");
      if (incoming.qtyTotal < existing.qtySold) {
        throw new EventUpdateError(
          `"${existing.name}" already sold ${existing.qtySold}; quantity can't be lower than that.`
        );
      }
      if (pricingLocked) {
        const existingMajor = existing.price / minorPerExisting;
        if (Number(incoming.price) !== existingMajor) {
          throw new EventUpdateError(
            `"${existing.name}" is already live — its price can't be changed. Add a new ticket category for the new price instead.`
          );
        }
      }
    } else if (incoming.qtyTotal < 0) {
      throw new EventUpdateError("Quantity must be zero or more.");
    }
  }

  // Super Admin moving an event to PUBLISHED must satisfy physical ticket matching.
  if (isSuperAdmin && input.status === EventStatus.PUBLISHED) {
    await assertPhysicalReady(eventId);
  }

  // Packages being removed must have no sales.
  const toDelete = event.packages.filter((p) => !keptIds.has(p.id));
  for (const p of toDelete) {
    if (p.qtySold > 0) {
      throw new EventUpdateError(`Can't remove "${p.name}" - ${p.qtySold} ticket(s) already sold.`);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.venue.update({
      where: { id: event.venueId },
      data: {
        name: input.venue.name,
        address: input.venue.line1,
        line2: clean(input.venue.line2),
        city: input.venue.city,
        district: clean(input.venue.district),
        province: clean(input.venue.province),
        country: input.venue.country?.trim() || "Sri Lanka",
        mapUrl: clean(input.venue.mapUrl),
        capacity: input.venue.capacity ?? event.venue.capacity,
      },
    });

    const eventData: Record<string, unknown> = {
      title: input.title,
      shortDescription: clean(input.shortDescription),
      description: input.description,
      categoryId: category.id,
      currency,
      startsAt,
      endsAt,
      salesThreshold: input.salesThreshold ?? null,
    };
    if (isSuperAdmin && typeof input.commissionPct === "number") {
      eventData.commissionPct = input.commissionPct;
    }
    if (isSuperAdmin && input.status && VALID_STATUS.includes(input.status)) {
      eventData.status = input.status;
    }
    await tx.event.update({ where: { id: eventId }, data: eventData });

    if (toDelete.length > 0) {
      await tx.ticketPackage.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
    }

    for (let i = 0; i < input.packages.length; i++) {
      const p = input.packages[i];
      const perksJson = p.perks
        ? JSON.stringify(p.perks.split(",").map((s) => s.trim()).filter(Boolean))
        : null;
      if (p.id && existingById.has(p.id)) {
        await tx.ticketPackage.update({
          where: { id: p.id },
          data: {
            name: p.name.trim(),
            price: toMinor(p.price, currency),
            qtyTotal: Math.round(p.qtyTotal),
            perksJson,
            sortOrder: i,
          },
        });
      } else {
        await tx.ticketPackage.create({
          data: {
            eventId,
            name: p.name.trim(),
            price: toMinor(p.price, currency),
            qtyTotal: Math.round(p.qtyTotal),
            perksJson,
            sortOrder: i,
          },
        });
      }
    }

    if (input.images !== undefined) {
      const incoming = input.images;
      const existingImages = event.images;
      const existingByUrl = new Map(existingImages.map((img) => [img.url, img]));
      const toRemove = existingImages.filter((img) => !incoming.includes(img.url));

      if (toRemove.some((img) => img.id === event.primaryImageId)) {
        await tx.event.update({ where: { id: eventId }, data: { primaryImageId: null } });
      }

      if (toRemove.length > 0) {
        await tx.eventImage.deleteMany({ where: { id: { in: toRemove.map((i) => i.id) } } });
      }

      const kept: { id: string; url: string }[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const url = incoming[i];
        const existing = existingByUrl.get(url);
        if (existing) {
          await tx.eventImage.update({ where: { id: existing.id }, data: { sortOrder: i } });
          kept.push(existing);
        } else {
          const created = await tx.eventImage.create({
            data: { eventId, url, sortOrder: i },
          });
          kept.push(created);
        }
      }

      const primaryIdx = input.primaryIndex ?? 0;
      const primary = kept[primaryIdx] ?? kept[0];
      if (primary) {
        await tx.event.update({ where: { id: eventId }, data: { primaryImageId: primary.id } });
      }
    }
  });

  return db.event.findUnique({ where: { id: eventId } });
}

/**
 * Deletes an event. Blocked when tickets have been sold (those records must be
 * preserved) - cancel the event instead in that case.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const orderItemCount = await db.orderItem.count({ where: { eventId } });
  if (orderItemCount > 0) {
    throw new EventUpdateError(
      "This event already has ticket sales. Cancel it instead of deleting to preserve order records."
    );
  }
  await db.event.delete({ where: { id: eventId } });
}
