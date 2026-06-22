import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeControlWorkStatus(value) {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  const normalized = upper === "ON_HOLD" ? "HOLD" : upper;
  if (upper && normalized !== upper) {
    console.log("[KERNEL_ALIAS_NORMALIZED]", {
      domain: "controlWork",
      from: upper,
      to: normalized,
    });
  }
  return normalized || "PENDING";
}

function normalizeControlWorkItem(input = {}) {
  const raw = input.workItem ?? input;
  const timestamp = nowIso();
  return {
    ...raw,
    workItemId: String(raw.workItemId),
    status: normalizeControlWorkStatus(raw.status),
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
