import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeOpportunitySeed(seed = {}) {
  const timestamp = nowIso();
  return {
    ...seed,
    id: String(seed.id),
    createdAt: seed.createdAt ?? timestamp,
    updatedAt: seed.updatedAt ?? timestamp,
  };
}

export async function handleOpportunitySeeds(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/opportunity-seeds",
    dir: DIRS.opportunitySeeds,
    idKey: "id",
    listKey: "opportunitySeeds",
    itemKey: "opportunitySeed",
    pluralBodyKeys: ["opportunitySeeds", "seeds", "items", "data"],
    idPrefix: "seed",
    normalize: normalizeOpportunitySeed,
  });
}
