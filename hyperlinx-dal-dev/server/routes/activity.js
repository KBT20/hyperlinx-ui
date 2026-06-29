import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeActivity(event = {}) {
  const timestamp = event.timestamp ?? event.createdAt ?? nowIso();
  return {
    ...event,
    activityId: String(event.activityId),
    timestamp,
    createdAt: timestamp,
    updatedAt: event.updatedAt ?? timestamp,
  };
}

export async function handleActivity(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/activity",
    dir: DIRS.activity,
    idKey: "activityId",
    listKey: "activity",
    itemKey: "activityEvent",
    pluralBodyKeys: ["activity", "events", "items", "data"],
    idPrefix: "activity",
    normalize: normalizeActivity,
  });
}
