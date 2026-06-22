import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeFieldClosure(input = {}) {
  const raw = input.closure ?? input;
  const timestamp = nowIso();
  return {
    ...raw,
    closureId: String(raw.closureId),
    closureType: raw.closureType ?? "STATION",
    footage: Number(raw.footage ?? 0),
    crew: raw.crew ?? raw.actorName ?? "DAL Field",
    closedAt: raw.closedAt ?? raw.createdAt ?? timestamp,
    createdAt: raw.createdAt ?? raw.closedAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
  };
}

export async function handleFieldClosures(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/field/closures",
    dir: DIRS.fieldClosures,
    idKey: "closureId",
    listKey: "closures",
    itemKey: "closure",
    idPrefix: "field-closure",
    normalize: normalizeFieldClosure,
  });
}
