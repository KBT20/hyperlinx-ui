import type {
  EngineeringBaselineReference,
  EngineeringChangeSet,
  EngineeringPatch,
  EngineeringPatchReplay,
  EngineeringPatchValue,
  EngineeringRevisionComparison,
  EngineeringRevisionProjection,
  EngineeringRevisionProjectionState,
} from "./EngineeringChangeSet";
import { engineeringBaselineReferenceHash, stableEngineeringHash, validateEngineeringChangeSet, validateEngineeringPatch } from "./EngineeringPatchValidator";

function blankProjectionState(): EngineeringRevisionProjectionState {
  return {
    stations: {
      moves: [],
      inserted: [],
      removed: [],
      types: {},
      intervals: {},
    },
    objects: {
      moves: [],
      added: [],
      removed: [],
      classes: {},
      types: {},
      statuses: {},
      sizes: {},
      configurations: {},
    },
    constraints: {
      added: [],
      removed: [],
      resolved: [],
      exceptions: [],
      clearances: {},
      placements: {},
    },
    fiber: {
      splices: {},
      spliceCases: {},
      fiberAssignments: {},
      bufferAssignments: {},
      loss: {},
      regen: {},
      ilaConfiguration: {},
    },
    evidence: {
      added: [],
      removed: [],
      reviewStatus: {},
      notes: [],
    },
  };
}

function setByPatch(state: EngineeringRevisionProjectionState, patch: EngineeringPatch) {
  switch (patch.patchType) {
    case "MOVE_STATION":
      state.stations.moves.push(patch);
      break;
    case "INSERT_STATION":
      state.stations.inserted.push(patch);
      break;
    case "REMOVE_STATION":
      state.stations.removed.push(patch);
      break;
    case "CHANGE_STATION_TYPE":
      state.stations.types[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_STATION_INTERVAL":
      state.stations.intervals[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "MOVE_OBJECT":
      state.objects.moves.push(patch);
      break;
    case "ADD_OBJECT":
      state.objects.added.push(patch);
      break;
    case "REMOVE_OBJECT":
      state.objects.removed.push(patch);
      break;
    case "CHANGE_OBJECT_CLASS":
      state.objects.classes[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_OBJECT_TYPE":
      state.objects.types[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_OBJECT_STATUS":
      state.objects.statuses[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_OBJECT_SIZE":
      state.objects.sizes[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_OBJECT_CONFIGURATION":
      state.objects.configurations[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "ADD_CONSTRAINT":
      state.constraints.added.push(patch);
      break;
    case "REMOVE_CONSTRAINT":
      state.constraints.removed.push(patch);
      break;
    case "RESOLVE_CONSTRAINT":
      state.constraints.resolved.push(patch);
      break;
    case "ADD_EXCEPTION":
    case "RESOLVE_EXCEPTION":
      state.constraints.exceptions.push(patch);
      break;
    case "CHANGE_CLEARANCE":
      state.constraints.clearances[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_PLACEMENT":
      state.constraints.placements[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_SPLICE":
      state.fiber.splices[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_SPLICE_CASE":
      state.fiber.spliceCases[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_FIBER_ASSIGNMENT":
      state.fiber.fiberAssignments[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_BUFFER_ASSIGNMENT":
      state.fiber.bufferAssignments[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_LOSS":
      state.fiber.loss[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_REGEN":
      state.fiber.regen[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_ILA_CONFIGURATION":
      state.fiber.ilaConfiguration[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "ADD_EVIDENCE":
      state.evidence.added.push(patch);
      break;
    case "REMOVE_EVIDENCE":
      state.evidence.removed.push(patch);
      break;
    case "CHANGE_REVIEW_STATUS":
      state.evidence.reviewStatus[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "ADD_ENGINEERING_NOTE":
      state.evidence.notes.push(patch);
      break;
    default:
      state.objects.configurations[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
  }
}

function normalizedPatches(changeSets: EngineeringChangeSet[]) {
  const warnings: string[] = [];
  const patches: EngineeringPatch[] = [];
  for (const changeSet of changeSets) {
    const result = validateEngineeringChangeSet(changeSet);
    warnings.push(...result.warnings);
    if (!result.valid || !result.normalizedChangeSet) {
      warnings.push(...result.errors.map((error) => `Skipped invalid Engineering Change Set ${changeSet.changeSetId}: ${error}`));
      continue;
    }
    if (["DISCARDED", "INACTIVE"].includes(result.normalizedChangeSet.status)) continue;
    for (const patch of result.normalizedChangeSet.patches) {
      const patchResult = validateEngineeringPatch(patch);
      warnings.push(...patchResult.warnings);
      if (patchResult.normalizedPatch) patches.push(patchResult.normalizedPatch);
    }
  }
  return {
    warnings,
    patches: patches.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  };
}

export function buildEngineeringRevisionProjection(
  engineeringBaseline: EngineeringBaselineReference,
  revision: EngineeringBaselineReference,
  changeSets: EngineeringChangeSet[],
): EngineeringRevisionProjection {
  const replayStarted = performance.now();
  const { warnings, patches } = normalizedPatches(changeSets);
  const patchReplayTimeMs = Number((performance.now() - replayStarted).toFixed(3));
  const projectionStarted = performance.now();
  const projectionState = blankProjectionState();
  patches.forEach((patch) => setByPatch(projectionState, patch));
  const baselineHash = engineeringBaseline.engineeringBaselineHash
    ? String(engineeringBaseline.engineeringBaselineHash)
    : engineeringBaselineReferenceHash(engineeringBaseline);
  const revisionId = String(revision.engineeringRevisionId ?? engineeringBaseline.engineeringRevisionId ?? `ENG-REV-${engineeringBaseline.engineeringBaselineId ?? "BASELINE"}-000`);
  const revisionHash = stableEngineeringHash({
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
  const projectionTimeMs = Number((performance.now() - projectionStarted).toFixed(3));
  return {
    projectionId: `ENGINEERING-REVISION-PROJECTION-${revisionId}-${revisionHash}`,
    revisionId,
    engineeringBaselineId: String(engineeringBaseline.engineeringBaselineId ?? revision.engineeringBaselineId ?? ""),
    engineeringPackageId: String(revision.engineeringPackageId ?? engineeringBaseline.engineeringPackageId ?? ""),
    sourceAuthority: "ENGINEERING_BASELINE",
    revisionAuthority: "ENGINEERING_REVISION",
    patchAuthority: "ENGINEERING_CHANGE_SET",
    changeSetIds: changeSets
      .filter((changeSet) => !["DISCARDED", "INACTIVE"].includes(changeSet.status))
      .map((changeSet) => changeSet.changeSetId),
    patches,
    projectionState,
    diagnostics: {
      baselineHash,
      revisionHash,
      activePatchCount: patches.length,
      appliedPatchCount: changeSets.filter((changeSet) => changeSet.status === "APPLIED").reduce((total, changeSet) => total + changeSet.patches.length, 0),
      patchReplayTimeMs,
      projectionTimeMs,
      warnings,
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

export function replayEngineeringPatches(
  engineeringBaseline: EngineeringBaselineReference,
  revision: EngineeringBaselineReference,
  changeSets: EngineeringChangeSet[],
): EngineeringPatchReplay {
  const projection = buildEngineeringRevisionProjection(engineeringBaseline, revision, changeSets);
  return {
    replayId: `ENGINEERING-PATCH-REPLAY-${projection.revisionId}-${Date.now()}`,
    revisionId: projection.revisionId,
    baselineHash: projection.diagnostics.baselineHash,
    revisionHash: projection.diagnostics.revisionHash,
    patchCount: projection.patches.length,
    activePatchCount: projection.diagnostics.activePatchCount,
    appliedPatchCount: projection.diagnostics.appliedPatchCount,
    patchReplayTimeMs: projection.diagnostics.patchReplayTimeMs,
    projectionTimeMs: projection.diagnostics.projectionTimeMs,
    warnings: projection.diagnostics.warnings,
    projection,
  };
}

function collectPatchResultDifferences(category: EngineeringRevisionComparison["differences"][number]["category"], from: Record<string, EngineeringPatchValue>, to: Record<string, EngineeringPatchValue>) {
  const keys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)])).sort();
  return keys
    .filter((key) => JSON.stringify(from[key] ?? null) !== JSON.stringify(to[key] ?? null))
    .map((key) => ({
      category,
      targetProperty: key,
      fromValue: from[key] ?? null,
      toValue: to[key] ?? null,
    }));
}

export function compareEngineeringRevisionProjections(
  fromProjection: EngineeringRevisionProjection,
  toProjection: EngineeringRevisionProjection,
): EngineeringRevisionComparison {
  const differences = [
    ...collectPatchResultDifferences("stationing", fromProjection.projectionState.stations.types, toProjection.projectionState.stations.types),
    ...collectPatchResultDifferences("stationing", fromProjection.projectionState.stations.intervals, toProjection.projectionState.stations.intervals),
    ...collectPatchResultDifferences("objects", fromProjection.projectionState.objects.classes, toProjection.projectionState.objects.classes),
    ...collectPatchResultDifferences("objects", fromProjection.projectionState.objects.configurations, toProjection.projectionState.objects.configurations),
    ...collectPatchResultDifferences("constraints", fromProjection.projectionState.constraints.clearances, toProjection.projectionState.constraints.clearances),
    ...collectPatchResultDifferences("constraints", fromProjection.projectionState.constraints.placements, toProjection.projectionState.constraints.placements),
    ...collectPatchResultDifferences("fiber engineering", fromProjection.projectionState.fiber.fiberAssignments, toProjection.projectionState.fiber.fiberAssignments),
    ...collectPatchResultDifferences("evidence", fromProjection.projectionState.evidence.reviewStatus, toProjection.projectionState.evidence.reviewStatus),
  ];
  if (fromProjection.projectionState.stations.moves.length !== toProjection.projectionState.stations.moves.length) {
    differences.push({ category: "stationing", targetProperty: "stationMovePatchCount", fromValue: fromProjection.projectionState.stations.moves.length, toValue: toProjection.projectionState.stations.moves.length });
  }
  if (fromProjection.projectionState.objects.moves.length !== toProjection.projectionState.objects.moves.length) {
    differences.push({ category: "objects", targetProperty: "objectMovePatchCount", fromValue: fromProjection.projectionState.objects.moves.length, toValue: toProjection.projectionState.objects.moves.length });
  }
  if (fromProjection.projectionState.constraints.added.length !== toProjection.projectionState.constraints.added.length) {
    differences.push({ category: "constraints", targetProperty: "constraintPatchCount", fromValue: fromProjection.projectionState.constraints.added.length, toValue: toProjection.projectionState.constraints.added.length });
  }
  return {
    comparisonId: `ENGINEERING-REVISION-COMPARISON-${Date.now()}`,
    fromRevisionHash: fromProjection.diagnostics.revisionHash,
    toRevisionHash: toProjection.diagnostics.revisionHash,
    differences,
    rawJsonCompared: false,
    comparedPatchResults: true,
  };
}

export function discardUnappliedEngineeringPatches(changeSets: EngineeringChangeSet[]): EngineeringChangeSet[] {
  return changeSets.map((changeSet) => ({
    ...changeSet,
    status: changeSet.status === "APPLIED" ? changeSet.status : "DISCARDED",
    activePatchCount: changeSet.status === "APPLIED" ? changeSet.activePatchCount : 0,
    updatedAt: new Date().toISOString(),
  }));
}

export function restoreOriginalEngineeringRevision(changeSets: EngineeringChangeSet[]): EngineeringChangeSet[] {
  return changeSets.map((changeSet) => ({
    ...changeSet,
    status: "INACTIVE",
    activePatchCount: 0,
    appliedPatchCount: 0,
    updatedAt: new Date().toISOString(),
  }));
}

export function engineeringChangeSetFromPatches(input: {
  revisionId: string;
  engineeringBaselineId: string;
  engineeringPackageId?: string;
  draftIOFPackageId?: string;
  opportunityId?: string;
  routeRepositoryId?: string;
  proposalId?: string;
  estimateId?: string;
  workbookId?: string;
  baselineHash?: string;
  revisionNumber?: number;
  patches: EngineeringPatch[];
  createdBy: string;
  createdById?: string;
}): EngineeringChangeSet {
  const now = new Date().toISOString();
  const patchHash = stableEngineeringHash(input.patches.map((patch) => ({
    patchId: patch.patchId,
    patchType: patch.patchType,
    targetProperty: patch.targetProperty,
    newValue: patch.newValue,
  })), "engineering-change-set");
  return {
    changeSetId: `ENGINEERING-CHANGE-SET-${input.revisionId}-${Date.now()}`,
    revisionId: input.revisionId,
    engineeringBaselineId: input.engineeringBaselineId,
    engineeringPackageId: input.engineeringPackageId,
    draftIOFPackageId: input.draftIOFPackageId,
    opportunityId: input.opportunityId,
    routeRepositoryId: input.routeRepositoryId,
    proposalId: input.proposalId,
    estimateId: input.estimateId,
    workbookId: input.workbookId,
    revisionNumber: input.revisionNumber ?? 1,
    baselineHash: input.baselineHash ?? stableEngineeringHash({ engineeringBaselineId: input.engineeringBaselineId }, "engineering-baseline"),
    revisionHash: patchHash,
    projectionHash: patchHash,
    status: "ACTIVE",
    patchCount: input.patches.length,
    activePatchCount: input.patches.length,
    appliedPatchCount: 0,
    patches: input.patches,
    createdBy: input.createdBy,
    createdById: input.createdById,
    createdAt: now,
    updatedAt: now,
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
}
