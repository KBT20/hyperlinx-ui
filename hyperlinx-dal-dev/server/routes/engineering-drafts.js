import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeEngineeringDraft(record = {}) {
  const timestamp = nowIso();
  return {
    ...record,
    engineeringDraftId: String(record.engineeringDraftId),
    organization: record.organization ?? "Teralinx",
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
    noScopeVersionCreation: record.noScopeVersionCreation ?? true,
    noControlAuthority: record.noControlAuthority ?? true,
  };
}

export async function handleEngineeringDrafts(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/engineering/drafts",
    dir: DIRS.engineeringDrafts,
    idKey: "engineeringDraftId",
    listKey: "engineeringDrafts",
    itemKey: "engineeringDraft",
    pluralBodyKeys: ["engineeringDrafts", "drafts", "items", "data"],
    idPrefix: "engineering-draft",
    normalize: normalizeEngineeringDraft,
  });
}
