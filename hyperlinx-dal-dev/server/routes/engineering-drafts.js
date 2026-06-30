import { DIRS, handleJsonCollection, nowIso, routeMatch } from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

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
  const match = routeMatch(pathname, "/api/engineering/drafts");
  if (!match) return false;
  if (req.method === "GET") {
    if (!requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority"], "You do not have authority to read Engineering Drafts.")) return true;
  } else if (["POST", "PUT"].includes(String(req.method))) {
    if (!requireAnyPermission(req, res, ["workspace.engineering.write", "scopeversion.authority"], "Only Engineering may create or update Engineering Drafts.")) return true;
  }
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
