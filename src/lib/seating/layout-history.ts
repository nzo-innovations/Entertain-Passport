import type { SeatLayoutDocument } from "./types";

const MAX_HISTORY = 60;

export type LayoutHistoryState = {
  past: SeatLayoutDocument[];
  present: SeatLayoutDocument;
  future: SeatLayoutDocument[];
};

export function createLayoutHistory(initial: SeatLayoutDocument): LayoutHistoryState {
  return { past: [], present: initial, future: [] };
}

export function commitLayoutHistory(
  state: LayoutHistoryState,
  next: SeatLayoutDocument
): LayoutHistoryState {
  if (state.present === next) return state;
  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
  };
}

export function undoLayoutHistory(state: LayoutHistoryState): LayoutHistoryState | null {
  if (state.past.length === 0) return null;
  const previous = state.past[state.past.length - 1]!;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoLayoutHistory(state: LayoutHistoryState): LayoutHistoryState | null {
  if (state.future.length === 0) return null;
  const next = state.future[0]!;
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}
