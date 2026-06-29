import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeCommercialOpportunity(record = {}) {
  const timestamp = nowIso();
  return {
    ...record,
    opportunityId: String(record.opportunityId),
    organization: record.organization ?? "Teralinx",
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export async function handleCommercialOpportunities(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/commercial/opportunities",
    dir: DIRS.commercialOpportunities,
    idKey: "opportunityId",
    listKey: "opportunities",
    itemKey: "opportunity",
    pluralBodyKeys: ["opportunities", "commercialOpportunities", "items", "data"],
    idPrefix: "commercial-opportunity",
    normalize: normalizeCommercialOpportunity,
  });
}
