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

const CHANGE_SET_BASE_PATH = "/api/engineering/change-sets";

const ENGINEERING_PATCH_TYPES = [
  "MOVE_STATION",
  "INSERT_STATION",
  "REMOVE_STATION",
  "CHANGE_STATION_TYPE",
  "CHANGE_STATION_INTERVAL",
  "MOVE_OBJECT",
  "ADD_OBJECT",
  "REMOVE_OBJECT",
  "CHANGE_OBJECT_CLASS",
  "CHANGE_OBJECT_TYPE",
  "CHANGE_OBJECT_STATUS",
  "CHANGE_OBJECT_SIZE",
  "CHANGE_OBJECT_CONFIGURATION",
  "ADD_CONSTRAINT",
  "REMOVE_CONSTRAINT",
  "RESOLVE_CONSTRAINT",
  "ADD_EXCEPTION",
  "RESOLVE_EXCEPTION",
  "CHANGE_CLEARANCE",
  "CHANGE_PLACEMENT",
  "CHANGE_SPLICE",
  "CHANGE_SPLICE_CASE",
  "CHANGE_FIBER_ASSIGNMENT",
  "CHANGE_BUFFER_ASSIGNMENT",
  "CHANGE_LOSS",
  "CHANGE_REGEN",
  "CHANGE_ILA_CONFIGURATION",
  "ADD_EVIDENCE",
  "REMOVE_EVIDENCE",
  "CHANGE_REVIEW_STATUS",
  "ADD_ENGINEERING_NOTE",
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
  "engineeringBaselineId",
  "engineeringPackageId",
  "draftIOFPackageId",
  "opportunityId",
  "routeRepositoryId",
  "proposalId",
  "estimateId",
  "workbookId",
  "revisionNumber",
  "baselineHash",
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
  "baselineImmutable",
  "repositoryTruthImmutable",
  "noScopeVersionCreation",
  "noStationProjectionMutation",
  "noPricingMutation",
  "noCommercialAuthorityMutation",
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
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

function stableHash(value, prefix = "engineering") {
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

export function engineeringPatchRecordForRepository(input = {}, revisionId = "") {
  const patchType = firstText(input.patchType, "ADD_ENGINEERING_NOTE");
  if (!ENGINEERING_PATCH_TYPES.includes(patchType)) {
    const error = new Error(`Unsupported Engineering Patch type ${patchType}.`);
    error.status = 400;
    throw error;
  }
  const patch = {
    patchId: firstText(input.patchId, `ENG-PATCH-${patchType}-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    revisionId: firstText(input.revisionId, revisionId),
    patchType,
    targetObjectId: firstText(input.targetObjectId, input.targetProperty, "ENGINEERING_REVISION"),
    targetProperty: firstText(input.targetProperty, input.targetObjectId, patchType),
    oldValue: safePatchValue(input.oldValue),
    newValue: safePatchValue(input.newValue),
    createdBy: firstText(input.createdBy, "Engineering"),
    createdAt: firstText(input.createdAt, nowIso()),
    reason: firstText(input.reason, patchType.replaceAll("_", " ")),
    authority: "ENGINEERING_CHANGE_SET",
    validationState: firstText(input.validationState, "VALID"),
  };
  assertAllowedKeys(patch, ALLOWED_PATCH_KEYS, "EngineeringPatch");
  if (!patch.revisionId) {
    const error = new Error("Engineering Patch is missing revisionId.");
    error.status = 400;
    throw error;
  }
  return patch;
}

function changeSetIdFor(revisionId, patchHash) {
  return `ENGINEERING-CHANGE-SET-${stableIdPart(revisionId)}-${stableIdPart(patchHash).slice(0, 24)}`;
}

export function engineeringChangeSetRecordForRepository(input = {}) {
  const timestamp = firstText(input.updatedAt, input.createdAt, nowIso());
  const revisionId = firstText(input.revisionId, input.engineeringRevisionId);
  const patches = asArray(input.patches).map((patch) => engineeringPatchRecordForRepository(patch, revisionId));
  const patchHash = stableHash(patches.map((patch) => ({
    patchId: patch.patchId,
    patchType: patch.patchType,
    targetObjectId: patch.targetObjectId,
    targetProperty: patch.targetProperty,
    newValue: patch.newValue,
  })), "engineering-change-set");
  const status = firstText(input.status, "ACTIVE");
  const engineeringBaselineId = firstText(input.engineeringBaselineId);
  const record = {
    changeSetId: firstText(input.changeSetId, changeSetIdFor(revisionId, patchHash)),
    revisionId,
    engineeringBaselineId,
    engineeringPackageId: firstText(input.engineeringPackageId),
    draftIOFPackageId: firstText(input.draftIOFPackageId, input.draftIofPackageId),
    opportunityId: firstText(input.opportunityId),
    routeRepositoryId: firstText(input.routeRepositoryId),
    proposalId: firstText(input.proposalId),
    estimateId: firstText(input.estimateId),
    workbookId: firstText(input.workbookId, input.commercialWorkbookId),
    revisionNumber: Number(input.revisionNumber ?? 1),
    baselineHash: firstText(input.baselineHash, input.engineeringBaselineHash, stableHash({ engineeringBaselineId }, "engineering-baseline")),
    revisionHash: firstText(input.revisionHash, patchHash),
    projectionHash: firstText(input.projectionHash, patchHash),
    status,
    patchCount: patches.length,
    activePatchCount: ["DISCARDED", "INACTIVE"].includes(status) ? 0 : patches.length,
    appliedPatchCount: status === "APPLIED" ? patches.length : 0,
    patches,
    createdBy: firstText(input.createdBy, "Engineering"),
    createdById: firstText(input.createdById),
    createdAt: firstText(input.createdAt, timestamp),
    updatedAt: timestamp,
    authority: "ENGINEERING_CHANGE_SET",
    repositoryType: "ENGINEERING_CHANGE_SET",
    additive: true,
    patchSetOnly: true,
    baselineImmutable: true,
    repositoryTruthImmutable: true,
    noScopeVersionCreation: true,
    noStationProjectionMutation: true,
    noPricingMutation: true,
    noCommercialAuthorityMutation: true,
  };
  assertAllowedKeys(record, ALLOWED_CHANGE_SET_KEYS, "EngineeringChangeSet");
  if (!record.revisionId) {
    const error = new Error("Engineering Change Set is missing revisionId.");
    error.status = 400;
    throw error;
  }
  if (!record.engineeringBaselineId) {
    const error = new Error("Engineering Change Set is missing engineeringBaselineId.");
    error.status = 400;
    throw error;
  }
  console.info("[EngineeringChangeSetAuthority] payload audit", {
    changeSetId: record.changeSetId,
    revisionId: record.revisionId,
    engineeringBaselineId: record.engineeringBaselineId,
    patchCount: record.patchCount,
    serializedBytes: serializedByteSize(record),
    baselineImmutable: true,
  });
  return record;
}

export async function persistEngineeringChangeSet(record = {}) {
  const normalized = engineeringChangeSetRecordForRepository(record);
  return persistRecord(DIRS.engineeringChangeSets, normalized.changeSetId, normalized);
}

export async function loadEngineeringChangeSet(changeSetId) {
  return engineeringChangeSetRecordForRepository(await loadRecord(DIRS.engineeringChangeSets, changeSetId));
}

export async function engineeringChangeSetsForRevision(revisionId, context = {}) {
  const engineeringBaselineId = firstText(context.engineeringBaselineId);
  const engineeringPackageId = firstText(context.engineeringPackageId);
  const records = (await listRecords(DIRS.engineeringChangeSets)).map(engineeringChangeSetRecordForRepository);
  return sortedByUpdated(records).filter((record) => (
    record.revisionId === revisionId ||
    (engineeringBaselineId && record.engineeringBaselineId === engineeringBaselineId) ||
    (engineeringPackageId && record.engineeringPackageId === engineeringPackageId)
  ));
}

function blankProjectionState() {
  return {
    stations: { moves: [], inserted: [], removed: [], types: {}, intervals: {} },
    objects: { moves: [], added: [], removed: [], classes: {}, types: {}, statuses: {}, sizes: {}, configurations: {} },
    constraints: { added: [], removed: [], resolved: [], exceptions: [], clearances: {}, placements: {} },
    fiber: { splices: {}, spliceCases: {}, fiberAssignments: {}, bufferAssignments: {}, loss: {}, regen: {}, ilaConfiguration: {} },
    evidence: { added: [], removed: [], reviewStatus: {}, notes: [] },
  };
}

function applyPatchToProjection(state, patch) {
  if (patch.patchType === "MOVE_STATION") state.stations.moves.push(patch);
  else if (patch.patchType === "INSERT_STATION") state.stations.inserted.push(patch);
  else if (patch.patchType === "REMOVE_STATION") state.stations.removed.push(patch);
  else if (patch.patchType === "CHANGE_STATION_TYPE") state.stations.types[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_STATION_INTERVAL") state.stations.intervals[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "MOVE_OBJECT") state.objects.moves.push(patch);
  else if (patch.patchType === "ADD_OBJECT") state.objects.added.push(patch);
  else if (patch.patchType === "REMOVE_OBJECT") state.objects.removed.push(patch);
  else if (patch.patchType === "CHANGE_OBJECT_CLASS") state.objects.classes[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_OBJECT_TYPE") state.objects.types[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_OBJECT_STATUS") state.objects.statuses[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_OBJECT_SIZE") state.objects.sizes[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_OBJECT_CONFIGURATION") state.objects.configurations[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "ADD_CONSTRAINT") state.constraints.added.push(patch);
  else if (patch.patchType === "REMOVE_CONSTRAINT") state.constraints.removed.push(patch);
  else if (patch.patchType === "RESOLVE_CONSTRAINT") state.constraints.resolved.push(patch);
  else if (["ADD_EXCEPTION", "RESOLVE_EXCEPTION"].includes(patch.patchType)) state.constraints.exceptions.push(patch);
  else if (patch.patchType === "CHANGE_CLEARANCE") state.constraints.clearances[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_PLACEMENT") state.constraints.placements[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_SPLICE") state.fiber.splices[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_SPLICE_CASE") state.fiber.spliceCases[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_FIBER_ASSIGNMENT") state.fiber.fiberAssignments[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_BUFFER_ASSIGNMENT") state.fiber.bufferAssignments[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_LOSS") state.fiber.loss[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_REGEN") state.fiber.regen[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "CHANGE_ILA_CONFIGURATION") state.fiber.ilaConfiguration[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "ADD_EVIDENCE") state.evidence.added.push(patch);
  else if (patch.patchType === "REMOVE_EVIDENCE") state.evidence.removed.push(patch);
  else if (patch.patchType === "CHANGE_REVIEW_STATUS") state.evidence.reviewStatus[patch.targetObjectId || patch.targetProperty] = patch.newValue;
  else if (patch.patchType === "ADD_ENGINEERING_NOTE") state.evidence.notes.push(patch);
  else state.objects.configurations[patch.targetObjectId || patch.targetProperty] = patch.newValue;
}

export function projectEngineeringRevisionFromChangeSets(revision = {}, changeSets = [], baseline = {}) {
  const replayStart = performance.now();
  const activeChangeSets = changeSets.filter((changeSet) => !["DISCARDED", "INACTIVE"].includes(changeSet.status));
  const revisionId = firstText(revision.engineeringRevisionId, revision.revisionId, baseline.engineeringRevisionId);
  const patches = activeChangeSets.flatMap((changeSet) => asArray(changeSet.patches)).map((patch) => engineeringPatchRecordForRepository(patch, revisionId));
  patches.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const patchReplayTimeMs = Number((performance.now() - replayStart).toFixed(3));
  const projectionStart = performance.now();
  const projectionState = blankProjectionState();
  patches.forEach((patch) => applyPatchToProjection(projectionState, patch));
  const baselineHash = firstText(revision.engineeringBaselineHash, revision.baselineHash, baseline.engineeringBaselineHash, stableHash({ engineeringBaselineId: revision.engineeringBaselineId ?? baseline.engineeringBaselineId }, "engineering-baseline"));
  const revisionHash = stableHash({
    baselineHash,
    revisionId,
    patches: patches.map((patch) => ({
      patchId: patch.patchId,
      patchType: patch.patchType,
      targetObjectId: patch.targetObjectId,
      targetProperty: patch.targetProperty,
      newValue: patch.newValue,
    })),
  }, "engineering-revision");
  const projectionTimeMs = Number((performance.now() - projectionStart).toFixed(3));
  return {
    projectionId: `ENGINEERING-REVISION-PROJECTION-${stableIdPart(revisionId)}-${stableIdPart(revisionHash)}`,
    revisionId,
    engineeringBaselineId: firstText(revision.engineeringBaselineId, baseline.engineeringBaselineId),
    engineeringPackageId: firstText(revision.engineeringPackageId, baseline.engineeringPackageId),
    sourceAuthority: "ENGINEERING_BASELINE",
    revisionAuthority: "ENGINEERING_REVISION",
    patchAuthority: "ENGINEERING_CHANGE_SET",
    changeSetIds: activeChangeSets.map((changeSet) => changeSet.changeSetId),
    patches,
    projectionState,
    diagnostics: {
      baselineHash,
      revisionHash,
      activePatchCount: patches.length,
      appliedPatchCount: activeChangeSets.filter((changeSet) => changeSet.status === "APPLIED").reduce((total, changeSet) => total + changeSet.patchCount, 0),
      patchReplayTimeMs,
      projectionTimeMs,
      warnings: [],
    },
    certificationConsumesEngineeringRevision: true,
    certifiedIofPackageConsumesEngineeringRevision: true,
    baselineImmutable: true,
    noBaselineMutation: true,
    noEngineeringPackageMutation: true,
    noStationProjectionMutation: true,
    noPricingMutation: true,
    noCommercialAuthorityMutation: true,
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
  addRecordDiffs("stationing", fromProjection.projectionState.stations.types, toProjection.projectionState.stations.types);
  addRecordDiffs("objects", fromProjection.projectionState.objects.configurations, toProjection.projectionState.objects.configurations);
  addRecordDiffs("constraints", fromProjection.projectionState.constraints.clearances, toProjection.projectionState.constraints.clearances);
  addRecordDiffs("fiber engineering", fromProjection.projectionState.fiber.fiberAssignments, toProjection.projectionState.fiber.fiberAssignments);
  addRecordDiffs("evidence", fromProjection.projectionState.evidence.reviewStatus, toProjection.projectionState.evidence.reviewStatus);
  return {
    comparisonId: `ENGINEERING-REVISION-COMPARISON-${Date.now()}`,
    fromRevisionHash: fromProjection.diagnostics.revisionHash,
    toRevisionHash: toProjection.diagnostics.revisionHash,
    differences,
    rawJsonCompared: false,
    comparedPatchResults: true,
  };
}

async function updateChangeSetStatus(changeSet, status) {
  const record = engineeringChangeSetRecordForRepository({
    ...changeSet,
    status,
    updatedAt: nowIso(),
  });
  return persistRecord(DIRS.engineeringChangeSets, record.changeSetId, record);
}

async function handleChangeSetAction(req, res, match) {
  const changeSet = await loadEngineeringChangeSet(match.id).catch(() => null);
  const baseline = await loadRecord(DIRS.engineeringBaselines, match.id).catch(() => null);
  const engineeringPackage = await loadRecord(DIRS.engineeringPackages, match.id).catch(() => null);
  const revision = engineeringPackage ?? baseline ?? {};
  const revisionId = changeSet?.revisionId ?? firstText(revision.engineeringRevisionId, revision.revisionId, match.id);
  if (match.action === "replay") {
    const changeSets = await engineeringChangeSetsForRevision(revisionId, revision);
    jsonResponse(res, 200, { replay: projectEngineeringRevisionFromChangeSets(revision, changeSets, baseline ?? revision), changeSets });
    return true;
  }
  if (match.action === "compare") {
    const changeSets = await engineeringChangeSetsForRevision(revisionId, revision);
    const original = projectEngineeringRevisionFromChangeSets(revision, [], baseline ?? revision);
    const current = projectEngineeringRevisionFromChangeSets(revision, changeSets, baseline ?? revision);
    jsonResponse(res, 200, { comparison: compareProjectionStates(original, current), originalProjection: original, currentProjection: current });
    return true;
  }
  if (match.action === "discard") {
    if (changeSet) {
      jsonResponse(res, 200, { engineeringChangeSet: await updateChangeSetStatus(changeSet, "DISCARDED") });
      return true;
    }
    const changeSets = await engineeringChangeSetsForRevision(revisionId, revision);
    const saved = [];
    for (const candidate of changeSets) saved.push(await updateChangeSetStatus(candidate, candidate.status === "APPLIED" ? candidate.status : "DISCARDED"));
    jsonResponse(res, 200, { engineeringChangeSets: saved, items: saved });
    return true;
  }
  if (match.action === "restore-original") {
    const changeSets = await engineeringChangeSetsForRevision(revisionId, revision);
    const saved = [];
    for (const candidate of changeSets) saved.push(await updateChangeSetStatus(candidate, "INACTIVE"));
    jsonResponse(res, 200, { engineeringChangeSets: saved, items: saved, restoredOriginal: true });
    return true;
  }
  return false;
}

export async function handleEngineeringChangeSets(req, res, pathname) {
  const match = routeMatch(pathname, CHANGE_SET_BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority"], "You do not have authority to read Engineering Change Sets.")
    : requireAnyPermission(req, res, ["workspace.engineering.write", "scopeversion.authority"], "Only Engineering may write Engineering Change Sets.");
  if (!user) return true;

  if (match.base && req.method === "GET") {
    const records = sortedByUpdated((await listRecords(DIRS.engineeringChangeSets)).map(engineeringChangeSetRecordForRepository));
    jsonResponse(res, 200, { engineeringChangeSets: records, items: records });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const record = await loadEngineeringChangeSet(match.id).catch(() => null);
    if (!record) errorResponse(res, 404, `Engineering Change Set not found: ${match.id}`);
    else jsonResponse(res, 200, { engineeringChangeSet: record });
    return true;
  }
  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "engineeringChangeSet", ["engineeringChangeSets", "items", "data"]) ?? {};
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const item of records) saved.push(await persistEngineeringChangeSet({ ...item, createdBy: item.createdBy ?? user.name, createdById: item.createdById ?? user.userId }));
    if (Array.isArray(input)) jsonResponse(res, 201, { engineeringChangeSets: saved, items: saved });
    else jsonResponse(res, 201, { engineeringChangeSet: saved[0] });
    return true;
  }
  if (!match.base && req.method === "POST" && match.action) {
    if (await handleChangeSetAction(req, res, match)) return true;
  }
  errorResponse(res, 405, "Engineering Change Set method not allowed.");
  return true;
}

export function engineeringChangeSetRepositoryFile(changeSetId) {
  return recordPath(DIRS.engineeringChangeSets, changeSetId);
}
