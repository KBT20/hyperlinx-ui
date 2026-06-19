import type { RouteStation, RouteStationState } from "../types/dal";

const TRANSITIONS: Record<RouteStationState, RouteStationState[]> = {
  PLANNED: ["RELEASED", "BLOCKED", "REJECTED"],
  RELEASED: ["IN_PROGRESS", "BLOCKED", "REJECTED"],
  IN_PROGRESS: ["COMPLETE", "BLOCKED", "REJECTED"],
  COMPLETE: ["VERIFIED", "BLOCKED", "REJECTED"],
  VERIFIED: ["BLOCKED", "REJECTED"],
  BLOCKED: ["IN_PROGRESS", "REJECTED"],
  REJECTED: [],
};

export function getAllowedTransitions(state: RouteStationState): RouteStationState[] {
  return TRANSITIONS[state] ?? [];
}

export function validateTransition(from: RouteStationState, to: RouteStationState) {
  return from === to || getAllowedTransitions(from).includes(to);
}

export function transitionStationState(station: RouteStation, nextState: RouteStationState, timestamp = new Date().toISOString()): RouteStation {
  if (!validateTransition(station.stationState, nextState)) {
    throw new Error(`Invalid station transition: ${station.stationState} -> ${nextState}`);
  }
  return {
    ...station,
    stationState: nextState,
    updatedAt: timestamp,
  };
}
