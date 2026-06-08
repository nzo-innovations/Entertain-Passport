import { db } from "./db";
import { slugify } from "./utils";
import { toMinor, getCurrency, DEFAULT_CURRENCY, type CurrencyCode } from "./money";
import { DEFAULT_COMMISSION_PCT } from "./config";
import { ApprovalStatus, EventStatus, UserRole } from "./types";
import type { SessionUser } from "./auth";

export type CreateEventInput = {
  title: string;
  shortDescription?: string;
  description: string;
  categoryId: string;
  currency: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  organizationId?: string; // required for super admin; ignored for organizers
  commissionPct?: number; // honored only for super admin
  salesThreshold?: number;
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
  existingVenueId?: string;
  images?: string[];
  primaryIndex?: number;
  packages: Array<{ name: string; price: number; qtyTotal: number; perks?: string }>;
};

export class EventCreateError extends Error {}

/**
 * Resolves the platform commission for a new event.
 * - Super admin: may set any value (falls back to org/platform default).
 * - Organizers: cannot set it - we use the organization override or the
 *   platform default (5%). The field is read-only in their wizard.
 */
async function resolveCommission(
  isSuperAdmin: boolean,
  organizationId: string,
  requested?: number
): Promise<number> {
  const [org, settings] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { commissionPct: true } }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
  ]);
  const platformDefault = settings?.defaultCommissionPct ?? DEFAULT_COMMISSION_PCT;
  const orgDefault = org?.commissionPct ?? platformDefault;
  if (isSuperAdmin && typeof requested === "number" && requested >= 0) return requested;
  return orgDefault;
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || `event-${Date.now()}`;
  let slug = base;
  for (let i = 1; await db.event.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

export async function createEventForUser(user: SessionUser, input: CreateEventInput) {
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

  // Resolve the organization the event belongs to.
  let organizationId = input.organizationId;
  if (isSuperAdmin) {
    if (!organizationId) throw new EventCreateError("Please choose an organization for this event.");
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new EventCreateError("Organization not found.");
  } else {
    const org = await db.organization.findFirst({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      orderBy: { createdAt: "asc" },
    });
    if (!org) throw new EventCreateError("No organization found for your account.");
    organizationId = org.id;
  }

  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new EventCreateError("Please choose a valid category.");

  if (!input.date || !input.time) throw new EventCreateError("Please set the event date and start time.");
  const startsAt = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(startsAt.getTime())) throw new EventCreateError("Invalid date or time.");
  const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60 * 1000); // default 3h duration

  const validPackages = input.packages.filter((p) => p.name.trim() && p.qtyTotal > 0);
  if (validPackages.length === 0) throw new EventCreateError("Add at least one ticket package.");

  const currency: CurrencyCode = getCurrency(input.currency).code;
  const commissionPct = await resolveCommission(isSuperAdmin, organizationId!, input.commissionPct);
  const slug = await uniqueSlug(input.title);

  // Super-admin-created events are auto-approved & published; organizer events
  // start as DRAFT and are submitted for platform review.
  const status = isSuperAdmin ? EventStatus.PUBLISHED : EventStatus.DRAFT;
  const approvalStatus = isSuperAdmin ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_REVIEW;

  return db.$transaction(async (tx) => {
    let venueId: string;

    if (input.existingVenueId) {
      const linked = await tx.venue.findFirst({
        where: {
          id: input.existingVenueId,
          organizationId: organizationId!,
        },
      });
      if (!linked) throw new EventCreateError("Venue not found for your organization.");
      venueId = linked.id;
    } else {
      const venue = await tx.venue.create({
        data: {
          name: input.venue.name,
          address: input.venue.line1,
          line2: input.venue.line2 || null,
          city: input.venue.city,
          district: input.venue.district || null,
          province: input.venue.province || null,
          country: input.venue.country || "Sri Lanka",
          mapUrl: input.venue.mapUrl || null,
          capacity: input.venue.capacity ?? 0,
        },
      });
      venueId = venue.id;
    }

    const event = await tx.event.create({
      data: {
        title: input.title,
        slug,
        shortDescription: input.shortDescription || null,
        description: input.description,
        status,
        approvalStatus,
        startsAt,
        endsAt,
        currency,
        commissionPct,
        salesThreshold: input.salesThreshold ?? null,
        submittedAt: isSuperAdmin ? null : new Date(),
        reviewedAt: isSuperAdmin ? new Date() : null,
        reviewedById: isSuperAdmin ? user.id : null,
        organizationId: organizationId!,
        categoryId: category.id,
        venueId,
      },
    });

    if (input.images && input.images.length > 0) {
      const created = await Promise.all(
        input.images.map((url, i) =>
          tx.eventImage.create({ data: { url, sortOrder: i, eventId: event.id } })
        )
      );
      const primary = created[input.primaryIndex ?? 0] ?? created[0];
      if (primary) {
        await tx.event.update({ where: { id: event.id }, data: { primaryImageId: primary.id } });
      }
    }

    await tx.ticketPackage.createMany({
      data: validPackages.map((p, i) => ({
        eventId: event.id,
        name: p.name.trim(),
        price: toMinor(p.price, currency),
        qtyTotal: Math.round(p.qtyTotal),
        perksJson: p.perks
          ? JSON.stringify(
              p.perks
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          : null,
        sortOrder: i,
      })),
    });

    await tx.eventApprovalLog.create({
      data: {
        eventId: event.id,
        fromStatus: ApprovalStatus.DRAFT,
        toStatus: approvalStatus,
        actorId: user.id,
        note: isSuperAdmin ? "Created & published by Super Admin" : "Submitted for platform review",
      },
    });

    return event;
  });
}

// Re-export so callers can reference the default without importing config.
export { DEFAULT_CURRENCY };
