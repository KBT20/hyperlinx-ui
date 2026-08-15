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
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

const CHANGE_SET_BASE_PATH = "/api/commercial/change-sets";

const COMMERCIAL_PATCH_TYPES = [
  "CHANGE_PLOW_PERCENT",
  "CHANGE_BORE_PERCENT",
  "CHANGE_ROCK_PERCENT",
  "CHANGE_TRENCH_PERCENT",
  "CHANGE_AERIAL_PERCENT",
  "CHANGE_PLOW_RATE",
  "CHANGE_BORE_RATE",
  "CHANGE_LABOR_RATE",
  "CHANGE_MATERIAL_RATE",
  "CHANGE_EQUIPMENT_RATE",
  "CHANGE_MARKUP",
  "CHANGE_CONTINGENCY",
  "MOVE_ILA",
  "REMOVE_ILA",
  "RESTORE_ILA",
  "CHANGE_MAX_SPAN",
  "CHANGE_OPTICAL_LOSS",
  "CHANGE_REGEN_SPACING",
  "CHANGE_STATION_SPACING",
  "REMOVE_BOOKEND",
  "RESTORE_BOOKEND",
  "ADD_UNKNOWN",
  "RESOLVE_UNKNOWN",
  "ADD_RISK",
  "RESOLVE_RISK",
  "ADD_EXCEPTION",
  "RESOLVE_EXCEPTION",
  "MOVE_ALIGNMENT",
  "CHANGE_CONSTRUCTION_METHOD",
  "CHANGE_SEGMENT_TYPE",
  "CHANGE_MONTHLY_REVENUE",
  "CHANGE_MARGIN_ASSUMPTION",
];

const ALLOWED_PATCH_KEYS = [
  "patchId",
  "revisionId",
  "patchType",
  "targetObjectId",
  "targetProperty",
  "oldValue",
  "newValue",
  "createdBy",
  "createdAt",
  "reason",
  "authority",
  "validationState",
];

const ALLOWED_CHANGE_SET_KEYS = [
  "changeSetId",
  "revisionId",
  "opportunityId",
  "repositoryId",
  "proposalId",
  "routeRepositoryId",
  "estimateId",
  "workbookId",
  "revisionNumber",
  "repositoryHash",
  "revisionHash",
  "projectionHash",
  "status",
  "patchCount",
  "activePatchCount",
  "appliedPatchCount",
  "patches",
  "createdBy",
  "createdById",
  "createdAt",
  "updatedAt",
  "authority",
  "repositoryType",
  "additive",
  "patchSetOnly",
  "repositoryTruthImmutable",
  "noScopeVersionCreation",
  "noPricingMutation",
  "noProposalOutputMutation",
  "noEngineeringAuthorityMutation",
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

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function stableHash(value, prefix = "commercial") {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16)}`;
}

function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function assertAllowedKeys(record, allowedKeys, label) {
  const forbidden = Object.keys(record).filter((key) => !allowedKeys.includes(key));
  if (forbidden.length) {
    const error = new Error(`${label} contains non-model field: ${forbidden[0]}`);
    error.status = 413;
    throw error;
  }
}

function safePatchValue(value) {
  if (serializedByteSize(value) > 2048) return "[VALUE_TOO_LARGE_FOR_PATCH]";
  return value ?? null;
}

export function commercialPatchRecordForRepository(input = {}, revisionId = "") {
  const patchType = firstText(input.patchType, "ADD_UNKNOWN");
  if (!COMMERCIAL_PATCH_TYPES.includes(patchType)) {
    const error = new Error(`Unsupported Commercial Patch type ${patchType}.`);
    error.status = 400;
    throw error;
  }
  const patch = {
    patchId: firstText(input.patchId, `COMM-PATCH-${patchType}-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    revisionId: firstText(input.revisionId, revisionId),
    patchType,
    targetObjectId: firstText(input.targetObjectId, input.targetProperty, "COMMERCIAL_REVISION"),
    targetProperty: firstText(input.targetProperty, input.targetObjectId, patchType),
    oldValue: safePatchValue(input.oldValue),
    newValue: safePatchValue(input.newValue),
    createdBy: firstText(input.createdBy, "Commercial"),
    createdAt: firstText(input.createdAt, nowIso()),
    reason: firstText(input.reason, patchType.replaceAll("_", " ")),
    authority: "COMMERCIAL_CHANGE_SET",
    validationState: firstText(input.validationState, "VALID"),
  };
  assertAllowedKeys(patch, ALLOWED_PATCH_KEYS, "CommercialPatch");
  if (!patch.revisionId) {
    const error = new Error("Commercial Patch is missing revisionId.");
    error.status = 400;
    throw error;
  }
  return patch;
}

function changeSetIdFor(revisionId, patchHash) {
  return `COMMERCIAL-CHANGE-SET-${stableIdPart(revisionId)}-${stableIdPart(patchHash).slice(0, 24)}`;
}

export function commercialChangeSetRecordForRepository(input = {}) {
  const timestamp = firstText(input.updatedAt, input.createdAt, nowIso());
  const revisionId = firstText(input.revisionId, input.commercialRevisionId);
  const patches = asArray(input.patches).map((patch) => commercialPatchRecordForRepository(patch, revisionId));
  const patchHash = stableHash(patches.map((patch) => ({
    patchId: patch.patchId,
    patchType: patch.patchType,
    targetObjectId: patch.targetObjectId,
    targetProperty: patch.targetProperty,
    newValue: patch.newValue,
  })), "commercial-change-set");
  const status = firstText(input.status, "ACTIVE");
  const record = {
    changeSetId: firstText(input.changeSetId, changeSetIdFor(revisionId, patchHash)),
    revisionId,
    opportunityId: firstText(input.opportunityId),
    repositoryId: firstText(input.repositoryId),
    proposalId: firstText(input.proposalId),
    routeRepositoryId: firstText(input.routeRepositoryId),
    estimateId: firstText(input.estimateId),
    workbookId: firstText(input.workbookId, input.commercialWorkbookId),
    revisionNumber: Number(input.revisionNumber ?? 1),
    repositoryHash: firstText(input.repositoryHash, stableHash({
      opportunityId: input.opportunityId,
      repositoryId: input.repositoryId,
      routeRepositoryId: input.routeRepositoryId,
      estimateId: input.estimateId,
      workbookId: input.workbookId,
      proposalId: input.proposalId,
    }, "commercial-repository")),
    revisionHash: firstText(input.revisionHash, patchHash),
    projectionHash: firstText(input.projectionHash, patchHash),
    status,
    patchCount: patches.length,
    activePatchCount: ["DISCARDED", "INACTIVE"].includes(status) ? 0 : patches.length,
    appliedPatchCount: status === "APPLIED" ? patches.length : 0,
    patches,
    createdBy: firstText(input.createdBy, "Commercial"),
    createdById: firstText(input.createdById),
    createdAt: firstText(input.createdAt, timestamp),
    updatedAt: timestamp,
    authority: "COMMERCIAL_CHANGE_SET",
    repositoryType: "COMMERCIAL_CHANGE_SET",
    additive: true,
    patchSetOnly: true,
    repositoryTruthImmutable: true,
    noScopeVersionCreation: true,
    noPricingMutation: true,
    noProposalOutputMutation: true,
    noEngineeringAuthorityMutation: true,
  };
  assertAllowedKeys(record, ALLOWED_CHANGE_SET_KEYS, "CommercialChangeSet");
  if (!record.revisionId) {
    const error = new Error("Commercial Change Set is missing revisionId.");
    error.status = 400;
    throw error;
  }
  console.info("[CommercialChangeSetAuthority] payload audit", {
    changeSetId: record.changeSetId,
    revisionId: record.revisionId,
    patchCount: record.patchCount,
    serializedBytes: serializedByteSize(record),
    repositoryTruthImmutable: true,
  });
  return record;
}

export async function persistCommercialChangeSet(record = {}) {
  const normalized = commercialChangeSetRecordForRepository(record);
  return persistRecord(DIRS.commercialChangeSets, normalized.changeSetId, normalized);
}

export async function loadCommercialChangeSet(changeSetId) {
  return commercialChangeSetRecordForRepository(await loadRecord(DIRS.commercialChangeSets, changeSetId));
}

export async function commercialChangeSetsForRevision(revisionId, context = {}) {
  const opportunityId = firstText(context.opportunityId);
  const proposalId = firstText(context.proposalId);
  const records = (await listRecords(DIRS.commercialChangeSets)).map(commercialChangeSetRecordForRepository);
  return sortedByUpdated(records).filter((record) => (
    record.revisionId === revisionId ||
    (opportunityId && record.opportunityId === opportunityId) ||
    (proposalId && record.proposalId === proposalId)
  ));
}

function blankProjectionState() {
  return {
    constructionPercentages: {},
    rates: {},
    engineeringAssumptions: {},
    risk: { unknowns: [], risks: [], exceptions: [] },
    route: { alignmentMoves: [], constructionMethods: {}, segmentTypes: {} },
    commercialImpacts: { costs: [], revenue: [], proposal: [], engineering: [] },
  };
}

function applyPatchToProjection(state, patch) {
  if (["CHANGE_PLOW_PERCENT", "CHANGE_BORE_PERCENT", "CHANGE_ROCK_PERCENT", "CHANGE_TRENCH_PERCENT", "CHANGE_AERIAL_PERCENT"].includes(patch.patchType)) {
    state.constructionPercentages[patch.targetProperty] = patch.newValue;
    return;
  }
  if (["CHANGE_PLOW_RATE", "CHANGE_BORE_RATE", "CHANGE_LABOR_RATE", "CHANGE_MATERIAL_RATE", "CHANGE_EQUIPMENT_RATE", "CHANGE_MARKUP", "CHANGE_CONTINGENCY"].includes(patch.patchType)) {
    state.rates[patch.targetProperty] = patch.newValue;
    return;
  }
  if (["MOVE_ILA", "REMOVE_ILA", "RESTORE_ILA", "CHANGE_MAX_SPAN", "CHANGE_OPTICAL_LOSS", "CHANGE_REGEN_SPACING", "CHANGE_STATION_SPACING", "REMOVE_BOOKEND", "RESTORE_BOOKEND"].includes(patch.patchType)) {
    state.engineeringAssumptions[patch.targetObjectId || patch.targetProperty] = patch.newValue;
    state.commercialImpacts.engineering.push(patch);
    return;
  }
  if (["ADD_UNKNOWN", "RESOLVE_UNKNOWN"].includes(patch.patchType)) {
    state.risk.unknowns.push(patch);
    return;
  }
  if (["ADD_RISK", "RESOLVE_RISK"].includes(patch.patchType)) {
    state.risk.risks.push(patch);
    return;
  }
  if (["ADD_EXCEPTION", "RESOLVE_EXCEPTION"].includes(patch.patchType)) {
    state.risk.exceptions.push(patch);
    return;
  }
  if (patch.patchType === "MOVE_ALIGNMENT") {
    state.route.alignmentMoves.push(patch);
    return;
  }
  if (patch.patchType === "CHANGE_CONSTRUCTION_METHOD") {
    state.route.constructionMethods[patch.targetObjectId || patch.targetProperty] = patch.newValue;
    return;
  }
  if (patch.patchType === "CHANGE_SEGMENT_TYPE") {
    state.route.segmentTypes[patch.targetObjectId || patch.targetProperty] = patch.newValue;
    return;
  }
  if (patch.patchType === "CHANGE_MONTHLY_REVENUE") {
    state.commercialImpacts.revenue.push(patch);
    return;
  }
  if (patch.patchType === "CHANGE_MARGIN_ASSUMPTION") {
    state.commercialImpacts.proposal.push(patch);
    return;
  }
  state.commercialImpacts.costs.push(patch);
}

export function projectCommercialRevisionFromChangeSets(revision = {}, changeSets = [], repositoryTruth = {}) {
  const replayStart = performance.now();
  const activeChangeSets = changeSets.filter((changeSet) => !["DISCARDED", "INACTIVE"].includes(changeSet.status));
  const patches = activeChangeSets.flatMap((changeSet) => asArray(changeSet.patches)).map((patch) => commercialPatchRecordForRepository(patch, firstText(revision.revisionId, revision.commercialRevisionId)));
  patches.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const patchReplayTimeMs = Number((performance.now() - replayStart).toFixed(3));
  const projectionStart = performance.now();
  const projectionState = blankProjectionState();
  patches.forEach((patch) => applyPatchToProjection(projectionState, patch));
  const repositoryHash = stableHash({
    opportunityId: revision.opportunityId ?? repositoryTruth.opportunityId,
    repositoryId: revision.repositoryId ?? repositoryTruth.repositoryId,
    routeRepositoryId: revision.routeRepositoryId ?? repositoryTruth.routeRepositoryId,
    estimateId: revision.estimateId ?? repositoryTruth.estimateId,
    workbookId: revision.workbookId ?? revision.commercialWorkbookId ?? repositoryTruth.workbookId,
    proposalId: revision.proposalId ?? repositoryTruth.proposalId,
  }, "commercial-repository");
  const revisionHash = stableHash({
    repositoryHash,
    revisionId: firstText(revision.revisionId, revision.commercialRevisionId),
    patches: patches.map((patch) => ({
      patchId: patch.patchId,
      patchType: patch.patchType,
      targetObjectId: patch.targetObjectId,
      targetProperty: patch.targetProperty,
      newValue: patch.newValue,
    })),
  }, "commercial-revision");
  const projectionTimeMs = Number((performance.now() - projectionStart).toFixed(3));
  return {
    projectionId: `COMMERCIAL-REVISION-PROJECTION-${stableIdPart(firstText(revision.revisionId, revision.commercialRevisionId))}-${stableIdPart(revisionHash)}`,
    revisionId: firstText(revision.revisionId, revision.commercialRevisionId),
    repositoryId: firstText(revision.repositoryId, repositoryTruth.repositoryId, "COMMERCIAL_REPOSITORY"),
    opportunityId: firstText(revision.opportunityId, repositoryTruth.opportunityId),
    proposalId: firstText(revision.proposalId, repositoryTruth.proposalId),
    sourceAuthority: "COMMERCIAL_REPOSITORY",
    revisionAuthority: "COMMERCIAL_REVISION",
    patchAuthority: "COMMERCIAL_CHANGE_SET",
    changeSetIds: activeChangeSets.map((changeSet) => changeSet.changeSetId),
    patches,
    projectionState,
    diagnostics: {
      repositoryHash,
      revisionHash,
      activePatchCount: patches.length,
      appliedPatchCount: activeChangeSets.filter((changeSet) => changeSet.status === "APPLIED").reduce((total, changeSet) => total + changeSet.patchCount, 0),
      patchReplayTimeMs,
      projectionTimeMs,
      warnings: [],
    },
    workbookConsumesCommercialRevision: true,
    estimateConsumesCommercialRevision: true,
    proposalConsumesCommercialRevision: true,
    commercialReleasePackageConsumesCommercialRevision: true,
    draftIofConsumesCommercialRevision: true,
    repositoryTruthImmutable: true,
    noRepositoryMutation: true,
    noPricingFormulaMutation: true,
    noProposalOutputMutation: true,
    noScopeVersionCreation: true,
  };
}

function compareProjectionStates(fromProjection, toProjection) {
  const differences = [];
  const addRecordDiffs = (category, from = {}, to = {}) => {
    const keys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)])).sort();
    for (const key of keys) {
      if (JSON.stringify(from[key] ?? null) !== JSON.stringify(to[key] ?? null)) {
        differences.push({ category, targetProperty: key, fromValue: from[key] ?? null, toValue: to[key] ?? null });
      }
    }
  };
  addRecordDiffs("construction percentages", fromProjection.projectionState.constructionPercentages, toProjection.projectionState.constructionPercentages);
  addRecordDiffs("rates", fromProjection.projectionState.rates, toProjection.projectionState.rates);
  addRecordDiffs("assumptions", fromProjection.projectionState.engineeringAssumptions, toProjection.projectionState.engineeringAssumptions);
  const categories = [
    ["costs", "costs"],
    ["revenue", "revenue"],
    ["proposal impact", "proposal"],
    ["engineering impact", "engineering"],
  ];
  for (const [category, key] of categories) {
    const fromCount = fromProjection.projectionState.commercialImpacts[key].length;
    const toCount = toProjection.projectionState.commercialImpacts[key].length;
    if (fromCount !== toCount) differences.push({ category, targetProperty: `${key}PatchCount`, fromValue: fromCount, toValue: toCount });
  }
  return {
    comparisonId: `COMMERCIAL-REVISION-COMPARISON-${Date.now()}`,
    fromRevisionHash: fromProjection.diagnostics.revisionHash,
    toRevisionHash: toProjection.diagnostics.revisionHash,
    differences,
    rawJsonCompared: false,
    comparedPatchResults: true,
  };
}

async function updateChangeSetStatus(changeSet, status) {
  const record = commercialChangeSetRecordForRepository({
    ...changeSet,
    status,
    updatedAt: nowIso(),
  });
  return persistRecord(DIRS.commercialChangeSets, record.changeSetId, record);
}

async function handleChangeSetAction(req, res, match) {
  const changeSet = await loadCommercialChangeSet(match.id).catch(() => null);
  const revision = await loadRecord(DIRS.commercialRevisions, match.id).catch(() => null);
  const revisionId = changeSet?.revisionId ?? revision?.revisionId ?? revision?.commercialRevisionId ?? match.id;
  if (match.action === "replay") {
    const changeSets = await commercialChangeSetsForRevision(revisionId, revision ?? {});
    jsonResponse(res, 200, { replay: projectCommercialRevisionFromChangeSets(revision ?? { revisionId }, changeSets), changeSets });
    return true;
  }
  if (match.action === "compare") {
    const changeSets = await commercialChangeSetsForRevision(revisionId, revision ?? {});
    const original = projectCommercialRevisionFromChangeSets(revision ?? { revisionId }, []);
    const current = projectCommercialRevisionFromChangeSets(revision ?? { revisionId }, changeSets);
    jsonResponse(res, 200, { comparison: compareProjectionStates(original, current), originalProjection: original, currentProjection: current });
    return true;
  }
  if (match.action === "discard") {
    if (changeSet) {
      jsonResponse(res, 200, { commercialChangeSet: await updateChangeSetStatus(changeSet, "DISCARDED") });
      return true;
    }
    const changeSets = await commercialChangeSetsForRevision(revisionId, revision ?? {});
    const saved = [];
    for (const candidate of changeSets) saved.push(await updateChangeSetStatus(candidate, candidate.status === "APPLIED" ? candidate.status : "DISCARDED"));
    jsonResponse(res, 200, { commercialChangeSets: saved, items: saved });
    return true;
  }
  if (match.action === "restore-original") {
    const changeSets = await commercialChangeSetsForRevision(revisionId, revision ?? {});
    const saved = [];
    for (const candidate of changeSets) saved.push(await updateChangeSetStatus(candidate, "INACTIVE"));
    jsonResponse(res, 200, { commercialChangeSets: saved, items: saved, restoredOriginal: true });
    return true;
  }
  return false;
}

export async function handleCommercialChangeSets(req, res, pathname) {
  const match = routeMatch(pathname, CHANGE_SET_BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.read", "proposal.manage"], "You do not have authority to read Commercial Change Sets.")
    : requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.manage"], "Only Commercial may write Commercial Change Sets.");
  if (!user) return true;

  if (match.base && req.method === "GET") {
    const records = sortedByUpdated((await listRecords(DIRS.commercialChangeSets)).map(commercialChangeSetRecordForRepository));
    jsonResponse(res, 200, { commercialChangeSets: records, items: records });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const record = await loadCommercialChangeSet(match.id).catch(() => null);
    if (!record) errorResponse(res, 404, `Commercial Change Set not found: ${match.id}`);
    else jsonResponse(res, 200, { commercialChangeSet: record });
    return true;
  }
  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "commercialChangeSet", ["commercialChangeSets", "items", "data"]) ?? {};
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const item of records) saved.push(await persistCommercialChangeSet({ ...item, createdBy: item.createdBy ?? user.name, createdById: item.createdById ?? user.userId }));
    if (Array.isArray(input)) jsonResponse(res, 201, { commercialChangeSets: saved, items: saved });
    else jsonResponse(res, 201, { commercialChangeSet: saved[0] });
    return true;
  }
  if (!match.base && req.method === "POST" && match.action) {
    if (await handleChangeSetAction(req, res, match)) return true;
  }
  errorResponse(res, 405, "Commercial Change Set method not allowed.");
  return true;
}

export function commercialChangeSetRepositoryFile(changeSetId) {
  return recordPath(DIRS.commercialChangeSets, changeSetId);
}
