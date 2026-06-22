import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeControlWorkItem(input = {}) {
  const raw = input.workItem ?? input;
  const timestamp = nowIso();
  return {
    ...raw,
    workItemId: String(raw.workItemId),
    status: raw.status ?? "PENDING",
    title: raw.title ?? raw.workItemId ?? "DAL work item",
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
  };
}

export async function handleControlWorkItems(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/control/work-items",
    dir: DIRS.controlWorkItems,
    idKey: "workItemId",
    listKey: "workItems",
    itemKey: "workItem",
    idPrefix: "work",
    normalize: normalizeControlWorkItem,
  });
}
