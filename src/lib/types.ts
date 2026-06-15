export const UserRole = {
  CUSTOMER: "CUSTOMER",
  SUPER_ADMIN: "SUPER_ADMIN",
  ORGANIZER: "ORGANIZER",
  ARTIST_MANAGER: "ARTIST_MANAGER",
  ARTIST: "ARTIST",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  GATE_STAFF: "GATE_STAFF",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Creator lanes — each signup option maps to its own User.role (and Organization.type). */
export type CreatorRole =
  | typeof UserRole.ORGANIZER
  | typeof UserRole.ARTIST_MANAGER
  | typeof UserRole.ARTIST
  | typeof UserRole.BUSINESS_OWNER;

export const CREATOR_ROLES: readonly CreatorRole[] = [
  UserRole.ORGANIZER,
  UserRole.ARTIST_MANAGER,
  UserRole.ARTIST,
  UserRole.BUSINESS_OWNER,
];

const CREATOR_ROLE_SET = new Set<string>(CREATOR_ROLES);

export function isCreatorRole(role: string | null | undefined): role is CreatorRole {
  return !!role && CREATOR_ROLE_SET.has(role);
}

/** Roles that use the organizer portal (all creator lanes). */
export function isPortalRole(role: string | null | undefined): boolean {
  return isCreatorRole(role);
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Customer",
  SUPER_ADMIN: "Super Admin",
  ORGANIZER: "Event Organizer",
  ARTIST_MANAGER: "Artist Manager",
  ARTIST: "Artist",
  BUSINESS_OWNER: "Company / Venue Owner",
  GATE_STAFF: "Gate Staff",
};

export const OrgType = {
  ORGANIZER: "ORGANIZER",
  ARTIST_MANAGER: "ARTIST_MANAGER",
  ARTIST: "ARTIST",
  BUSINESS_OWNER: "BUSINESS_OWNER",
} as const;
export type OrgType = (typeof OrgType)[keyof typeof OrgType];

export const VenueKind = {
  PUB: "PUB",
  RESTAURANT: "RESTAURANT",
  CLUB: "CLUB",
  LOUNGE: "LOUNGE",
  COFFEE_SHOP: "COFFEE_SHOP",
  DATING_SPOT: "DATING_SPOT",
  OTHER: "OTHER",
} as const;
export type VenueKind = (typeof VenueKind)[keyof typeof VenueKind];

export const ActType = {
  SOLO: "SOLO",
  TRIO: "TRIO",
  FULL_BAND: "FULL_BAND",
  DJ: "DJ",
  OTHER: "OTHER",
} as const;
export type ActType = (typeof ActType)[keyof typeof ActType];

export const ProgramRecurrence = {
  WEEKLY: "WEEKLY",
  ONE_OFF: "ONE_OFF",
} as const;
export type ProgramRecurrence = (typeof ProgramRecurrence)[keyof typeof ProgramRecurrence];

export const OrgMemberRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  WORKER: "WORKER",
} as const;
export type OrgMemberRole = (typeof OrgMemberRole)[keyof typeof OrgMemberRole];

export const EventStaffRole = {
  SCANNER: "SCANNER",
  DOOR_MANAGER: "DOOR_MANAGER",
  EVENT_MANAGER: "EVENT_MANAGER",
} as const;
export type EventStaffRole = (typeof EventStaffRole)[keyof typeof EventStaffRole];

export const EventStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  SOLD_OUT: "SOLD_OUT",
  CANCELLED: "CANCELLED",
  ENDED: "ENDED",
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const ApprovalStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const CartStatus = {
  ACTIVE: "ACTIVE",
  CHECKED_OUT: "CHECKED_OUT",
  EXPIRED: "EXPIRED",
} as const;
export type CartStatus = (typeof CartStatus)[keyof typeof CartStatus];

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const TicketStatus = {
  VALID: "VALID",
  CHECKED_IN: "CHECKED_IN",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

/** Character set used to generate / validate printed physical ticket ref codes. */
export const PhysicalCodeCharset = {
  NUMERIC: "NUMERIC",
  ALPHANUMERIC: "ALPHANUMERIC",
} as const;
export type PhysicalCodeCharset = (typeof PhysicalCodeCharset)[keyof typeof PhysicalCodeCharset];

export const PHYSICAL_CODE_CHARSET_LABELS: Record<PhysicalCodeCharset, string> = {
  NUMERIC: "Numbers only (0-9)",
  ALPHANUMERIC: "Letters & numbers (A-Z, 0-9)",
};

/** Lifecycle of a single physical (printed) ticket reference code. */
export const PhysicalTicketStatus = {
  AVAILABLE: "AVAILABLE",
  SOLD: "SOLD",
  VOID: "VOID",
} as const;
export type PhysicalTicketStatus = (typeof PhysicalTicketStatus)[keyof typeof PhysicalTicketStatus];

export const PHYSICAL_TICKET_STATUS_LABELS: Record<PhysicalTicketStatus, string> = {
  AVAILABLE: "Available",
  SOLD: "Sold",
  VOID: "Void",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes requested",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  ORGANIZER: "Event Organizer",
  ARTIST_MANAGER: "Artist Manager",
  ARTIST: "Artist",
  BUSINESS_OWNER: "Business Owner",
};

export const VENUE_KIND_LABELS: Record<VenueKind, string> = {
  PUB: "Pub",
  RESTAURANT: "Restaurant",
  CLUB: "Club",
  LOUNGE: "Lounge",
  COFFEE_SHOP: "Coffee shop",
  DATING_SPOT: "Dating spot",
  OTHER: "Place",
};

export const ACT_TYPE_LABELS: Record<ActType, string> = {
  SOLO: "Solo artist",
  TRIO: "3-piece band",
  FULL_BAND: "Full band",
  DJ: "DJ set",
  OTHER: "Live music",
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Event is visible on the public site when both conditions hold. */
export function isPublicEvent(event: {
  status: string;
  approvalStatus: string;
}): boolean {
  return event.status === EventStatus.PUBLISHED && event.approvalStatus === ApprovalStatus.APPROVED;
}

export const FREE_STAFF_PER_EVENT = 2;
