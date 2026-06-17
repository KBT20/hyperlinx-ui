import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeCandidateSite(site = {}) {
  const timestamp = nowIso();
  return {
    ...site,
    candidateId: String(site.candidateId),
    status: site.status ?? "IMPORTED",
    createdAt: site.createdAt ?? timestamp,
    updatedAt: site.updatedAt ?? timestamp,
  };
}

export async function handleCandidateSites(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/candidate-sites",
    dir: DIRS.candidateSites,
    idKey: "candidateId",
    listKey: "candidateSites",
    itemKey: "candidateSite",
    pluralBodyKeys: ["candidateSites", "sites", "items", "data"],
    idPrefix: "candidate",
    normalize: normalizeCandidateSite,
    singleCreateResponse: "plain",
  });
}
