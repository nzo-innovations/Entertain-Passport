import { db } from "./db";
import { UserRole, ApprovalStatus, OrgMemberRole, EventStaffRole } from "./types";
import type { SessionUser } from "./auth";

export async function getUserOrganizations(userId: string) {
  return db.organization.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { events: true, members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function canAccessOrganization(userId: string, organizationId: string) {
  const org = await db.organization.findFirst({
    where: {
      id: organizationId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
  return !!org;
}

export async function canManageEvent(userId: string, eventId: string, userRole?: string) {
  if (userRole === UserRole.SUPER_ADMIN) return true;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      organization: {
        select: {
          ownerId: true,
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      },
    },
  });
  if (!event) return false;

  if (event.organization.ownerId === userId) return true;
  const membership = event.organization.members[0];
  return membership?.role === OrgMemberRole.OWNER || membership?.role === OrgMemberRole.ADMIN;
}

export async function canScanEventTickets(userId: string, eventId: string, userRole?: string) {
  if (userRole === UserRole.SUPER_ADMIN) return true;

  const [canManage, staff] = await Promise.all([
    canManageEvent(userId, eventId, userRole),
    db.eventStaff.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { role: true },
    }),
  ]);
  if (canManage) return true;

  return (
    staff?.role === EventStaffRole.SCANNER ||
    staff?.role === EventStaffRole.DOOR_MANAGER ||
    staff?.role === EventStaffRole.EVENT_MANAGER
  );
}

/**
 * Who may roll back / undo a check-in. Per product rule, a plain gate
 * staff/scanner cannot; only an Event Manager (or the org owner/admin, or
 * Super Admin) can reverse a wrong check-in.
 */
export async function canManageCheckIns(userId: string, eventId: string, userRole?: string) {
  if (userRole === UserRole.SUPER_ADMIN) return true;
  if (await canManageEvent(userId, eventId, userRole)) return true;

  const staff = await db.eventStaff.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  return staff?.role === EventStaffRole.EVENT_MANAGER;
}

export async function getOrganizerEvents(userId: string, userRole?: string) {
  if (userRole === UserRole.SUPER_ADMIN) {
    return db.event.findMany({
      include: eventListInclude,
      orderBy: { startsAt: "asc" },
    });
  }

  const orgWhere = { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
  return db.event.findMany({
    where: {
      OR: [
        { organization: orgWhere },
        // Events where one of the user's orgs is tagged as a performing artist.
        { artists: { some: { organization: orgWhere } } },
      ],
    },
    include: eventListInclude,
    orderBy: { startsAt: "asc" },
  });
}

export const eventListInclude = {
  category: true,
  venue: true,
  organization: true,
  packages: true,
  staff: { include: { user: { select: { id: true, name: true, email: true } } } },
  artists: { include: { organization: { select: { id: true, name: true } } } },
  approvalLogs: { orderBy: { createdAt: "desc" as const }, take: 5 },
  primaryImage: true,
};

export async function logApprovalChange(
  eventId: string,
  fromStatus: string,
  toStatus: string,
  actorId: string | null,
  note?: string
) {
  return db.eventApprovalLog.create({
    data: { eventId, fromStatus, toStatus, actorId, note },
  });
}

export async function submitEventForReview(eventId: string, actorId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(event.approvalStatus)) {
    throw new Error("Event cannot be submitted in current state");
  }

  const from = event.approvalStatus;
  await db.event.update({
    where: { id: eventId },
    data: {
      approvalStatus: ApprovalStatus.PENDING_REVIEW,
      submittedAt: new Date(),
      reviewNote: null,
    },
  });
  await logApprovalChange(eventId, from, ApprovalStatus.PENDING_REVIEW, actorId, "Submitted for platform review");
}

export async function reviewEvent(
  eventId: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  reviewerId: string,
  note?: string
) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.approvalStatus !== ApprovalStatus.PENDING_REVIEW) {
    throw new Error("Event is not pending review");
  }

  const from = event.approvalStatus;
  const updates: {
    approvalStatus: string;
    reviewedAt: Date;
    reviewedById: string;
    reviewNote: string | null;
    status?: string;
  } = {
    approvalStatus: decision,
    reviewedAt: new Date(),
    reviewedById: reviewerId,
    reviewNote: note ?? null,
  };

  if (decision === ApprovalStatus.APPROVED) {
    updates.status = "PUBLISHED";
  }

  await db.event.update({ where: { id: eventId }, data: updates });
  await logApprovalChange(eventId, from, decision, reviewerId, note);
}

export function computeStaffBilling(staffCount: number, freeLimit = 2, feePerExtra = 1500) {
  const billable = Math.max(0, staffCount - freeLimit);
  return { billable, monthlyFeeCents: billable * feePerExtra };
}
