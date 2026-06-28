import { db } from "@/lib/db";
import {
  SEAT_HOLD_PHASE,
  SEAT_IDLE_RELEASE_MINUTES,
  SEAT_MAX_HOLD_MINUTES,
  SEAT_STATUS,
  type SeatHoldPhase,
} from "./constants";
import { parseLayoutJson } from "./layout-utils";
import type { SeatMapStatusPayload } from "./types";

export class SeatHoldError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "UNAVAILABLE" | "EXPIRED" | "FORBIDDEN" = "UNAVAILABLE"
  ) {
    super(message);
  }
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}

export async function expireStaleSeatHolds(eventSeatMapId?: string) {
  const now = new Date();
  const holds = await db.seatHold.findMany({
    where: {
      ...(eventSeatMapId ? { eventSeatMapId } : {}),
      OR: [{ expiresAt: { lte: now } }, { maxExpiresAt: { lte: now } }],
    },
  });

  for (const hold of holds) {
    await releaseHoldRecord(hold.id, "expired");
  }
}

async function releaseHoldRecord(holdId: string, reason: "expired" | "manual") {
  const hold = await db.seatHold.findUnique({ where: { id: holdId } });
  if (!hold) return;

  const seatIds: string[] = JSON.parse(hold.seatIdsJson);
  await db.seat.updateMany({
    where: {
      id: { in: seatIds },
      status: SEAT_STATUS.HELD,
    },
    data: { status: SEAT_STATUS.AVAILABLE },
  });
  await db.seatHold.delete({ where: { id: holdId } });
  void reason;
}

/** Drop HELD status on seats with no active hold; mark seats in active holds as HELD. */
async function reconcileHeldSeats(eventSeatMapId: string) {
  const now = new Date();
  const holds = await db.seatHold.findMany({
    where: {
      eventSeatMapId,
      expiresAt: { gt: now },
      maxExpiresAt: { gt: now },
    },
  });

  const activelyHeld = new Set<string>();
  for (const hold of holds) {
    for (const id of JSON.parse(hold.seatIdsJson) as string[]) {
      activelyHeld.add(id);
    }
  }

  if (activelyHeld.size === 0) {
    await db.seat.updateMany({
      where: { eventSeatMapId, status: SEAT_STATUS.HELD },
      data: { status: SEAT_STATUS.AVAILABLE },
    });
    return;
  }

  await db.seat.updateMany({
    where: {
      eventSeatMapId,
      status: SEAT_STATUS.HELD,
      id: { notIn: [...activelyHeld] },
    },
    data: { status: SEAT_STATUS.AVAILABLE },
  });

  await db.seat.updateMany({
    where: {
      eventSeatMapId,
      id: { in: [...activelyHeld] },
      status: { notIn: [SEAT_STATUS.SOLD, SEAT_STATUS.BLOCKED] },
    },
    data: { status: SEAT_STATUS.HELD },
  });
}

function findActiveHolds(eventSeatMapId: string) {
  const now = new Date();
  return db.seatHold.findMany({
    where: {
      eventSeatMapId,
      expiresAt: { gt: now },
      maxExpiresAt: { gt: now },
    },
  });
}

export async function getEventSeatMapForEvent(eventId: string) {
  await expireStaleSeatHolds();
  return db.eventSeatMap.findUnique({
    where: { eventId },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      seats: true,
    },
  });
}

export async function buildSeatMapStatus(
  eventId: string,
  userId?: string | null
): Promise<SeatMapStatusPayload | null> {
  const map = await getEventSeatMapForEvent(eventId);
  if (!map || !map.seatingEnabled || !map.published) return null;

  await reconcileHeldSeats(map.id);

  const layout = parseLayoutJson(map.layoutJson);
  let holdPayload: SeatMapStatusPayload["hold"] = null;

  const holds = await findActiveHolds(map.id);
  const heldByUserId = new Map<string, string>();
  for (const hold of holds) {
    for (const seatId of JSON.parse(hold.seatIdsJson) as string[]) {
      heldByUserId.set(seatId, hold.userId);
    }
  }

  if (userId) {
    const hold = holds.find((h) => h.userId === userId);
    if (hold) {
      const seatIds: string[] = JSON.parse(hold.seatIdsJson);
      holdPayload = {
        seatIds,
        expiresAt: hold.expiresAt.toISOString(),
        maxExpiresAt: hold.maxExpiresAt.toISOString(),
        idleReleaseAt: hold.idleReleaseAt?.toISOString() ?? null,
        phase: hold.phase,
      };
    }
  }

  return {
    layout,
    categories: map.categories.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      name: c.name,
      color: c.color,
      price: c.price,
      enabled: c.enabled,
    })),
    seats: map.seats.map((s) => {
      const holderUserId = heldByUserId.get(s.id);
      let status = s.status;
      if (s.status === SEAT_STATUS.SOLD || s.status === SEAT_STATUS.BLOCKED) {
        status = s.status;
      } else if (holderUserId) {
        status = SEAT_STATUS.HELD;
      } else {
        status = SEAT_STATUS.AVAILABLE;
      }

      return {
        id: s.id,
        externalId: s.externalId,
        label: s.label,
        sectionId: s.sectionId,
        categoryExternalId: s.categoryExternalId,
        status,
        enabled: s.enabled,
        heldByYou: !!userId && holderUserId === userId,
      };
    }),
    hold: holdPayload,
  };
}

export async function holdSeatsForUser(
  eventId: string,
  userId: string,
  seatExternalIds: string[],
  phase: SeatHoldPhase = SEAT_HOLD_PHASE.SELECTING
) {
  if (!seatExternalIds.length) throw new SeatHoldError("Select at least one seat.");

  const map = await db.eventSeatMap.findUnique({
    where: { eventId },
    include: { seats: true },
  });
  if (!map?.seatingEnabled || !map.published) {
    throw new SeatHoldError("Seating is not available for this event.", "NOT_FOUND");
  }

  await expireStaleSeatHolds(map.id);

  const targetSeats = map.seats.filter((s) => seatExternalIds.includes(s.externalId));
  if (targetSeats.length !== seatExternalIds.length) {
    throw new SeatHoldError("One or more seats were not found.");
  }

  const existingHold = await db.seatHold.findFirst({
    where: { eventSeatMapId: map.id, userId },
  });

  const now = new Date();
  const maxExpiresAt = existingHold?.maxExpiresAt ?? addMinutes(now, SEAT_MAX_HOLD_MINUTES);
  if (maxExpiresAt <= now) {
    if (existingHold) await releaseHoldRecord(existingHold.id, "expired");
    throw new SeatHoldError(
      "Your seat hold has expired. Please select seats again.",
      "EXPIRED"
    );
  }

  const previousSeatIds: string[] = existingHold ? JSON.parse(existingHold.seatIdsJson) : [];
  const previousSet = new Set(previousSeatIds);

  for (const seat of targetSeats) {
    if (!seat.enabled) throw new SeatHoldError(`Seat ${seat.label} is not available.`);
    if (seat.status === SEAT_STATUS.SOLD) {
      throw new SeatHoldError(`Seat ${seat.label} is already sold.`);
    }
    if (seat.status === SEAT_STATUS.BLOCKED) {
      throw new SeatHoldError(`Seat ${seat.label} is blocked.`);
    }
    if (seat.status === SEAT_STATUS.HELD && !previousSet.has(seat.id)) {
      throw new SeatHoldError(`Seat ${seat.label} is held by another buyer.`);
    }
  }

  const expiresAt =
    phase === SEAT_HOLD_PHASE.CHECKOUT
      ? maxExpiresAt
      : addMinutes(now, SEAT_IDLE_RELEASE_MINUTES);

  const seatIds = targetSeats.map((s) => s.id);

  if (existingHold) {
    const releaseIds = previousSeatIds.filter((id) => !seatIds.includes(id));
    if (releaseIds.length) {
      await db.seat.updateMany({
        where: { id: { in: releaseIds }, status: SEAT_STATUS.HELD },
        data: { status: SEAT_STATUS.AVAILABLE },
      });
    }
    await db.seatHold.update({
      where: { id: existingHold.id },
      data: {
        seatIdsJson: JSON.stringify(seatIds),
        expiresAt,
        maxExpiresAt,
        phase,
        idleReleaseAt:
          phase === SEAT_HOLD_PHASE.IDLE ? addMinutes(now, SEAT_IDLE_RELEASE_MINUTES) : null,
        heldAt: existingHold.heldAt,
      },
    });
  } else {
    await db.seatHold.create({
      data: {
        eventSeatMapId: map.id,
        userId,
        seatIdsJson: JSON.stringify(seatIds),
        heldAt: now,
        expiresAt,
        maxExpiresAt,
        phase,
        idleReleaseAt: null,
      },
    });
  }

  await db.seat.updateMany({
    where: { id: { in: seatIds }, status: { not: SEAT_STATUS.SOLD } },
    data: { status: SEAT_STATUS.HELD },
  });

  return buildSeatMapStatus(eventId, userId);
}

export async function releaseUserSeatHold(eventId: string, userId: string) {
  const map = await db.eventSeatMap.findUnique({ where: { eventId } });
  if (!map) return;

  const hold = await db.seatHold.findFirst({
    where: { eventSeatMapId: map.id, userId },
  });
  if (hold) await releaseHoldRecord(hold.id, "manual");
}

export async function markSeatsSold(eventId: string, userId: string, seatIds: string[]) {
  const map = await db.eventSeatMap.findUnique({ where: { eventId } });
  if (!map) return;

  const hold = await db.seatHold.findFirst({
    where: { eventSeatMapId: map.id, userId },
  });

  await db.seat.updateMany({
    where: { id: { in: seatIds }, eventSeatMapId: map.id },
    data: { status: SEAT_STATUS.SOLD },
  });
  if (hold) await db.seatHold.delete({ where: { id: hold.id } });
}

export async function validateUserSeatHold(
  eventId: string,
  userId: string,
  seatExternalIds: string[]
): Promise<{ seatDbIds: string[]; totalCents: number }> {
  const map = await getEventSeatMapForEvent(eventId);
  if (!map?.seatingEnabled) {
    throw new SeatHoldError("Seating is not enabled.", "NOT_FOUND");
  }

  const hold = await db.seatHold.findFirst({
    where: { eventSeatMapId: map.id, userId },
  });
  if (!hold) throw new SeatHoldError("Your seat selection expired. Please choose seats again.", "EXPIRED");

  const now = new Date();
  if (hold.expiresAt <= now || hold.maxExpiresAt <= now) {
    await releaseHoldRecord(hold.id, "expired");
    throw new SeatHoldError("Your seat hold expired. Please select seats again.", "EXPIRED");
  }

  const heldIds: string[] = JSON.parse(hold.seatIdsJson);
  const seats = map.seats.filter((s) => heldIds.includes(s.id));
  const extSet = new Set(seatExternalIds);
  const matched = seats.filter((s) => extSet.has(s.externalId));

  if (matched.length !== seatExternalIds.length) {
    throw new SeatHoldError("Seat selection mismatch. Please refresh and try again.");
  }

  let totalCents = 0;
  const catMap = new Map(map.categories.map((c) => [c.externalId, c]));
  for (const seat of matched) {
    const cat = seat.categoryExternalId ? catMap.get(seat.categoryExternalId) : undefined;
    if (!cat?.enabled) throw new SeatHoldError(`Seat ${seat.label} category is unavailable.`);
    totalCents += cat.price;
  }

  return { seatDbIds: matched.map((s) => s.id), totalCents };
}

export async function heartbeatSeatHold(
  eventId: string,
  userId: string,
  phase: SeatHoldPhase
) {
  const map = await db.eventSeatMap.findUnique({ where: { eventId } });
  if (!map) return null;

  const hold = await db.seatHold.findFirst({
    where: { eventSeatMapId: map.id, userId },
  });
  if (!hold) return null;

  const now = new Date();
  if (hold.maxExpiresAt <= now) {
    await releaseHoldRecord(hold.id, "expired");
    return null;
  }

  const expiresAt =
    phase === SEAT_HOLD_PHASE.CHECKOUT
      ? hold.maxExpiresAt
      : addMinutes(now, SEAT_IDLE_RELEASE_MINUTES);

  await db.seatHold.update({
    where: { id: hold.id },
    data: {
      phase,
      expiresAt,
      idleReleaseAt:
        phase === SEAT_HOLD_PHASE.IDLE ? addMinutes(now, SEAT_IDLE_RELEASE_MINUTES) : null,
    },
  });

  return buildSeatMapStatus(eventId, userId);
}
