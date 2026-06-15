import { db } from "./db";
import { PhysicalCodeCharset, PhysicalTicketStatus } from "./types";

/**
 * Physical (printed) ticket management.
 *
 * A physical ticket is a pre-printed reference code that belongs to a ticket
 * category (TicketPackage). When an event enables physical tickets, every
 * category must have a matching number of ref codes before it can be published.
 * Physical tickets are sold offline via an explicit manual action.
 *
 * Money is stored in INTEGER MINOR UNITS (see lib/money.ts). All income figures
 * returned here are also in minor units so callers can format with formatMoney.
 */

export class PhysicalTicketError extends Error {}

const NUMERIC_RE = /^[0-9]+$/;
const ALPHANUMERIC_RE = /^[0-9A-Z]+$/;

/** Hard cap on how many codes a single range request may generate. */
export const MAX_RANGE = 100_000;

export type PhysicalCodeOpts = {
  length?: number | null;
  charset: string;
};

export function normalizeRefCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function charsetRegex(charset: string): RegExp {
  return charset === PhysicalCodeCharset.ALPHANUMERIC ? ALPHANUMERIC_RE : NUMERIC_RE;
}

function radixFor(charset: string): number {
  return charset === PhysicalCodeCharset.ALPHANUMERIC ? 36 : 10;
}

/** Validates and normalizes a single ref code against the event's config. */
export function validateRefCode(raw: string, opts: PhysicalCodeOpts): string {
  const code = normalizeRefCode(raw);
  if (!code) throw new PhysicalTicketError("A ticket reference code cannot be empty.");
  if (!charsetRegex(opts.charset).test(code)) {
    throw new PhysicalTicketError(
      opts.charset === PhysicalCodeCharset.ALPHANUMERIC
        ? `"${code}" may only contain letters (A-Z) and numbers (0-9).`
        : `"${code}" may only contain digits (0-9).`
    );
  }
  if (opts.length && code.length !== opts.length) {
    throw new PhysicalTicketError(`"${code}" must be exactly ${opts.length} characters long.`);
  }
  return code;
}

/**
 * Generates every code between `start` and `end` (inclusive), incrementing in
 * the configured base (10 for numeric, 36 for alphanumeric) and zero-padding to
 * the fixed length. e.g. "0000010" -> "0000012" produces 0000010, 0000011, 0000012.
 */
export function generateRange(startRaw: string, endRaw: string, opts: PhysicalCodeOpts): string[] {
  const start = validateRefCode(startRaw, opts);
  const end = validateRefCode(endRaw, opts);
  const length = opts.length ?? Math.max(start.length, end.length);
  const radix = radixFor(opts.charset);

  const s = parseInt(start, radix);
  const e = parseInt(end, radix);
  if (Number.isNaN(s) || Number.isNaN(e)) {
    throw new PhysicalTicketError("The range start and end are not valid codes.");
  }
  if (e < s) {
    throw new PhysicalTicketError("The range end must be greater than or equal to the range start.");
  }
  const count = e - s + 1;
  if (count > MAX_RANGE) {
    throw new PhysicalTicketError(`That range is too large (${count} codes). Add at most ${MAX_RANGE} at a time.`);
  }

  const out: string[] = [];
  for (let i = s; i <= e; i++) {
    const code = i.toString(radix).toUpperCase().padStart(length, "0");
    if (opts.length && code.length !== opts.length) {
      throw new PhysicalTicketError(`That range overflows the configured code length of ${opts.length}.`);
    }
    out.push(code);
  }
  return out;
}

// ----- Event config -----------------------------------------------------------

export type EventPhysicalConfig = {
  id: string;
  physicalTicketsEnabled: boolean;
  physicalCodeLength: number | null;
  physicalCodeCharset: string;
};

async function requirePhysicalEvent(eventId: string): Promise<EventPhysicalConfig> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      physicalTicketsEnabled: true,
      physicalCodeLength: true,
      physicalCodeCharset: true,
    },
  });
  if (!event) throw new PhysicalTicketError("Event not found.");
  if (!event.physicalTicketsEnabled) {
    throw new PhysicalTicketError("Physical ticket management is turned off for this event.");
  }
  return event;
}

async function ensurePackageInEvent(eventId: string, packageId: string): Promise<void> {
  const pkg = await db.ticketPackage.findFirst({
    where: { id: packageId, eventId },
    select: { id: true },
  });
  if (!pkg) throw new PhysicalTicketError("That ticket category does not belong to this event.");
}

export type UpdateConfigInput = {
  enabled: boolean;
  length?: number | null;
  charset?: string;
};

export async function updatePhysicalConfig(eventId: string, input: UpdateConfigInput) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new PhysicalTicketError("Event not found.");

  if (input.enabled) {
    const length = input.length ?? null;
    if (length !== null && (!Number.isInteger(length) || length < 1 || length > 32)) {
      throw new PhysicalTicketError("Code length must be a whole number between 1 and 32.");
    }
    const charset = input.charset ?? PhysicalCodeCharset.NUMERIC;
    if (charset !== PhysicalCodeCharset.NUMERIC && charset !== PhysicalCodeCharset.ALPHANUMERIC) {
      throw new PhysicalTicketError("Invalid character set.");
    }
    return db.event.update({
      where: { id: eventId },
      data: { physicalTicketsEnabled: true, physicalCodeLength: length, physicalCodeCharset: charset },
    });
  }

  return db.event.update({
    where: { id: eventId },
    data: { physicalTicketsEnabled: false },
  });
}

// ----- Mismatch / publish gating ----------------------------------------------

export type CategoryMismatch = {
  packageId: string;
  name: string;
  qtyTotal: number;
  refCount: number;
  ok: boolean;
};

/**
 * For each ticket category, compares its quantity against the number of usable
 * (non-void) physical ref codes. VOID codes do not count toward the requirement.
 */
export async function getPhysicalMismatches(eventId: string): Promise<CategoryMismatch[]> {
  const [packages, grouped] = await Promise.all([
    db.ticketPackage.findMany({
      where: { eventId },
      select: { id: true, name: true, qtyTotal: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.physicalTicket.groupBy({
      by: ["packageId"],
      where: { eventId, status: { not: PhysicalTicketStatus.VOID } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(grouped.map((g) => [g.packageId, g._count._all]));
  return packages.map((p) => {
    const refCount = counts.get(p.id) ?? 0;
    return { packageId: p.id, name: p.name, qtyTotal: p.qtyTotal, refCount, ok: refCount === p.qtyTotal };
  });
}

/** Throws when physical tickets are enabled but ref counts don't match quantities. */
export async function assertPhysicalReady(eventId: string): Promise<void> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { physicalTicketsEnabled: true },
  });
  if (!event?.physicalTicketsEnabled) return;

  const mismatches = (await getPhysicalMismatches(eventId)).filter((m) => !m.ok);
  if (mismatches.length > 0) {
    const detail = mismatches
      .map((m) => `"${m.name}" has ${m.refCount} of ${m.qtyTotal} codes`)
      .join("; ");
    throw new PhysicalTicketError(
      `Physical ticket codes don't match ticket quantities: ${detail}. Resolve every mismatch before publishing.`
    );
  }
}

// ----- CRUD -------------------------------------------------------------------

export type PhysicalTicketRow = {
  id: string;
  packageId: string;
  refCode: string;
  status: string;
  soldAt: string | null;
  note: string | null;
};

export async function listPhysicalTickets(
  eventId: string,
  opts?: { packageId?: string; status?: string; q?: string }
): Promise<PhysicalTicketRow[]> {
  const q = opts?.q?.trim();
  const rows = await db.physicalTicket.findMany({
    where: {
      eventId,
      ...(opts?.packageId ? { packageId: opts.packageId } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(q ? { refCode: { contains: q.toUpperCase() } } : {}),
    },
    orderBy: { refCode: "asc" },
    take: 1000,
  });
  return rows.map((r) => ({
    id: r.id,
    packageId: r.packageId,
    refCode: r.refCode,
    status: r.status,
    soldAt: r.soldAt ? r.soldAt.toISOString() : null,
    note: r.note,
  }));
}

export async function addSinglePhysicalTicket(eventId: string, packageId: string, refCodeRaw: string) {
  const event = await requirePhysicalEvent(eventId);
  await ensurePackageInEvent(eventId, packageId);
  const refCode = validateRefCode(refCodeRaw, {
    length: event.physicalCodeLength,
    charset: event.physicalCodeCharset,
  });

  const clash = await db.physicalTicket.findUnique({
    where: { eventId_refCode: { eventId, refCode } },
    select: { id: true },
  });
  if (clash) throw new PhysicalTicketError(`Ref code "${refCode}" already exists for this event.`);

  return db.physicalTicket.create({ data: { eventId, packageId, refCode } });
}

export async function addPhysicalTicketRange(
  eventId: string,
  packageId: string,
  startRaw: string,
  endRaw: string
): Promise<{ added: number; skipped: number }> {
  const event = await requirePhysicalEvent(eventId);
  await ensurePackageInEvent(eventId, packageId);

  const codes = generateRange(startRaw, endRaw, {
    length: event.physicalCodeLength,
    charset: event.physicalCodeCharset,
  });

  const existing = await db.physicalTicket.findMany({
    where: { eventId, refCode: { in: codes } },
    select: { refCode: true },
  });
  const existingSet = new Set(existing.map((e) => e.refCode));
  const toCreate = codes.filter((c) => !existingSet.has(c));

  if (toCreate.length === 0) {
    throw new PhysicalTicketError("Every code in that range already exists for this event.");
  }

  await db.physicalTicket.createMany({
    data: toCreate.map((refCode) => ({ eventId, packageId, refCode })),
  });

  return { added: toCreate.length, skipped: codes.length - toCreate.length };
}

export type UpdatePhysicalInput = {
  refCode?: string;
  status?: string;
  note?: string | null;
};

export async function updatePhysicalTicket(
  eventId: string,
  refId: string,
  input: UpdatePhysicalInput,
  actorId: string
) {
  const event = await requirePhysicalEvent(eventId);
  const ticket = await db.physicalTicket.findFirst({ where: { id: refId, eventId } });
  if (!ticket) throw new PhysicalTicketError("Physical ticket not found for this event.");

  const data: Record<string, unknown> = {};

  if (input.refCode !== undefined) {
    const refCode = validateRefCode(input.refCode, {
      length: event.physicalCodeLength,
      charset: event.physicalCodeCharset,
    });
    if (refCode !== ticket.refCode) {
      const clash = await db.physicalTicket.findUnique({
        where: { eventId_refCode: { eventId, refCode } },
        select: { id: true },
      });
      if (clash) throw new PhysicalTicketError(`Ref code "${refCode}" already exists for this event.`);
      data.refCode = refCode;
    }
  }

  if (input.status !== undefined) {
    if (
      input.status !== PhysicalTicketStatus.AVAILABLE &&
      input.status !== PhysicalTicketStatus.SOLD &&
      input.status !== PhysicalTicketStatus.VOID
    ) {
      throw new PhysicalTicketError("Invalid status.");
    }
    data.status = input.status;
    if (input.status === PhysicalTicketStatus.SOLD) {
      data.soldAt = new Date();
      data.soldById = actorId;
    } else {
      data.soldAt = null;
      data.soldById = null;
    }
  }

  if (input.note !== undefined) {
    data.note = input.note?.trim() || null;
  }

  return db.physicalTicket.update({ where: { id: ticket.id }, data });
}

export async function deletePhysicalTicket(eventId: string, refId: string) {
  const ticket = await db.physicalTicket.findFirst({ where: { id: refId, eventId }, select: { id: true } });
  if (!ticket) throw new PhysicalTicketError("Physical ticket not found for this event.");
  await db.physicalTicket.delete({ where: { id: ticket.id } });
}

// ----- Reporting --------------------------------------------------------------

export type CategoryReport = {
  packageId: string;
  name: string;
  price: number; // minor units
  planned: number; // category quantity (qtyTotal)
  configured: number; // non-void ref codes
  sold: number;
  available: number;
  voided: number;
  grossIncome: number; // minor units, sold * price
  commission: number; // minor units
  netIncome: number; // minor units, gross - commission
};

export type PhysicalReport = {
  event: {
    id: string;
    title: string;
    currency: string;
    commissionPct: number;
    physicalTicketsEnabled: boolean;
    venueName: string;
    organizationName: string;
    startsAt: string;
  };
  categories: CategoryReport[];
  totals: Omit<CategoryReport, "packageId" | "name" | "price">;
};

export async function getPhysicalReport(eventId: string): Promise<PhysicalReport> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      currency: true,
      commissionPct: true,
      physicalTicketsEnabled: true,
      startsAt: true,
      venue: { select: { name: true } },
      organization: { select: { name: true } },
      packages: {
        select: { id: true, name: true, price: true, qtyTotal: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!event) throw new PhysicalTicketError("Event not found.");

  const grouped = await db.physicalTicket.groupBy({
    by: ["packageId", "status"],
    where: { eventId },
    _count: { _all: true },
  });

  const statusByPkg = new Map<string, { sold: number; available: number; voided: number }>();
  for (const g of grouped) {
    const entry = statusByPkg.get(g.packageId) ?? { sold: 0, available: 0, voided: 0 };
    if (g.status === PhysicalTicketStatus.SOLD) entry.sold += g._count._all;
    else if (g.status === PhysicalTicketStatus.VOID) entry.voided += g._count._all;
    else entry.available += g._count._all;
    statusByPkg.set(g.packageId, entry);
  }

  const commissionPct = event.commissionPct ?? 0;
  const categories: CategoryReport[] = event.packages.map((p) => {
    const s = statusByPkg.get(p.id) ?? { sold: 0, available: 0, voided: 0 };
    const configured = s.sold + s.available;
    const grossIncome = s.sold * p.price;
    const commission = Math.round((grossIncome * commissionPct) / 100);
    return {
      packageId: p.id,
      name: p.name,
      price: p.price,
      planned: p.qtyTotal,
      configured,
      sold: s.sold,
      available: s.available,
      voided: s.voided,
      grossIncome,
      commission,
      netIncome: grossIncome - commission,
    };
  });

  const totals = categories.reduce(
    (acc, c) => ({
      planned: acc.planned + c.planned,
      configured: acc.configured + c.configured,
      sold: acc.sold + c.sold,
      available: acc.available + c.available,
      voided: acc.voided + c.voided,
      grossIncome: acc.grossIncome + c.grossIncome,
      commission: acc.commission + c.commission,
      netIncome: acc.netIncome + c.netIncome,
    }),
    { planned: 0, configured: 0, sold: 0, available: 0, voided: 0, grossIncome: 0, commission: 0, netIncome: 0 }
  );

  return {
    event: {
      id: event.id,
      title: event.title,
      currency: event.currency,
      commissionPct,
      physicalTicketsEnabled: event.physicalTicketsEnabled,
      venueName: event.venue.name,
      organizationName: event.organization.name,
      startsAt: event.startsAt.toISOString(),
    },
    categories,
    totals,
  };
}

/** Per-category lists of sold vs remaining (available) ref codes. */
export async function getRemainingVsSold(eventId: string) {
  const [packages, tickets] = await Promise.all([
    db.ticketPackage.findMany({
      where: { eventId },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.physicalTicket.findMany({
      where: { eventId, status: { not: PhysicalTicketStatus.VOID } },
      select: { packageId: true, refCode: true, status: true },
      orderBy: { refCode: "asc" },
    }),
  ]);

  return packages.map((p) => {
    const own = tickets.filter((t) => t.packageId === p.id);
    return {
      packageId: p.id,
      name: p.name,
      sold: own.filter((t) => t.status === PhysicalTicketStatus.SOLD).map((t) => t.refCode),
      available: own.filter((t) => t.status === PhysicalTicketStatus.AVAILABLE).map((t) => t.refCode),
    };
  });
}

// ----- Gate check-in suggestions ---------------------------------------------

export type GatePhysicalSuggestion = {
  packageId: string;
  packageName: string;
  purchasedQty: number;
  available: Array<{ id: string; refCode: string }>;
};

/**
 * After a successful logical check-in, gate staff can mark the matching printed
 * ticket as sold. Suggestions are scoped to the checked-in ticket's order and
 * only returned when the event's physical inventory is enabled and fully valid.
 */
export async function getGatePhysicalSuggestionsForTicket(
  eventId: string,
  ticketId: string
): Promise<GatePhysicalSuggestion[]> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { physicalTicketsEnabled: true },
  });
  if (!event?.physicalTicketsEnabled) return [];

  const mismatches = await getPhysicalMismatches(eventId);
  if (mismatches.some((m) => !m.ok)) return [];

  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, orderItem: { eventId } },
    select: { orderItem: { select: { orderId: true } } },
  });
  if (!ticket) return [];

  const orderItems = await db.orderItem.findMany({
    where: { eventId, orderId: ticket.orderItem.orderId },
    select: {
      packageId: true,
      qty: true,
      package: { select: { name: true, sortOrder: true } },
    },
    orderBy: { package: { sortOrder: "asc" } },
  });

  return Promise.all(
    orderItems.map(async (item) => {
      const available = await db.physicalTicket.findMany({
        where: {
          eventId,
          packageId: item.packageId,
          status: PhysicalTicketStatus.AVAILABLE,
        },
        select: { id: true, refCode: true },
        orderBy: { refCode: "asc" },
        take: 300,
      });
      return {
        packageId: item.packageId,
        packageName: item.package.name,
        purchasedQty: item.qty,
        available,
      };
    })
  );
}
