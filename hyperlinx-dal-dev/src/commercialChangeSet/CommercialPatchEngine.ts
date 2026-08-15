import type {
  CommercialChangeSet,
  CommercialPatch,
  CommercialPatchReplay,
  CommercialPatchValue,
  CommercialRevisionComparison,
  CommercialRevisionProjection,
  CommercialRevisionProjectionState,
  CommercialRevisionReference,
} from "./CommercialChangeSet";
import { repositoryReferenceHash, stableCommercialHash, validateCommercialChangeSet, validateCommercialPatch } from "./CommercialPatchValidator";

function blankProjectionState(): CommercialRevisionProjectionState {
  return {
    constructionPercentages: {},
    rates: {},
    engineeringAssumptions: {},
    risk: {
      unknowns: [],
      risks: [],
      exceptions: [],
    },
    route: {
      alignmentMoves: [],
      constructionMethods: {},
      segmentTypes: {},
    },
    commercialImpacts: {
      costs: [],
      revenue: [],
      proposal: [],
      engineering: [],
    },
  };
}

function setByPatch(state: CommercialRevisionProjectionState, patch: CommercialPatch) {
  switch (patch.patchType) {
    case "CHANGE_PLOW_PERCENT":
    case "CHANGE_BORE_PERCENT":
    case "CHANGE_ROCK_PERCENT":
    case "CHANGE_TRENCH_PERCENT":
    case "CHANGE_AERIAL_PERCENT":
      state.constructionPercentages[patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_PLOW_RATE":
    case "CHANGE_BORE_RATE":
    case "CHANGE_LABOR_RATE":
    case "CHANGE_MATERIAL_RATE":
    case "CHANGE_EQUIPMENT_RATE":
    case "CHANGE_MARKUP":
    case "CHANGE_CONTINGENCY":
      state.rates[patch.targetProperty] = patch.newValue;
      break;
    case "MOVE_ILA":
    case "REMOVE_ILA":
    case "RESTORE_ILA":
    case "CHANGE_MAX_SPAN":
    case "CHANGE_OPTICAL_LOSS":
    case "CHANGE_REGEN_SPACING":
    case "CHANGE_STATION_SPACING":
    case "REMOVE_BOOKEND":
    case "RESTORE_BOOKEND":
      state.engineeringAssumptions[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      state.commercialImpacts.engineering.push(patch);
      break;
    case "ADD_UNKNOWN":
    case "RESOLVE_UNKNOWN":
      state.risk.unknowns.push(patch);
      break;
    case "ADD_RISK":
    case "RESOLVE_RISK":
      state.risk.risks.push(patch);
      break;
    case "ADD_EXCEPTION":
    case "RESOLVE_EXCEPTION":
      state.risk.exceptions.push(patch);
      break;
    case "MOVE_ALIGNMENT":
      state.route.alignmentMoves.push(patch);
      break;
    case "CHANGE_CONSTRUCTION_METHOD":
      state.route.constructionMethods[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_SEGMENT_TYPE":
      state.route.segmentTypes[patch.targetObjectId || patch.targetProperty] = patch.newValue;
      break;
    case "CHANGE_MONTHLY_REVENUE":
      state.commercialImpacts.revenue.push(patch);
      break;
    case "CHANGE_MARGIN_ASSUMPTION":
      state.commercialImpacts.proposal.push(patch);
      break;
    default:
      state.commercialImpacts.costs.push(patch);
      break;
  }
}

function normalizedPatches(changeSets: CommercialChangeSet[]) {
  const warnings: string[] = [];
  const patches: CommercialPatch[] = [];
  for (const changeSet of changeSets) {
    const result = validateCommercialChangeSet(changeSet);
    warnings.push(...result.warnings);
    if (!result.valid || !result.normalizedChangeSet) {
      warnings.push(...result.errors.map((error) => `Skipped invalid Commercial Change Set ${changeSet.changeSetId}: ${error}`));
      continue;
    }
    if (["DISCARDED", "INACTIVE"].includes(result.normalizedChangeSet.status)) continue;
    for (const patch of result.normalizedChangeSet.patches) {
      const patchResult = validateCommercialPatch(patch);
      warnings.push(...patchResult.warnings);
      if (patchResult.normalizedPatch) patches.push(patchResult.normalizedPatch);
    }
  }
  return {
    warnings,
    patches: patches.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  };
}

export function buildCommercialRevisionProjection(
  repositoryTruth: CommercialRevisionReference,
  revision: CommercialRevisionReference,
  changeSets: CommercialChangeSet[],
): CommercialRevisionProjection {
  const replayStarted = performance.now();
  const { warnings, patches } = normalizedPatches(changeSets);
  const patchReplayTimeMs = Number((performance.now() - replayStarted).toFixed(3));
  const projectionStarted = performance.now();
  const projectionState = blankProjectionState();
  patches.forEach((patch) => setByPatch(projectionState, patch));
  const repositoryHash = repositoryReferenceHash(repositoryTruth, revision);
  const revisionId = String(revision.revisionId ?? revision.commercialRevisionId ?? repositoryTruth.revisionId ?? "COMMERCIAL-REVISION");
  const revisionHash = stableCommercialHash({
    repositoryHash,
    revisionId,
    patches: patches.map((patch) => ({
      patchId: patch.patchId,
      patchType: patch.patchType,
      targetObjectId: patch.targetObjectId,
      targetProperty: patch.targetProperty,
      newValue: patch.newValue,
    })),
  }, "commercial-revision");
  const projectionTimeMs = Number((performance.now() - projectionStarted).toFixed(3));
  return {
    projectionId: `COMMERCIAL-REVISION-PROJECTION-${revisionId}-${revisionHash}`,
    revisionId,
    repositoryId: String(revision.repositoryId ?? repositoryTruth.repositoryId ?? "COMMERCIAL_REPOSITORY"),
    opportunityId: String(revision.opportunityId ?? repositoryTruth.opportunityId ?? ""),
    proposalId: String(revision.proposalId ?? repositoryTruth.proposalId ?? ""),
    sourceAuthority: "COMMERCIAL_REPOSITORY",
    revisionAuthority: "COMMERCIAL_REVISION",
    patchAuthority: "COMMERCIAL_CHANGE_SET",
    changeSetIds: changeSets
      .filter((changeSet) => !["DISCARDED", "INACTIVE"].includes(changeSet.status))
      .map((changeSet) => changeSet.changeSetId),
    patches,
    projectionState,
    diagnostics: {
      repositoryHash,
      revisionHash,
      activePatchCount: patches.length,
      appliedPatchCount: changeSets.filter((changeSet) => changeSet.status === "APPLIED").reduce((total, changeSet) => total + changeSet.patches.length, 0),
      patchReplayTimeMs,
      projectionTimeMs,
      warnings,
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

export function replayCommercialPatches(
  repositoryTruth: CommercialRevisionReference,
  revision: CommercialRevisionReference,
  changeSets: CommercialChangeSet[],
): CommercialPatchReplay {
  const projection = buildCommercialRevisionProjection(repositoryTruth, revision, changeSets);
  return {
    replayId: `COMMERCIAL-PATCH-REPLAY-${projection.revisionId}-${Date.now()}`,
    revisionId: projection.revisionId,
    repositoryHash: projection.diagnostics.repositoryHash,
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

function collectPatchResultDifferences(category: CommercialRevisionComparison["differences"][number]["category"], from: Record<string, CommercialPatchValue>, to: Record<string, CommercialPatchValue>) {
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

export function compareCommercialRevisionProjections(
  fromProjection: CommercialRevisionProjection,
  toProjection: CommercialRevisionProjection,
): CommercialRevisionComparison {
  const differences = [
    ...collectPatchResultDifferences("construction percentages", fromProjection.projectionState.constructionPercentages, toProjection.projectionState.constructionPercentages),
    ...collectPatchResultDifferences("rates", fromProjection.projectionState.rates, toProjection.projectionState.rates),
    ...collectPatchResultDifferences("assumptions", fromProjection.projectionState.engineeringAssumptions, toProjection.projectionState.engineeringAssumptions),
  ];
  if (fromProjection.projectionState.commercialImpacts.costs.length !== toProjection.projectionState.commercialImpacts.costs.length) {
    differences.push({ category: "costs", targetProperty: "costPatchCount", fromValue: fromProjection.projectionState.commercialImpacts.costs.length, toValue: toProjection.projectionState.commercialImpacts.costs.length });
  }
  if (fromProjection.projectionState.commercialImpacts.revenue.length !== toProjection.projectionState.commercialImpacts.revenue.length) {
    differences.push({ category: "revenue", targetProperty: "revenuePatchCount", fromValue: fromProjection.projectionState.commercialImpacts.revenue.length, toValue: toProjection.projectionState.commercialImpacts.revenue.length });
  }
  if (fromProjection.projectionState.commercialImpacts.proposal.length !== toProjection.projectionState.commercialImpacts.proposal.length) {
    differences.push({ category: "proposal impact", targetProperty: "proposalPatchCount", fromValue: fromProjection.projectionState.commercialImpacts.proposal.length, toValue: toProjection.projectionState.commercialImpacts.proposal.length });
  }
  if (fromProjection.projectionState.commercialImpacts.engineering.length !== toProjection.projectionState.commercialImpacts.engineering.length) {
    differences.push({ category: "engineering impact", targetProperty: "engineeringPatchCount", fromValue: fromProjection.projectionState.commercialImpacts.engineering.length, toValue: toProjection.projectionState.commercialImpacts.engineering.length });
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

export function discardUnappliedCommercialPatches(changeSets: CommercialChangeSet[]): CommercialChangeSet[] {
  return changeSets.map((changeSet) => ({
    ...changeSet,
    status: changeSet.status === "APPLIED" ? changeSet.status : "DISCARDED",
    activePatchCount: changeSet.status === "APPLIED" ? changeSet.activePatchCount : 0,
    updatedAt: new Date().toISOString(),
  }));
}

export function restoreOriginalCommercialRevision(changeSets: CommercialChangeSet[]): CommercialChangeSet[] {
  return changeSets.map((changeSet) => ({
    ...changeSet,
    status: "INACTIVE",
    activePatchCount: 0,
    appliedPatchCount: 0,
    updatedAt: new Date().toISOString(),
  }));
}

export function commercialChangeSetFromPatches(input: {
  revisionId: string;
  opportunityId?: string;
  repositoryId?: string;
  proposalId?: string;
  routeRepositoryId?: string;
  estimateId?: string;
  workbookId?: string;
  repositoryHash?: string;
  revisionNumber?: number;
  patches: CommercialPatch[];
  createdBy: string;
  createdById?: string;
}): CommercialChangeSet {
  const now = new Date().toISOString();
  const patchHash = stableCommercialHash(input.patches.map((patch) => ({
    patchId: patch.patchId,
    patchType: patch.patchType,
    targetProperty: patch.targetProperty,
    newValue: patch.newValue,
  })), "commercial-change-set");
  return {
    changeSetId: `COMMERCIAL-CHANGE-SET-${input.revisionId}-${Date.now()}`,
    revisionId: input.revisionId,
    opportunityId: input.opportunityId,
    repositoryId: input.repositoryId,
    proposalId: input.proposalId,
    routeRepositoryId: input.routeRepositoryId,
    estimateId: input.estimateId,
    workbookId: input.workbookId,
    revisionNumber: input.revisionNumber ?? 1,
    repositoryHash: input.repositoryHash ?? stableCommercialHash({ repositoryId: input.repositoryId, opportunityId: input.opportunityId }, "commercial-repository"),
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
}
