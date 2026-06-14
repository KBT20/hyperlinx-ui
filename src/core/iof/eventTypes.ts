export const IOF_EVENT_TYPE = {
  SCOPE_APPROVED: "scope.approved",
  SCOPE_UPDATED: "scope.updated",
  SCOPE_REJECTED: "scope.rejected",
  CLOSE_CREATED: "close.created",
  CLOSE_COMPLETED: "close.completed",
  OBJECT_ASSIGNED: "object.assigned",
  OBJECT_UPDATED: "object.updated",
  STATE_TRANSITION: "state.transition",
  STATION_UPDATED: "station.updated",
} as const;

export type IOFEventType = typeof IOF_EVENT_TYPE[keyof typeof IOF_EVENT_TYPE];

export type IOFEvent = {
  id: string;
  scopeVersionId: string;
  type: IOFEventType;
  targetId: string;
  timestamp: number;
  payload?: Record<string, any>;
};

export function createIOFEvent(params: {
  id?: string;
  scopeVersionId: string;
  type: IOFEventType;
  targetId: string;
  payload?: Record<string, any>;
  timestamp?: number;
}): IOFEvent {
  return {
    id: params.id ?? crypto.randomUUID(),
    scopeVersionId: params.scopeVersionId,
    type: params.type,
    targetId: params.targetId,
    timestamp: params.timestamp ?? Date.now(),
    payload: params.payload,
  };
}

export function isCloseEvent(event: IOFEvent): boolean {
  return (
    event.type === IOF_EVENT_TYPE.CLOSE_CREATED ||
    event.type === IOF_EVENT_TYPE.CLOSE_COMPLETED
  );
}

export function isScopeEvent(event: IOFEvent): boolean {
  return (
    event.type === IOF_EVENT_TYPE.SCOPE_APPROVED ||
    event.type === IOF_EVENT_TYPE.SCOPE_UPDATED ||
    event.type === IOF_EVENT_TYPE.SCOPE_REJECTED
  );
}
