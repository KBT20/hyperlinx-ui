import type {
  ClosureRecord,
  ControlWorkItem,
  FieldClosure,
  RouteStation,
  RouteStationState,
  ScopeInfrastructureObject,
  ScopeObjectState,
  ScopeVersion,
} from "../types/dal";
import { normalizeControlWorkStatus } from "./KernelStateRegistry";

export interface CompletionWarning {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
  entityId?: string;
}

export interface CompletionProjection {
  scopeVersionId: string;

  totalFeet: number;
  completedFeet: number;
  releasedFeet: number;
  inProgressFeet: number;
  verifiedFeet: number;
  blockedFeet: number;
  rejectedFeet: number;

  totalStations: number;
  releasedStations: number;
  inProgressStations: number;
  completedStations: number;
  verifiedStations: number;
  blockedStations: number;
  rejectedStations: number;

  totalObjects: number;
  plannedObjects: number;
  releasedObjects: number;
  installedObjects: number;
  testedObjects: number;
  acceptedObjects: number;
  completedObjects: number;
  verifiedObjects: number;
  blockedObjects: number;
  rejectedObjects: number;

  totalWorkItems: number;
  pendingWorkItems: number;
  activeWorkItems: number;
  holdWorkItems: number;
  completedWorkItems: number;
  cancelledWorkItems: number;
  blockedWorkItems: number;

  percentReleased: number;
  percentInProgress: number;
  percentComplete: number;
  percentVerified: number;

  objectCompletionPercent: number;
  stationCompletionPercent: number;
  workCompletionPercent: number;

  completionAuthority: "CLOSURE_LEDGER" | "SCOPEVERSION_STATE" | "MIXED";
  warnings: CompletionWarning[];
}

export type CompletionProjectionInput = {
  scopeVersion: ScopeVersion | null | undefined;
  workItems?: ControlWorkItem[];
  closures?: Array<ClosureRecord | FieldClosure>;
};

const OBJECT_PROGRESS_WEIGHT: Record<ScopeObjectState, number> = {
  PLANNED: 0,
  RELEASED: 0.1,
  INSTALLED: 0.4,
  TESTED: 0.65,
  ACCEPTED: 0.8,
  COMPLETE: 1,
  VERIFIED: 1,
  BLOCKED: 0,
  REJECTED: 0,
};

const STATION_PROGRESS_WEIGHT: Record<RouteStationState, number> = {
  PLANNED: 0,
  RELEASED: 0.1,
  IN_PROGRESS: 0.5,
  COMPLETE: 1,
  VERIFIED: 1,
  BLOCKED: 0,
  REJECTED: 0,
};

const WORK_PROGRESS_WEIGHT: Record<string, number> = {
  PENDING: 0,
  ACTIVE: 0.25,
  HOLD: 0.1,
  BLOCKED: 0,
  COMPLETE: 1,
  CANCELLED: 0,
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function numberOrZero(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isRouteStation(value: unknown): value is RouteStation {
  return Boolean(value) && typeof value === "object" && typeof (value as RouteStation).stationId === "string";
}

function isScopeObject(value: unknown): value is ScopeInfrastructureObject {
  return Boolean(value) && typeof value === "object" && typeof (value as ScopeInfrastructureObject).objectId === "string";
}

function routeStations(scopeVersion: ScopeVersion | null | undefined): RouteStation[] {
  return Array.isArray(scopeVersion?.canonicalTruth?.stations)
    ? scopeVersion.canonicalTruth.stations.filter(isRouteStation).slice().sort((a, b) => numberOrZero(a.measureFeet) - numberOrZero(b.measureFeet))
    : [];
}

function scopeObjects(scopeVersion: ScopeVersion | null | undefined): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion?.canonicalTruth?.objects) ? scopeVersion.canonicalTruth.objects.filter(isScopeObject) : [];
}

function scopeClosureRecords(scopeVersion: ScopeVersion | null | undefined): ClosureRecord[] {
  if (!scopeVersion) return [];
  const records = [
    ...(Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : []),
    ...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []),
  ].filter((closure) => closure.scopeVersionId === scopeVersion.scopeVersionId);
  return dedupeById(records, "closureId") as ClosureRecord[];
}

function dedupeById<T>(records: T[], key: string) {
  const byId = new Map<string, T>();
  records.forEach((record, index) => {
    const id = String((record as Record<string, unknown>)?.[key] ?? `${key}-${index}`);
    if (!byId.has(id)) byId.set(id, record);
  });
  return Array.from(byId.values());
}

function stateCounts<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function closureId(closure: ClosureRecord | FieldClosure) {
  return String((closure as ClosureRecord).closureId ?? (closure as FieldClosure).closureId ?? "");
}

function closureScopeVersionId(closure: ClosureRecord | FieldClosure) {
  return String(closure.scopeVersionId ?? "");
}

function closureFeet(closure: ClosureRecord | FieldClosure) {
  return Math.max(0, numberOrZero((closure as ClosureRecord).feetAffected ?? (closure as FieldClosure).footage));
}

function isClosureRecord(closure: ClosureRecord | FieldClosure): closure is ClosureRecord {
  return Array.isArray((closure as ClosureRecord).objectIds) || typeof (closure as ClosureRecord).newObjectState === "string" || typeof (closure as ClosureRecord).newStationState === "string";
}

function stationDelta(stations: RouteStation[], stationId?: string) {
  if (!stationId) return 0;
  const index = stations.findIndex((station) => station.stationId === stationId);
  if (index < 0) return 0;
  if (index > 0) return Math.max(0, numberOrZero(stations[index].measureFeet) - numberOrZero(stations[index - 1].measureFeet));
  if (stations[1]) return Math.max(0, numberOrZero(stations[1].measureFeet) - numberOrZero(stations[0].measureFeet));
  return 0;
}

function rangeDelta(stations: RouteStation[], stationStartId?: string, stationEndId?: string) {
  const start = stations.find((station) => station.stationId === stationStartId);
  const end = stations.find((station) => station.stationId === stationEndId);
  if (!start || !end) return 0;
  return Math.abs(numberOrZero(end.measureFeet) - numberOrZero(start.measureFeet));
}

function scopeTotalFeet(scopeVersion: ScopeVersion | null | undefined, stations: RouteStation[], warnings: CompletionWarning[]) {
  const totalFeet = numberOrZero(
    scopeVersion?.canonicalTruth?.stationing?.routeFeet ??
      scopeVersion?.certifiedRouteReference?.routeFeet ??
      (scopeVersion?.canonicalTruth as Record<string, any> | undefined)?.certifiedRouteReference?.routeFeet
  );
  if (totalFeet > 0) return totalFeet;

  const lastStationFeet = numberOrZero(stations.at(-1)?.measureFeet);
  if (lastStationFeet > 0) return lastStationFeet;

  const buildFeet = numberOrZero(
    scopeVersion?.buildFeet ??
      (scopeVersion?.canonicalTruth as Record<string, any> | undefined)?.engineeringBasis?.buildFeet ??
      (scopeVersion?.canonicalTruth as Record<string, any> | undefined)?.geographicBasis?.buildPath?.buildFeet ??
      (scopeVersion?.canonicalTruth as Record<string, any> | undefined)?.geographicBasis?.buildPath?.distanceFeet
  );
  if (buildFeet > 0) return buildFeet;

  warnings.push({
    code: "COMPLETION_TOTAL_FEET_MISSING",
    severity: "WARNING",
    message: "No route/station/build-path total footage was available.",
    entityId: scopeVersion?.scopeVersionId,
  });
  return 0;
}

function addWarning(warnings: CompletionWarning[], warning: CompletionWarning) {
  warnings.push(warning);
  console.warn("[COMPLETION_ENGINE_WARNING]", warning);
}

function completionFeetFromClosures(
  closures: Array<ClosureRecord | FieldClosure>,
  stations: RouteStation[],
  objectIds: Set<string>,
  stationIds: Set<string>,
  warnings: CompletionWarning[]
) {
  let completedFeet = 0;
  let verifiedFeet = 0;
  closures.forEach((closure) => {
    if (!isClosureRecord(closure)) return;
    const id = closureId(closure);
    const feet = closureFeet(closure);

    if (closure.closureType === "OBJECT_STATE_TRANSITION" || closure.closureType === "OBJECT_RANGE_TRANSITION") {
      const objectIdsForClosure = closure.objectIds ?? [];
      objectIdsForClosure.forEach((objectId) => {
        if (!objectIds.has(objectId)) {
          addWarning(warnings, {
            code: "COMPLETION_UNKNOWN_OBJECT",
            severity: "WARNING",
            message: `Closure references unknown object ${objectId}.`,
            entityId: id,
          });
        }
      });
      if ((closure.newObjectState === "COMPLETE" || closure.newObjectState === "VERIFIED") && feet > 0) {
        completedFeet += feet;
        if (closure.newObjectState === "VERIFIED") verifiedFeet += feet;
      }
      return;
    }

    if (closure.closureType === "STATION_STATE_TRANSITION") {
      if (closure.stationId && !stationIds.has(closure.stationId)) {
        addWarning(warnings, {
          code: "COMPLETION_UNKNOWN_STATION",
          severity: "WARNING",
          message: `Closure references unknown station ${closure.stationId}.`,
          entityId: id,
        });
      }
      if (closure.newStationState === "COMPLETE" || closure.newStationState === "VERIFIED") {
        const affectedFeet = feet > 0 ? feet : stationDelta(stations, closure.stationId);
        completedFeet += affectedFeet;
        if (closure.newStationState === "VERIFIED") verifiedFeet += affectedFeet;
      }
      return;
    }

    if (closure.closureType === "STATION_RANGE_TRANSITION") {
      [closure.stationStartId, closure.stationEndId].filter(Boolean).forEach((stationId) => {
        if (stationId && !stationIds.has(stationId)) {
          addWarning(warnings, {
            code: "COMPLETION_UNKNOWN_STATION",
            severity: "WARNING",
            message: `Range closure references unknown station ${stationId}.`,
            entityId: id,
          });
        }
      });
      if (closure.newStationState === "COMPLETE" || closure.newStationState === "VERIFIED") {
        const affectedFeet = feet > 0 ? feet : rangeDelta(stations, closure.stationStartId, closure.stationEndId);
        completedFeet += affectedFeet;
        if (closure.newStationState === "VERIFIED") verifiedFeet += affectedFeet;
      }
    }
  });
  return { completedFeet, verifiedFeet };
}

export function calculateCompletionProjection(input: CompletionProjectionInput): CompletionProjection {
  const scopeVersion = input.scopeVersion;
  const scopeVersionId = scopeVersion?.scopeVersionId ?? "";
  const warnings: CompletionWarning[] = [];
  const stations = routeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const objectIds = new Set(objects.map((object) => object.objectId));
  const stationIds = new Set(stations.map((station) => station.stationId));
  const inputWorkItems = input.workItems ?? [];
  const inputClosures = input.closures ?? [];

  console.log("[COMPLETION_ENGINE_INPUT]", {
    scopeVersionId: scopeVersionId || "none",
    inputWorkItems: inputWorkItems.length,
    inputClosures: inputClosures.length,
    scopeClosureRecords: scopeClosureRecords(scopeVersion).length,
  });

  if (!scopeVersion) {
    addWarning(warnings, {
      code: "COMPLETION_SCOPEVERSION_MISSING",
      severity: "BLOCKING",
      message: "Completion projection requires a ScopeVersion.",
    });
  }

  const workItems = inputWorkItems.filter((item) => {
    const belongs = !scopeVersionId || item.scopeVersionId === scopeVersionId;
    if (!belongs) {
      addWarning(warnings, {
        code: "COMPLETION_FOREIGN_WORK_ITEM",
        severity: "WARNING",
        message: `Ignoring foreign work item ${item.workItemId}.`,
        entityId: item.workItemId,
      });
    }
    return belongs;
  });
  const closures = dedupeById([...inputClosures, ...scopeClosureRecords(scopeVersion)], "closureId").filter((closure) => {
    const belongs = !scopeVersionId || closureScopeVersionId(closure as ClosureRecord | FieldClosure) === scopeVersionId;
    if (!belongs) {
      addWarning(warnings, {
        code: "COMPLETION_FOREIGN_CLOSURE",
        severity: "WARNING",
        message: `Ignoring foreign closure ${closureId(closure as ClosureRecord | FieldClosure)}.`,
        entityId: closureId(closure as ClosureRecord | FieldClosure),
      });
    }
    return belongs;
  }) as Array<ClosureRecord | FieldClosure>;

  console.log("[COMPLETION_ENGINE_SCOPE_FILTER]", {
    scopeVersionId: scopeVersionId || "none",
    selectedWorkItems: workItems.length,
    selectedClosures: closures.length,
    foreignWorkItems: inputWorkItems.length - workItems.length,
    foreignClosures: inputClosures.length - closures.filter((closure) => inputClosures.includes(closure)).length,
  });

  const stationCounts = stateCounts(stations.map((station) => station.stationState));
  const objectCounts = stateCounts(objects.map((object) => object.objectState));
  const workStatuses = workItems.map((item) => normalizeControlWorkStatus(item.status));
  const workCounts = stateCounts(workStatuses);
  const totalFeet = scopeTotalFeet(scopeVersion, stations, warnings);
  const closureFootage = completionFeetFromClosures(closures, stations, objectIds, stationIds, warnings);

  const stationWeightedProgress = stations.reduce((sum, station) => sum + (STATION_PROGRESS_WEIGHT[station.stationState] ?? 0), 0);
  const objectWeightedProgress = objects.reduce((sum, object) => sum + (OBJECT_PROGRESS_WEIGHT[object.objectState] ?? 0), 0);
  const workWeightedProgress = workStatuses.reduce((sum, status) => sum + (WORK_PROGRESS_WEIGHT[status] ?? 0), 0);

  const completedFeet = Math.min(totalFeet || closureFootage.completedFeet, closureFootage.completedFeet);
  const verifiedFeet = Math.min(totalFeet || closureFootage.verifiedFeet, closureFootage.verifiedFeet);
  const releasedFeet = totalFeet > 0 ? totalFeet * ((stationCounts.RELEASED ?? 0) / Math.max(stations.length, 1)) : 0;
  const inProgressFeet = totalFeet > 0 ? totalFeet * ((stationCounts.IN_PROGRESS ?? 0) / Math.max(stations.length, 1)) : 0;
  const blockedFeet = totalFeet > 0 ? totalFeet * ((stationCounts.BLOCKED ?? 0) / Math.max(stations.length, 1)) : 0;
  const rejectedFeet = totalFeet > 0 ? totalFeet * ((stationCounts.REJECTED ?? 0) / Math.max(stations.length, 1)) : 0;

  const objectCompletionPercent = objects.length ? clampPercent((objectWeightedProgress / objects.length) * 100) : 0;
  const stationCompletionPercent = stations.length ? clampPercent((stationWeightedProgress / stations.length) * 100) : 0;
  const workCompletionPercent = workItems.length ? clampPercent((workWeightedProgress / workItems.length) * 100) : 0;
  const percentComplete = totalFeet > 0 ? clampPercent((completedFeet / totalFeet) * 100) : 0;
  const completionAuthority =
    closures.length && (objects.length || stations.length)
      ? "MIXED"
      : closures.length
        ? "CLOSURE_LEDGER"
        : "SCOPEVERSION_STATE";

  const projection: CompletionProjection = {
    scopeVersionId,
    totalFeet,
    completedFeet,
    releasedFeet,
    inProgressFeet,
    verifiedFeet,
    blockedFeet,
    rejectedFeet,
    totalStations: stations.length,
    releasedStations: stationCounts.RELEASED ?? 0,
    inProgressStations: stationCounts.IN_PROGRESS ?? 0,
    completedStations: stationCounts.COMPLETE ?? 0,
    verifiedStations: stationCounts.VERIFIED ?? 0,
    blockedStations: stationCounts.BLOCKED ?? 0,
    rejectedStations: stationCounts.REJECTED ?? 0,
    totalObjects: objects.length,
    plannedObjects: objectCounts.PLANNED ?? 0,
    releasedObjects: objectCounts.RELEASED ?? 0,
    installedObjects: objectCounts.INSTALLED ?? 0,
    testedObjects: objectCounts.TESTED ?? 0,
    acceptedObjects: objectCounts.ACCEPTED ?? 0,
    completedObjects: objectCounts.COMPLETE ?? 0,
    verifiedObjects: objectCounts.VERIFIED ?? 0,
    blockedObjects: objectCounts.BLOCKED ?? 0,
    rejectedObjects: objectCounts.REJECTED ?? 0,
    totalWorkItems: workItems.length,
    pendingWorkItems: workCounts.PENDING ?? 0,
    activeWorkItems: workCounts.ACTIVE ?? 0,
    holdWorkItems: workCounts.HOLD ?? 0,
    completedWorkItems: workCounts.COMPLETE ?? 0,
    cancelledWorkItems: workCounts.CANCELLED ?? 0,
    blockedWorkItems: workCounts.BLOCKED ?? 0,
    percentReleased: totalFeet > 0 ? clampPercent((releasedFeet / totalFeet) * 100) : objects.length ? clampPercent(((objectCounts.RELEASED ?? 0) / objects.length) * 100) : 0,
    percentInProgress: totalFeet > 0 ? clampPercent((inProgressFeet / totalFeet) * 100) : stationCompletionPercent,
    percentComplete,
    percentVerified: totalFeet > 0 ? clampPercent((verifiedFeet / totalFeet) * 100) : 0,
    objectCompletionPercent,
    stationCompletionPercent,
    workCompletionPercent,
    completionAuthority,
    warnings,
  };

  if (projection.completedFeet > projection.totalFeet && projection.totalFeet > 0) {
    addWarning(warnings, {
      code: "COMPLETION_FEET_EXCEEDS_TOTAL",
      severity: "WARNING",
      message: "Completed feet exceeds total feet.",
      entityId: scopeVersionId,
    });
  }

  console.log("[COMPLETION_ENGINE_PROJECTION]", {
    scopeVersionId: scopeVersionId || "none",
    completedFeet: projection.completedFeet,
    totalFeet: projection.totalFeet,
    percentComplete: projection.percentComplete,
    objectCompletionPercent: projection.objectCompletionPercent,
    stationCompletionPercent: projection.stationCompletionPercent,
    workCompletionPercent: projection.workCompletionPercent,
    completionAuthority: projection.completionAuthority,
    warningCount: projection.warnings.length,
  });

  return projection;
}
