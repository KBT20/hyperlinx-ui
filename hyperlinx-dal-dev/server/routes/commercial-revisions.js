import { createHash } from "node:crypto";
import {
  DIRS,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  recordPath,
  routeMatch,
  sortedByUpdated,
  updateTransactionManifest,
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";
import {
  commercialChangeSetsForRevision,
  projectCommercialRevisionFromChangeSets,
} from "./commercial-change-sets.js";

const REVISION_BASE_PATH = "/api/commercial/revisions";
const RELEASE_BASE_PATH = "/api/commercial/release-packages";

const ALLOWED_COMMERCIAL_REVISION_KEYS = [
  "commercialRevisionId",
  "revisionId",
  "opportunityId",
  "repositoryId",
  "routeRepositoryId",
  "estimateId",
  "workbookId",
  "commercialWorkbookId",
  "proposalId",
  "proposalRevisionId",
  "proposalHash",
  "proposalRevisionNumber",
  "lifecycleSequence",
  "revisionStatus",
  "createdBy",
  "createdById",
  "createdOn",
  "parentRevision",
  "commercialReleaseState",
  "productDoctrineId",
  "commercialDoctrineId",
  "commercialAssumptionIds",
  "evidenceReferences",
  "changeSetIds",
  "activeChangeSetIds",
  "patchCount",
  "activePatchCount",
  "appliedPatchCount",
  "repositoryHash",
  "projectionHash",
  "patchReplayTimeMs",
  "projectionTimeMs",
  "commercialChangeSetAuthority",
  "currentAuthority",
  "revisionHash",
  "authority",
  "repositoryType",
  "editableAuthority",
  "referenceOnly",
  "repositoryTruthImmutable",
  "mutableWorkspaceStateAuthority",
  "noScopeVersionCreation",
  "noPricingMutation",
  "noProposalOutputMutation",
  "noWorkbookOutputMutation",
  "createdAt",
  "updatedAt",
];

const ALLOWED_COMMERCIAL_RELEASE_KEYS = [
  "commercialReleasePackageId",
  "commercialRevisionId",
  "revisionId",
  "opportunityId",
  "repositoryId",
  "routeRepositoryId",
  "estimateId",
  "workbookId",
  "commercialWorkbookId",
  "proposalId",
  "proposalRevisionId",
  "proposalHash",
  "proposalRevisionNumber",
  "lifecycleSequence",
  "productDoctrineId",
  "commercialDoctrineId",
  "revisionHash",
  "releaseHash",
  "evidenceReferences",
  "changeSetIds",
  "patchCount",
  "activePatchCount",
  "appliedPatchCount",
  "status",
  "commercialReleaseState",
  "createdBy",
  "createdById",
  "createdAt",
  "updatedAt",
  "authority",
  "repositoryType",
  "referenceOnly",
  "immutable",
  "frozen",
  "noCommercialTruthDuplication",
  "noScopeVersionCreation",
  "noEngineeringAuthorityMutation",
  "noPricingMutation",
  "noProposalOutputMutation",
  "noWorkbookOutputMutation",
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function uniqueStrings(...values) {
  const seen = new Set();
  const result = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  };
  values.forEach(visit);
  return result;
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function stableHash(value, prefix = "hash") {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16)}`;
}

function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function payloadFieldSizes(record) {
  return Object.entries(record)
    .map(([key, value]) => ({ key, bytes: serializedByteSize(value) }))
    .sort((a, b) => b.bytes - a.bytes);
}

function assertReferenceOnlyPayload(record, allowedKeys, label, limitBytes = 16 * 1024) {
  const topLevelKeys = Object.keys(record);
  const forbiddenKeys = topLevelKeys.filter((key) => !allowedKeys.includes(key));
  const largestFields = payloadFieldSizes(record).slice(0, 8);
  const serializedBytes = serializedByteSize(record);
  console.info(`[${label}] reference-only payload audit`, {
    topLevelKeys,
    serializedBytes,
    largestFields,
  });
  if (forbiddenKeys.length) {
    const error = new Error(`${label} payload contains non-reference field: ${forbiddenKeys[0]}`);
    error.status = 413;
    error.offendingField = forbiddenKeys[0];
    error.payloadAudit = { topLevelKeys, serializedBytes, largestFields };
    throw error;
  }
  if (serializedBytes > limitBytes) {
    const largest = largestFields[0];
    const error = new Error(`${label} payload exceeds reference-only threshold. Offending field: ${largest?.key ?? "unknown"} (${largest?.bytes ?? 0} bytes).`);
    error.status = 413;
    error.offendingField = largest?.key;
    error.payloadAudit = { topLevelKeys, serializedBytes, largestFields };
    throw error;
  }
  return { topLevelKeys, serializedBytes, largestFields };
}

function repositoryIdFor(opportunityId, proposalId) {
  return `COMMERCIAL-REPOSITORY-${stableIdPart(opportunityId || proposalId || "UNKNOWN")}`;
}

function revisionIdFor(opportunityId, proposalId, version) {
  return `COMM-REV-${stableIdPart(opportunityId || proposalId || "UNKNOWN")}-V${stableIdPart(version || 1)}`;
}

function releaseIdFor(revisionId, revisionHash) {
  return `COMM-REL-${stableIdPart(revisionId)}-${stableIdPart(revisionHash).slice(0, 24)}`;
}

function routeRepositoryIdFrom(...sources) {
  for (const source of sources.map(asRecord)) {
    const routeRepositoryRef = asRecord(source.routeRepositoryRef);
    const commercialSummary = asRecord(source.commercialSummary);
    const snapshot = asRecord(source.commercialSnapshot);
    const value = firstText(
      source.routeRepositoryId,
      routeRepositoryRef.routeRepositoryId,
      commercialSummary.routeRepositoryId,
      snapshot.routeRepositoryId,
      asRecord(snapshot.routeRepositoryRef).routeRepositoryId,
      asArray(source.geometryReferences).find((item) => String(item).startsWith("ROUTE-REPO")),
    );
    if (value) return value;
  }
  return "";
}

function estimateIdFrom(...sources) {
  for (const source of sources.map(asRecord)) {
    const commercialSummary = asRecord(source.commercialSummary);
    const pricingSummary = asRecord(source.pricingSummary ?? commercialSummary.pricingSummary);
    const estimate = asRecord(source.estimate ?? source.commercialEstimate ?? source.estimateSnapshot);
    const value = firstText(
      source.estimateId,
      source.commercialEstimateId,
      commercialSummary.estimateId,
      pricingSummary.estimateId,
      estimate.estimateId,
    );
    if (value) return value;
  }
  return "";
}

function workbookIdFrom(...sources) {
  for (const source of sources.map(asRecord)) {
    const commercialSummary = asRecord(source.commercialSummary);
    const workbook = asRecord(source.workbook ?? source.commercialWorkbook ?? source.workbookSnapshot);
    const value = firstText(
      source.commercialWorkbookId,
      source.workbookId,
      commercialSummary.commercialWorkbookId,
      commercialSummary.workbookId,
      workbook.commercialWorkbookId,
      workbook.workbookId,
    );
    if (value) return value;
  }
  return "";
}

function productDoctrineIdFrom(...sources) {
  for (const source of sources.map(asRecord)) {
    const productionDoctrine = asRecord(source.productionDoctrine);
    const value = firstText(
      source.productDoctrineId,
      source.doctrineId,
      source.productDoctrineVersion,
      productionDoctrine.doctrineId,
    );
    if (value) return value;
  }
  return "PD-001";
}

function commercialDoctrineIdFrom(...sources) {
  for (const source of sources.map(asRecord)) {
    const value = firstText(source.commercialDoctrineId, source.commercialAssumptionSetId, source.assumptionStateId);
    if (value) return value;
  }
  return "COMMERCIAL-DOCTRINE-POINT-TO-POINT";
}

export function commercialRevisionRecordForRepository(input = {}) {
  const proposal = asRecord(input.proposal);
  const opportunity = asRecord(input.opportunity);
  const draftPackage = asRecord(input.draftPackage ?? input.draftIofPackage);
  const timestamp = String(input.timestamp ?? input.createdOn ?? nowIso());
  const proposalId = firstText(input.proposalId, proposal.proposalId, proposal.proposalRecordId, draftPackage.proposalId, opportunity.proposalId);
  const opportunityId = firstText(input.opportunityId, proposal.opportunityId, draftPackage.opportunityId, opportunity.opportunityId);
  const version = firstText(input.version, proposal.version, draftPackage.packageRevision, 1);
  const proposalRevisionId = firstText(input.proposalRevisionId, draftPackage.proposalRevisionId, proposal.proposalRevisionId);
  const proposalHash = firstText(input.proposalHash, draftPackage.proposalHash, proposal.proposalHash);
  const proposalRevisionNumber = Number(input.proposalRevisionNumber ?? draftPackage.proposalRevisionNumber ?? proposal.revisionNumber ?? proposal.version ?? version);
  const revisionIdentity = proposalRevisionId ? `${version}-${stableIdPart(proposalRevisionId)}` : version;
  const inheritedRevisionId = proposalRevisionId
    ? firstText(
        draftPackage.proposalRevisionId === proposalRevisionId && draftPackage.proposalHash === proposalHash ? draftPackage.commercialRevisionId : "",
      )
    : firstText(proposal.commercialRevisionId, draftPackage.commercialRevisionId);
  const revisionId = firstText(input.revisionId, input.commercialRevisionId, inheritedRevisionId, revisionIdFor(opportunityId, proposalId, revisionIdentity));
  const estimateId = firstText(input.estimateId, estimateIdFrom(proposal, draftPackage, opportunity), proposalId ? `ESTIMATE-${stableIdPart(proposalId)}` : "");
  const workbookId = firstText(input.workbookId, input.commercialWorkbookId, workbookIdFrom(proposal, draftPackage, opportunity), proposalId ? `WORKBOOK-${stableIdPart(proposalId)}` : "");
  const routeRepositoryId = firstText(input.routeRepositoryId, routeRepositoryIdFrom(proposal, draftPackage, opportunity));
  const repositoryId = firstText(input.repositoryId, repositoryIdFor(opportunityId, proposalId));
  const commercialAssumptionIds = uniqueStrings(input.commercialAssumptionIds, proposal.commercialAssumptionIds, draftPackage.commercialAssumptionIds);
  const evidenceReferences = uniqueStrings(input.evidenceReferences, proposal.runtimeEvidenceIds, draftPackage.runtimeEvidenceIds, proposal.proposalDocumentReferences, draftPackage.proposalDocumentReferences);
  const changeSetIds = uniqueStrings(input.changeSetIds, input.activeChangeSetIds, proposal.changeSetIds, draftPackage.changeSetIds);
  const patchCount = Number(input.patchCount ?? proposal.patchCount ?? draftPackage.patchCount ?? 0);
  const activePatchCount = Number(input.activePatchCount ?? proposal.activePatchCount ?? draftPackage.activePatchCount ?? patchCount);
  const appliedPatchCount = Number(input.appliedPatchCount ?? proposal.appliedPatchCount ?? draftPackage.appliedPatchCount ?? 0);
  const repositoryHash = firstText(input.repositoryHash, proposal.repositoryHash, draftPackage.repositoryHash, stableHash({
    opportunityId,
    repositoryId,
    routeRepositoryId,
    estimateId,
    workbookId,
    proposalId,
    proposalRevisionId,
    proposalHash,
    proposalRevisionNumber,
    lifecycleSequence: Number(input.lifecycleSequence ?? 2),
  }, "commercial-repository"));
  const projectionHash = firstText(input.projectionHash, proposal.projectionHash, draftPackage.projectionHash);
  const baseRecord = {
    commercialRevisionId: revisionId,
    revisionId,
    opportunityId,
    repositoryId,
    routeRepositoryId,
    estimateId,
    workbookId,
    commercialWorkbookId: workbookId,
    proposalId,
    proposalRevisionId,
    proposalHash,
    proposalRevisionNumber,
    lifecycleSequence: Number(input.lifecycleSequence ?? 2),
    revisionStatus: firstText(input.revisionStatus, proposal.revisionStatus, proposal.status, "DRAFT"),
    createdBy: firstText(input.createdBy, asRecord(input.user).name, proposal.commercialOwner, proposal.owner, "Commercial"),
    createdById: firstText(input.createdById, asRecord(input.user).userId, proposal.commercialOwnerId, proposal.ownerId),
    createdOn: firstText(input.createdOn, proposal.createdAt, timestamp),
    parentRevision: firstText(input.parentRevision, proposal.parentRevision, proposal.previousCommercialRevisionId),
    commercialReleaseState: firstText(input.commercialReleaseState, proposal.commercialReleaseState, draftPackage.commercialReleaseState, "OPEN"),
    productDoctrineId: productDoctrineIdFrom(input, proposal, draftPackage, opportunity),
    commercialDoctrineId: commercialDoctrineIdFrom(input, proposal, draftPackage, opportunity),
    commercialAssumptionIds,
    evidenceReferences,
    changeSetIds,
    activeChangeSetIds: changeSetIds,
    patchCount,
    activePatchCount,
    appliedPatchCount,
    repositoryHash,
    projectionHash,
    patchReplayTimeMs: Number(input.patchReplayTimeMs ?? proposal.patchReplayTimeMs ?? draftPackage.patchReplayTimeMs ?? 0),
    projectionTimeMs: Number(input.projectionTimeMs ?? proposal.projectionTimeMs ?? draftPackage.projectionTimeMs ?? 0),
    commercialChangeSetAuthority: "COMMERCIAL_CHANGE_SET",
    currentAuthority: "COMMERCIAL_REVISION",
    authority: "COMMERCIAL_REVISION",
    repositoryType: "COMMERCIAL_REVISION",
    editableAuthority: true,
    referenceOnly: true,
    repositoryTruthImmutable: true,
    mutableWorkspaceStateAuthority: false,
    noScopeVersionCreation: true,
    noPricingMutation: true,
    noProposalOutputMutation: true,
    noWorkbookOutputMutation: true,
    createdAt: firstText(input.createdAt, timestamp),
    updatedAt: firstText(input.updatedAt, timestamp),
  };
  baseRecord.revisionHash = firstText(input.revisionHash, stableHash({
    revisionId,
    opportunityId,
    repositoryId,
    routeRepositoryId,
    estimateId,
    workbookId,
    proposalId,
    proposalRevisionId,
    proposalHash,
    proposalRevisionNumber,
    productDoctrineId: baseRecord.productDoctrineId,
    commercialDoctrineId: baseRecord.commercialDoctrineId,
    commercialAssumptionIds,
    evidenceReferences,
    changeSetIds,
    patchCount,
    activePatchCount,
    appliedPatchCount,
    repositoryHash,
  }, "commercial-revision"));
  baseRecord.projectionHash = firstText(baseRecord.projectionHash, baseRecord.revisionHash);
  assertReferenceOnlyPayload(baseRecord, ALLOWED_COMMERCIAL_REVISION_KEYS, "CommercialRevision");
  return baseRecord;
}

export function commercialReleasePackageRecordForRepository(input = {}) {
  const revision = commercialRevisionRecordForRepository(input.revision ?? input);
  const timestamp = String(input.timestamp ?? input.createdAt ?? nowIso());
  const releaseHash = firstText(input.releaseHash, stableHash({
    commercialRevisionId: revision.commercialRevisionId,
    revisionHash: revision.revisionHash,
    routeRepositoryId: revision.routeRepositoryId,
    estimateId: revision.estimateId,
    workbookId: revision.workbookId,
    proposalId: revision.proposalId,
    proposalRevisionId: revision.proposalRevisionId,
    proposalHash: revision.proposalHash,
    proposalRevisionNumber: revision.proposalRevisionNumber,
    lifecycleSequence: Number(input.lifecycleSequence ?? 3),
    productDoctrineId: revision.productDoctrineId,
    commercialDoctrineId: revision.commercialDoctrineId,
    evidenceReferences: revision.evidenceReferences,
    changeSetIds: revision.changeSetIds,
    patchCount: revision.patchCount,
  }, "commercial-release"));
  const record = {
    commercialReleasePackageId: firstText(input.commercialReleasePackageId, releaseIdFor(revision.revisionId, releaseHash)),
    commercialRevisionId: revision.commercialRevisionId,
    revisionId: revision.revisionId,
    opportunityId: revision.opportunityId,
    repositoryId: revision.repositoryId,
    routeRepositoryId: revision.routeRepositoryId,
    estimateId: revision.estimateId,
    workbookId: revision.workbookId,
    commercialWorkbookId: revision.commercialWorkbookId,
    proposalId: revision.proposalId,
    proposalRevisionId: revision.proposalRevisionId,
    proposalHash: revision.proposalHash,
    proposalRevisionNumber: revision.proposalRevisionNumber,
    lifecycleSequence: Number(input.lifecycleSequence ?? 3),
    productDoctrineId: revision.productDoctrineId,
    commercialDoctrineId: revision.commercialDoctrineId,
    revisionHash: revision.revisionHash,
    releaseHash,
    evidenceReferences: revision.evidenceReferences,
    changeSetIds: revision.changeSetIds ?? [],
    patchCount: Number(revision.patchCount ?? 0),
    activePatchCount: Number(revision.activePatchCount ?? 0),
    appliedPatchCount: Number(revision.appliedPatchCount ?? 0),
    status: firstText(input.status, "FROZEN"),
    commercialReleaseState: firstText(input.commercialReleaseState, "RELEASED"),
    createdBy: firstText(input.createdBy, revision.createdBy),
    createdById: firstText(input.createdById, revision.createdById),
    createdAt: firstText(input.createdAt, timestamp),
    updatedAt: firstText(input.updatedAt, timestamp),
    authority: "COMMERCIAL_RELEASE_PACKAGE",
    repositoryType: "COMMERCIAL_RELEASE_PACKAGE",
    referenceOnly: true,
    immutable: true,
    frozen: true,
    noCommercialTruthDuplication: true,
    noScopeVersionCreation: true,
    noEngineeringAuthorityMutation: true,
    noPricingMutation: true,
    noProposalOutputMutation: true,
    noWorkbookOutputMutation: true,
  };
  assertReferenceOnlyPayload(record, ALLOWED_COMMERCIAL_RELEASE_KEYS, "CommercialReleasePackage");
  return record;
}

export function commercialAuthorityDiagnosticsFrom({ revision = null, releasePackage = null, proposal = null, draftPackage = null } = {}) {
  return {
    repository: "COMMERCIAL_REPOSITORY",
    commercialRevisionId: revision?.commercialRevisionId ?? proposal?.commercialRevisionId ?? draftPackage?.commercialRevisionId ?? "",
    commercialReleasePackageId: releasePackage?.commercialReleasePackageId ?? proposal?.commercialReleasePackageId ?? draftPackage?.commercialReleasePackageId ?? "",
    proposalId: proposal?.proposalId ?? draftPackage?.proposalId ?? revision?.proposalId ?? "",
    draftIofPackageId: draftPackage?.packageId ?? "",
    revisionHash: revision?.revisionHash ?? proposal?.commercialRevisionHash ?? draftPackage?.commercialRevisionHash ?? "",
    releaseHash: releasePackage?.releaseHash ?? proposal?.commercialReleaseHash ?? draftPackage?.commercialReleaseHash ?? "",
    repositoryHash: revision?.repositoryHash ?? proposal?.repositoryHash ?? draftPackage?.repositoryHash ?? "",
    activePatchCount: Number(revision?.activePatchCount ?? proposal?.activePatchCount ?? draftPackage?.activePatchCount ?? 0),
    appliedPatchCount: Number(revision?.appliedPatchCount ?? proposal?.appliedPatchCount ?? draftPackage?.appliedPatchCount ?? 0),
    patchReplayTimeMs: Number(revision?.patchReplayTimeMs ?? proposal?.patchReplayTimeMs ?? draftPackage?.patchReplayTimeMs ?? 0),
    projectionTimeMs: Number(revision?.projectionTimeMs ?? proposal?.projectionTimeMs ?? draftPackage?.projectionTimeMs ?? 0),
    changeSetIds: revision?.changeSetIds ?? proposal?.changeSetIds ?? draftPackage?.changeSetIds ?? [],
    proposalHash: proposal ? stableHash({
      proposalId: proposal.proposalId,
      status: proposal.status,
      version: proposal.version,
      commercialRevisionId: proposal.commercialRevisionId,
    }, "proposal") : "",
    currentAuthority: releasePackage ? "COMMERCIAL_RELEASE_PACKAGE" : revision ? "COMMERCIAL_REVISION" : "COMMERCIAL_REPOSITORY",
    repositoryTruthImmutable: true,
    proposalConsumesCommercialRevision: true,
    draftIofConsumesCommercialReleasePackage: Boolean(releasePackage),
    noScopeVersionCreation: true,
  };
}

export async function persistCommercialRevision(record = {}, user = {}) {
  const normalized = commercialRevisionRecordForRepository({ ...record, user, timestamp: record.updatedAt ?? nowIso() });
  const saved = await persistRecord(DIRS.commercialRevisions, normalized.commercialRevisionId, normalized);
  console.info("[CommercialRevisionAuthority] persisted", {
    commercialRevisionId: saved.commercialRevisionId,
    revisionHash: saved.revisionHash,
    routeRepositoryId: saved.routeRepositoryId,
    estimateId: saved.estimateId,
    workbookId: saved.workbookId,
    proposalId: saved.proposalId,
    repositoryTruthImmutable: true,
  });
  return saved;
}

export async function persistCommercialReleasePackage(record = {}, user = {}) {
  const normalized = commercialReleasePackageRecordForRepository({ ...record, user, timestamp: record.updatedAt ?? nowIso() });
  const started = await updateTransactionManifest({
    transactionId: record.transactionId,
    operationType: "COMMERCIAL_RELEASE",
    customerId: normalized.customerId,
    opportunityId: normalized.opportunityId,
    state: "STARTED",
    plannedWrites: [`commercial-release-packages/${normalized.commercialReleasePackageId}`],
    artifactIds: [normalized.commercialReleasePackageId],
    revisionIds: [normalized.commercialRevisionId].filter(Boolean),
    hashes: [normalized.releaseHash].filter(Boolean),
  });
  try {
    const existing = await loadRecord(DIRS.commercialReleasePackages, normalized.commercialReleasePackageId).catch(() => null);
    if (existing && existing.releaseHash && existing.releaseHash !== normalized.releaseHash) {
      const error = new Error(`Commercial Release Package ${normalized.commercialReleasePackageId} already exists with a different immutable release hash.`);
      error.status = 409;
      throw error;
    }
    const saved = existing ?? await persistRecord(DIRS.commercialReleasePackages, normalized.commercialReleasePackageId, normalized);
    await updateTransactionManifest({
      transactionId: started.transactionId,
      operationType: "COMMERCIAL_RELEASE",
      state: "COMMITTED",
      completedWrites: [`commercial-release-packages/${normalized.commercialReleasePackageId}`],
      artifactIds: [saved.commercialReleasePackageId],
      revisionIds: [saved.commercialRevisionId].filter(Boolean),
      hashes: [saved.releaseHash].filter(Boolean),
    });
    console.info("[CommercialReleasePackageAuthority] persisted", {
      commercialReleasePackageId: saved.commercialReleasePackageId,
      commercialRevisionId: saved.commercialRevisionId,
      releaseHash: saved.releaseHash,
      routeRepositoryId: saved.routeRepositoryId,
      estimateId: saved.estimateId,
      workbookId: saved.workbookId,
      proposalId: saved.proposalId,
      noCommercialTruthDuplication: true,
    });
    return saved;
  } catch (error) {
    await updateTransactionManifest({
      transactionId: started.transactionId,
      operationType: "COMMERCIAL_RELEASE",
      state: "RECOVERY_REQUIRED",
      failureReason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function loadCommercialRevision(commercialRevisionId) {
  return commercialRevisionRecordForRepository(await loadRecord(DIRS.commercialRevisions, commercialRevisionId));
}

export async function loadCommercialReleasePackage(commercialReleasePackageId) {
  return commercialReleasePackageRecordForRepository(await loadRecord(DIRS.commercialReleasePackages, commercialReleasePackageId));
}

export async function ensureCommercialRevisionForProposal(proposal = {}, user = {}, options = {}) {
  const opportunityId = firstText(options.opportunityId, proposal.opportunityId);
  const opportunity = options.opportunity ?? (opportunityId ? await loadRecord(DIRS.commercialOpportunities, opportunityId).catch(() => null) : null);
  const revision = commercialRevisionRecordForRepository({
    proposal,
    opportunity,
    draftPackage: options.draftPackage,
    user,
    timestamp: options.timestamp ?? nowIso(),
    parentRevision: options.parentRevision,
    commercialReleaseState: options.commercialReleaseState,
  });
  const changeSets = await commercialChangeSetsForRevision(revision.revisionId, {
    opportunityId: revision.opportunityId,
    proposalId: revision.proposalId,
  }).catch(() => []);
  const projection = projectCommercialRevisionFromChangeSets(revision, changeSets, opportunity ?? {});
  return persistCommercialRevision({
    ...revision,
    changeSetIds: projection.changeSetIds,
    activeChangeSetIds: projection.changeSetIds,
    patchCount: projection.patches.length,
    activePatchCount: projection.diagnostics.activePatchCount,
    appliedPatchCount: projection.diagnostics.appliedPatchCount,
    repositoryHash: projection.diagnostics.repositoryHash,
    revisionHash: projection.diagnostics.revisionHash,
    projectionHash: projection.diagnostics.revisionHash,
    patchReplayTimeMs: projection.diagnostics.patchReplayTimeMs,
    projectionTimeMs: projection.diagnostics.projectionTimeMs,
    commercialChangeSetAuthority: "COMMERCIAL_CHANGE_SET",
    currentAuthority: "COMMERCIAL_REVISION",
  }, user);
}

export async function ensureCommercialReleasePackageForDraft(draftPackage = {}, proposal = {}, user = {}, options = {}) {
  const opportunityId = firstText(options.opportunityId, draftPackage.opportunityId, proposal.opportunityId);
  const opportunity = options.opportunity ?? (opportunityId ? await loadRecord(DIRS.commercialOpportunities, opportunityId).catch(() => null) : null);
  const revision = options.revision
    ? commercialRevisionRecordForRepository(options.revision)
    : await ensureCommercialRevisionForProposal(proposal, user, {
        opportunity,
        draftPackage,
        timestamp: options.timestamp ?? nowIso(),
        commercialReleaseState: "RELEASED",
      });
  const releasePackage = await persistCommercialReleasePackage({
    revision,
    user,
    timestamp: options.timestamp ?? nowIso(),
  }, user);
  await persistCommercialRevision({
    ...revision,
    commercialReleaseState: "RELEASED",
    updatedAt: options.timestamp ?? nowIso(),
  }, user);
  return { revision, releasePackage };
}

async function handleRevisionCollection(req, res, match, user) {
  if (match.base && req.method === "GET") {
    const records = sortedByUpdated((await listRecords(DIRS.commercialRevisions)).map(commercialRevisionRecordForRepository));
    jsonResponse(res, 200, { commercialRevisions: records, items: records });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const record = await loadCommercialRevision(match.id).catch(() => null);
    if (!record) errorResponse(res, 404, `Commercial Revision not found: ${match.id}`);
    else jsonResponse(res, 200, { commercialRevision: record });
    return true;
  }
  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "commercialRevision", ["commercialRevisions", "items", "data"]) ?? {};
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const item of records) saved.push(await persistCommercialRevision(item, user));
    if (Array.isArray(input)) jsonResponse(res, 201, { commercialRevisions: saved, items: saved });
    else jsonResponse(res, 201, { commercialRevision: saved[0] });
    return true;
  }
  if (!match.base && req.method === "POST" && match.action === "freeze-release") {
    const revision = await loadCommercialRevision(match.id).catch(() => null);
    if (!revision) {
      errorResponse(res, 404, `Commercial Revision not found: ${match.id}`);
      return true;
    }
    const releasePackage = await persistCommercialReleasePackage({ revision, user }, user);
    jsonResponse(res, 201, { commercialRevision: revision, commercialReleasePackage: releasePackage });
    return true;
  }
  return false;
}

async function handleReleaseCollection(req, res, match, user) {
  if (match.base && req.method === "GET") {
    const records = sortedByUpdated((await listRecords(DIRS.commercialReleasePackages)).map(commercialReleasePackageRecordForRepository));
    jsonResponse(res, 200, { commercialReleasePackages: records, items: records });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const record = await loadCommercialReleasePackage(match.id).catch(() => null);
    if (!record) errorResponse(res, 404, `Commercial Release Package not found: ${match.id}`);
    else jsonResponse(res, 200, { commercialReleasePackage: record });
    return true;
  }
  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "commercialReleasePackage", ["commercialReleasePackages", "items", "data"]) ?? {};
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const item of records) saved.push(await persistCommercialReleasePackage(item, user));
    if (Array.isArray(input)) jsonResponse(res, 201, { commercialReleasePackages: saved, items: saved });
    else jsonResponse(res, 201, { commercialReleasePackage: saved[0] });
    return true;
  }
  return false;
}

export async function handleCommercialRevisionAuthority(req, res, pathname) {
  const revisionMatch = routeMatch(pathname, REVISION_BASE_PATH);
  const releaseMatch = routeMatch(pathname, RELEASE_BASE_PATH);
  const match = revisionMatch ?? releaseMatch;
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.read", "proposal.manage", "workspace.engineering.read"], "You do not have authority to read Commercial Revision authority.")
    : requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.manage"], "Only Commercial may write Commercial Revision authority.");
  if (!user) return true;

  const handled = revisionMatch
    ? await handleRevisionCollection(req, res, revisionMatch, user)
    : await handleReleaseCollection(req, res, releaseMatch, user);
  if (handled) return true;
  errorResponse(res, 405, "Commercial Revision Authority method not allowed.");
  return true;
}

export function commercialRevisionRepositoryFile(commercialRevisionId) {
  return recordPath(DIRS.commercialRevisions, commercialRevisionId);
}

export function commercialReleaseRepositoryFile(commercialReleasePackageId) {
  return recordPath(DIRS.commercialReleasePackages, commercialReleasePackageId);
}
