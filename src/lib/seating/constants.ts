/** Minutes after leaving checkout before held seats are released. */
export const SEAT_IDLE_RELEASE_MINUTES = 15;

/** Absolute maximum hold from first selection (force re-select). */
export const SEAT_MAX_HOLD_MINUTES = 60;

/** Heartbeat interval while selecting (extends idle timer). */
export const SEAT_HEARTBEAT_SECONDS = 30;

/** How often other buyers refresh the map to see newly available seats. */
export const SEAT_STATUS_POLL_SECONDS = 4;

/** Delay before syncing seat holds to the server (batches rapid clicks). */
export const SEAT_HOLD_DEBOUNCE_MS = 350;

export const SEAT_STATUS = {
  AVAILABLE: "AVAILABLE",
  HELD: "HELD",
  SOLD: "SOLD",
  BLOCKED: "BLOCKED",
} as const;

export const SEAT_HOLD_PHASE = {
  SELECTING: "SELECTING",
  CHECKOUT: "CHECKOUT",
  IDLE: "IDLE",
} as const;

export type SeatStatus = (typeof SEAT_STATUS)[keyof typeof SEAT_STATUS];
export type SeatHoldPhase = (typeof SEAT_HOLD_PHASE)[keyof typeof SEAT_HOLD_PHASE];
