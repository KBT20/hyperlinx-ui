import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeProposalDraft(record = {}) {
  const timestamp = record.timestamp ?? record.acceptedAt ?? record.createdAt ?? nowIso();
  const proposalRecordId = record.proposalRecordId ?? record.snapshotId ?? record.acceptedProposalId ?? record.proposalId;
  return {
    ...record,
    proposalRecordId: String(proposalRecordId),
    organization: record.organization ?? "Teralinx",
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? nowIso(),
    noScopeVersionCreation: record.noScopeVersionCreation ?? true,
    noInventoryMutation: record.noInventoryMutation ?? true,
  };
}

export async function handleProposalDrafts(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/proposals",
    dir: DIRS.proposalDrafts,
    idKey: "proposalRecordId",
    listKey: "proposals",
    itemKey: "proposal",
    pluralBodyKeys: ["proposals", "proposalDrafts", "items", "data"],
    idPrefix: "proposal",
    normalize: normalizeProposalDraft,
  });
}
