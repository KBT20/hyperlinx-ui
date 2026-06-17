import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

export function normalizeCloseEvent(input = {}) {
  const raw = input.closeEvent ?? input;
  return {
    ...raw,
    closeEventId: String(raw.closeEventId),
    sourceScopeVersionId: String(raw.sourceScopeVersionId ?? ""),
    packageId: String(raw.packageId ?? ""),
    eventType: raw.eventType ?? "FIELD_CLOSE",
    timestamp: raw.timestamp ?? nowIso(),
    payload: raw.payload ?? {},
  };
}

export async function handleCloseEvents(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/close-events",
    dir: DIRS.closeEvents,
    idKey: "closeEventId",
    listKey: "closeEvents",
    itemKey: "closeEvent",
    pluralBodyKeys: ["closeEvents", "items", "data"],
    idPrefix: "close-event",
    normalize: normalizeCloseEvent,
  });
}
