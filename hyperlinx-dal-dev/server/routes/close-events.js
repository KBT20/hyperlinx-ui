import { DIRS, handleJsonCollection, nowIso, routeMatch } from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

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
  const match = routeMatch(pathname, "/api/close-events");
  if (!match) return false;
  if (req.method === "GET") {
    if (!requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority"], "You do not have authority to read Close Events.")) return true;
  } else if (["POST", "PUT"].includes(String(req.method))) {
    if (!requireAnyPermission(req, res, ["scopeversion.authority"], "Only close authority may create or update Close Events.")) return true;
  }
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
