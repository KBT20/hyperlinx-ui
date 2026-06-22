import type { ClosureRecord, ScopeInfrastructureObject, ScopeVersion } from "../types/dal";
import { buildFieldExecutionViewModel } from "../field/FieldExecutionViewModel";
import { calculateScopeVersionProgress } from "./ClosureAuthorityEngine";
import { getAuthoritativeLifecycleState } from "./ScopeVersionLifecycleGuard";

function objects(scopeVersion: ScopeVersion): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion.canonicalTruth?.objects) ? (scopeVersion.canonicalTruth.objects as ScopeInfrastructureObject[]) : [];
}

function closures(scopeVersion: ScopeVersion): ClosureRecord[] {
  const byId = new Map<string, ClosureRecord>();
  [...(scopeVersion.canonicalTruth?.closures ?? []), ...(scopeVersion.closures ?? [])].forEach((closure) => byId.set(closure.closureId, closure));
  return Array.from(byId.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function buildScopeVersionTwinProjection(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) {
    return {
      scopeVersionId: "",
      proposedScopeVersionState: "none",
      lifecycleState: "ANALYZED",
      completedStationCount: 0,
      verifiedStationCount: 0,
      completedFeet: 0,
      percentComplete: 0,
      stationStateCounts: {},
      stationDerivedStateCounts: {},
      objectStateCounts: {},
      objectSummary: {},
      plannedObjects: 0,
      releasedObjects: 0,
      inProgressObjects: 0,
      installedObjects: 0,
      testedObjects: 0,
      acceptedObjects: 0,
      completeObjects: 0,
      verifiedObjects: 0,
      blockedObjects: 0,
      rejectedObjects: 0,
      stationDerivedCompletionPercent: 0,
      objectCompletionPercent: 0,
      closureTimeline: [],
      blockedStations: [],
      rejectedStations: [],
    };
  }
  const progress = calculateScopeVersionProgress(scopeVersion);
  const lifecycleState = getAuthoritativeLifecycleState(scopeVersion);
  const fieldExecution = buildFieldExecutionViewModel(scopeVersion);
  const stationList = Array.isArray(scopeVersion.canonicalTruth?.stations) ? (scopeVersion.canonicalTruth.stations as any[]) : [];
  const objectStateCounts = progress.objectStateCounts as Record<string, number>;
  const inProgressObjects = Number(objectStateCounts.INSTALLED ?? 0) + Number(objectStateCounts.TESTED ?? 0) + Number(objectStateCounts.ACCEPTED ?? 0);
  const completedObjectCount = Number(objectStateCounts.COMPLETE ?? 0) + Number(objectStateCounts.VERIFIED ?? 0);
  const objectCompletionPercent = progress.totalObjects ? (completedObjectCount / progress.totalObjects) * 100 : 0;
  const stationDerivedComplete =
    Number(fieldExecution.stationDerivedStateCounts.COMPLETE ?? 0) +
    Number(fieldExecution.stationDerivedStateCounts.VERIFIED ?? 0);
  const stationDerivedCompletionPercent = fieldExecution.stations.length ? (stationDerivedComplete / fieldExecution.stations.length) * 100 : 0;
  const objectSummary = objects(scopeVersion).reduce<Record<string, number>>((summary, object) => {
    summary[object.objectType] = (summary[object.objectType] ?? 0) + 1;
    return summary;
  }, {});
  const projection = {
    scopeVersionId: scopeVersion.scopeVersionId,
    inventoryId: scopeVersion.inventoryId,
    graphId: scopeVersion.graphId,
    lifecycleState,
    currentInventory: scopeVersion.inventoryId ?? scopeVersion.sourceInventoryId ?? "none",
    proposedScopeVersionState: lifecycleState,
    completedStationCount: progress.completeStations,
    verifiedStationCount: progress.verifiedStations,
    completedFeet: progress.completedFeet,
    percentComplete: progress.percentComplete,
    stationStateCounts: progress.stationStateCounts,
    stationDerivedStateCounts: fieldExecution.stationDerivedStateCounts,
    objectStateCounts,
    objectSummary,
    plannedObjects: objectStateCounts.PLANNED ?? 0,
    releasedObjects: objectStateCounts.RELEASED ?? 0,
    inProgressObjects,
    installedObjects: objectStateCounts.INSTALLED ?? 0,
    testedObjects: objectStateCounts.TESTED ?? 0,
    acceptedObjects: objectStateCounts.ACCEPTED ?? 0,
    completeObjects: objectStateCounts.COMPLETE ?? 0,
    verifiedObjects: objectStateCounts.VERIFIED ?? 0,
    blockedObjects: objectStateCounts.BLOCKED ?? 0,
    rejectedObjects: objectStateCounts.REJECTED ?? 0,
    stationDerivedCompletionPercent,
    objectCompletionPercent,
    closureTimeline: closures(scopeVersion),
    blockedStations: stationList.filter((station) => station.stationState === "BLOCKED").map((station) => station.stationId),
    rejectedStations: stationList.filter((station) => station.stationState === "REJECTED").map((station) => station.stationId),
  };
  console.log("[TWIN_PROJECTION]", projection);
  return projection;
}
