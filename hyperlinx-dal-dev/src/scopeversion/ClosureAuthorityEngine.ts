import type {
  ClosureAuthority,
  ClosureRecord,
  ClosureType,
  RouteStation,
  RouteStationState,
  ScopeInfrastructureObject,
  ScopeObjectState,
  ScopeVersion,
  ScopeVersionLifecycleState,
} from "../types/dal";
import { transitionScopeVersionLifecycle } from "./ScopeVersionLifecycleGuard";

const STATION_TRANSITIONS: Record<RouteStationState, RouteStationState[]> = {
  PLANNED: ["RELEASED", "BLOCKED", "REJECTED"],
  RELEASED: ["IN_PROGRESS", "BLOCKED", "REJECTED"],
  IN_PROGRESS: ["COMPLETE", "BLOCKED", "REJECTED"],
  COMPLETE: ["VERIFIED", "BLOCKED", "REJECTED"],
  VERIFIED: ["BLOCKED", "REJECTED"],
  BLOCKED: ["IN_PROGRESS", "REJECTED"],
  REJECTED: [],
};

const OBJECT_TRANSITIONS: Record<ScopeObjectState, ScopeObjectState[]> = {
  PLANNED: ["RELEASED", "BLOCKED", "REJECTED"],
  RELEASED: ["INSTALLED", "BLOCKED", "REJECTED"],
  INSTALLED: ["TESTED", "BLOCKED", "REJECTED"],
  TESTED: ["ACCEPTED", "BLOCKED", "REJECTED"],
  ACCEPTED: ["COMPLETE", "BLOCKED", "REJECTED"],
  COMPLETE: ["VERIFIED", "BLOCKED", "REJECTED"],
  VERIFIED: ["BLOCKED", "REJECTED"],
  BLOCKED: ["RELEASED", "INSTALLED", "REJECTED"],
  REJECTED: [],
};

export type ClosureValidationResult = {
  valid: boolean;
  reason?: string;
  stationIds: string[];
  objectIds: string[];
  previousStationState?: RouteStationState;
  previousObjectStates?: Record<string, ScopeObjectState>;
  feetAffected: number;
};

export type CreateClosureRecordArgs = {
  scopeVersion: ScopeVersion;
  workItemId?: string;
  closureType: ClosureType;
  stationId?: string;
  stationStartId?: string;
  stationEndId?: string;
  objectId?: string;
  objectIds?: string[];
  newStationState?: RouteStationState;
  newObjectState?: ScopeObjectState;
  actorId: string;
  actorName: string;
  authority: ClosureAuthority;
  evidenceIds?: string[];
  notes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRouteStation(value: unknown): value is RouteStation {
  return Boolean(value) && typeof value === "object" && typeof (value as RouteStation).stationId === "string" && typeof (value as RouteStation).stationState === "string";
}

function isScopeObject(value: unknown): value is ScopeInfrastructureObject {
  return Boolean(value) && typeof value === "object" && typeof (value as ScopeInfrastructureObject).objectId === "string" && typeof (value as ScopeInfrastructureObject).objectState === "string";
}

function routeStations(scopeVersion: ScopeVersion): RouteStation[] {
  return Array.isArray(scopeVersion.canonicalTruth?.stations) ? scopeVersion.canonicalTruth.stations.filter(isRouteStation) : [];
}

function scopeObjects(scopeVersion: ScopeVersion): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion.canonicalTruth?.objects) ? scopeVersion.canonicalTruth.objects.filter(isScopeObject) : [];
}

function closureRecords(scopeVersion: ScopeVersion): ClosureRecord[] {
  const canonical = Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : [];
  const topLevel = Array.isArray(scopeVersion.closures) ? scopeVersion.closures : [];
  const byId = new Map<string, ClosureRecord>();
  [...canonical, ...topLevel].forEach((closure) => byId.set(closure.closureId, closure));
  return Array.from(byId.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function certifiedRouteIdFor(scopeVersion: ScopeVersion) {
  return (
    scopeVersion.certifiedRouteReference?.certifiedRouteId ??
    (scopeVersion.canonicalTruth as any)?.certifiedRouteReference?.certifiedRouteId ??
    (scopeVersion.canonicalTruth?.stationing as any)?.certifiedRouteId ??
    ""
  );
}

function stationById(stations: RouteStation[], stationId?: string) {
  return stations.find((station) => station.stationId === stationId);
}

function sortedStations(scopeVersion: ScopeVersion) {
  return routeStations(scopeVersion).sort((a, b) => Number(a.measureFeet) - Number(b.measureFeet));
}

function stationsInRange(scopeVersion: ScopeVersion, stationStartId?: string, stationEndId?: string) {
  const stations = sortedStations(scopeVersion);
  const start = stationById(stations, stationStartId);
  const end = stationById(stations, stationEndId);
  if (!start || !end) return [];
  const min = Math.min(Number(start.measureFeet), Number(end.measureFeet));
  const max = Math.max(Number(start.measureFeet), Number(end.measureFeet));
  return stations.filter((station) => Number(station.measureFeet) >= min && Number(station.measureFeet) <= max);
}

function stationFootprint(scopeVersion: ScopeVersion, stationId: string) {
  const stations = sortedStations(scopeVersion);
  const index = stations.findIndex((station) => station.stationId === stationId);
  if (index < 0) return 0;
  if (index > 0) return Math.max(0, Number(stations[index].measureFeet) - Number(stations[index - 1].measureFeet));
  if (stations[1]) return Math.max(0, Number(stations[1].measureFeet) - Number(stations[0].measureFeet));
  return Math.max(0, Number(scopeVersion.canonicalTruth?.stationing?.routeFeet ?? scopeVersion.buildFeet ?? 0));
}

function rangeFootprint(scopeVersion: ScopeVersion, stationStartId?: string, stationEndId?: string) {
  const stations = sortedStations(scopeVersion);
  const start = stationById(stations, stationStartId);
  const end = stationById(stations, stationEndId);
  if (!start || !end) return 0;
  return Math.abs(Number(end.measureFeet) - Number(start.measureFeet));
}

function isValidTransition<T extends string>(from: T, to: T, table: Record<T, T[]>) {
  return from !== to && (table[from]?.includes(to) ?? false);
}

function invalid(reason: string): ClosureValidationResult {
  return { valid: false, reason, stationIds: [], objectIds: [], feetAffected: 0 };
}

export function getAllowedStationTransitions(station: RouteStation | RouteStationState): RouteStationState[] {
  const state = typeof station === "string" ? station : station.stationState;
  return STATION_TRANSITIONS[state] ?? [];
}

export function getAllowedObjectTransitions(object: ScopeInfrastructureObject | ScopeObjectState): ScopeObjectState[] {
  const state = typeof object === "string" ? object : object.objectState;
  return OBJECT_TRANSITIONS[state] ?? [];
}

export function validateStationTransition(scopeVersion: ScopeVersion, stationId: string, toState: RouteStationState): ClosureValidationResult {
  const stations = routeStations(scopeVersion);
  const station = stationById(stations, stationId);
  if (!station) return invalid(`Missing station ${stationId}.`);
  if (!isValidTransition(station.stationState, toState, STATION_TRANSITIONS)) {
    return invalid(`Invalid station transition: ${station.stationState} -> ${toState}.`);
  }
  return {
    valid: true,
    stationIds: [station.stationId],
    objectIds: scopeObjects(scopeVersion).filter((object) => object.stationId === station.stationId).map((object) => object.objectId),
    previousStationState: station.stationState,
    feetAffected: ["COMPLETE", "VERIFIED"].includes(toState) ? stationFootprint(scopeVersion, station.stationId) : 0,
  };
}

export function validateStationRangeTransition(scopeVersion: ScopeVersion, stationStartId: string, stationEndId: string, toState: RouteStationState): ClosureValidationResult {
  const stations = stationsInRange(scopeVersion, stationStartId, stationEndId);
  if (!stations.length) return invalid(`Missing station range ${stationStartId} -> ${stationEndId}.`);
  const invalidStation = stations.find((station) => !isValidTransition(station.stationState, toState, STATION_TRANSITIONS));
  if (invalidStation) {
    return invalid(`Invalid station transition in range: ${invalidStation.stationId} ${invalidStation.stationState} -> ${toState}.`);
  }
  const stationIds = stations.map((station) => station.stationId);
  return {
    valid: true,
    stationIds,
    objectIds: scopeObjects(scopeVersion).filter((object) => stationIds.includes(object.stationId)).map((object) => object.objectId),
    previousStationState: stations[0]?.stationState,
    feetAffected: ["COMPLETE", "VERIFIED"].includes(toState) ? rangeFootprint(scopeVersion, stationStartId, stationEndId) : 0,
  };
}

export function validateObjectTransition(scopeVersion: ScopeVersion, objectId: string, toState: ScopeObjectState): ClosureValidationResult {
  const object = scopeObjects(scopeVersion).find((item) => item.objectId === objectId);
  if (!object) return invalid(`Missing object ${objectId}.`);
  if (!isValidTransition(object.objectState, toState, OBJECT_TRANSITIONS)) {
    return invalid(`Invalid object transition: ${object.objectState} -> ${toState}.`);
  }
  return {
    valid: true,
    stationIds: object.stationId ? [object.stationId] : [],
    objectIds: [object.objectId],
    previousObjectStates: { [object.objectId]: object.objectState },
    feetAffected: 0,
  };
}

function duplicateSameStateClosure(scopeVersion: ScopeVersion, args: CreateClosureRecordArgs, validation: ClosureValidationResult) {
  const closures = closureRecords(scopeVersion);
  return closures.some((closure) => {
    if (closure.closureType !== args.closureType) return false;
    if (args.newStationState && closure.newStationState !== args.newStationState) return false;
    if (args.newObjectState && closure.newObjectState !== args.newObjectState) return false;
    const stationsMatch =
      validation.stationIds.length === 0 ||
      validation.stationIds.every((stationId) => closure.stationId === stationId || closure.stationStartId === args.stationStartId || closure.stationEndId === args.stationEndId);
    const objectsMatch =
      validation.objectIds.length === 0 ||
      validation.objectIds.every((objectId) => closure.objectIds.includes(objectId));
    return stationsMatch && objectsMatch;
  });
}

function validateCreateArgs(args: CreateClosureRecordArgs): ClosureValidationResult {
  if (!args.authority) return invalid("Closure authority is required.");
  if (!args.actorId || !args.actorName) return invalid("Closure actor is required.");
  if (!certifiedRouteIdFor(args.scopeVersion)) return invalid("CertifiedRoute reference is required before closure.");

  if (args.closureType === "STATION_STATE_TRANSITION") {
    if (!args.stationId || !args.newStationState) return invalid("Station transition requires stationId and newStationState.");
    return validateStationTransition(args.scopeVersion, args.stationId, args.newStationState);
  }
  if (args.closureType === "STATION_RANGE_TRANSITION") {
    if (!args.stationStartId || !args.stationEndId || !args.newStationState) return invalid("Station range transition requires stationStartId, stationEndId, and newStationState.");
    return validateStationRangeTransition(args.scopeVersion, args.stationStartId, args.stationEndId, args.newStationState);
  }
  if (args.closureType === "OBJECT_STATE_TRANSITION") {
    const objectId = args.objectId ?? args.objectIds?.[0];
    if (!objectId || !args.newObjectState) return invalid("Object transition requires objectId and newObjectState.");
    return validateObjectTransition(args.scopeVersion, objectId, args.newObjectState);
  }
  if (args.closureType === "OBJECT_RANGE_TRANSITION") {
    const objectIds = args.objectIds ?? [];
    if (!objectIds.length || !args.newObjectState) return invalid("Object range transition requires objectIds and newObjectState.");
    const validations = objectIds.map((objectId) => validateObjectTransition(args.scopeVersion, objectId, args.newObjectState as ScopeObjectState));
    const failed = validations.find((result) => !result.valid);
    if (failed) return failed;
    return {
      valid: true,
      stationIds: Array.from(new Set(validations.flatMap((result) => result.stationIds))),
      objectIds,
      previousObjectStates: Object.assign({}, ...validations.map((result) => result.previousObjectStates ?? {})),
      feetAffected: 0,
    };
  }
  return invalid("Unsupported closure type.");
}

export function createClosureRecord(args: CreateClosureRecordArgs): ClosureRecord {
  const validation = validateCreateArgs(args);
  if (!validation.valid) throw new Error(validation.reason ?? "Invalid closure record.");
  if (duplicateSameStateClosure(args.scopeVersion, args, validation)) {
    throw new Error("Duplicate same-state closure rejected.");
  }
  const timestamp = nowIso();
  return {
    closureId: createId("closure"),
    scopeVersionId: args.scopeVersion.scopeVersionId,
    workItemId: args.workItemId,
    certifiedRouteId: certifiedRouteIdFor(args.scopeVersion),
    stationId: args.stationId,
    stationStartId: args.stationStartId,
    stationEndId: args.stationEndId,
    objectIds: validation.objectIds,
    closureType: args.closureType,
    previousStationState: validation.previousStationState,
    newStationState: args.newStationState,
    previousObjectStates: validation.previousObjectStates,
    newObjectState: args.newObjectState,
    actorId: args.actorId,
    actorName: args.actorName,
    authority: args.authority,
    evidenceIds: args.evidenceIds ?? [],
    notes: args.notes,
    feetAffected: validation.feetAffected,
    persistenceStatus: "PERSISTENCE_PENDING",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function applyClosureToScopeVersion(scopeVersion: ScopeVersion, closureRecord: ClosureRecord): ScopeVersion {
  if (closureRecord.scopeVersionId !== scopeVersion.scopeVersionId) {
    throw new Error("Closure scopeVersionId does not match target ScopeVersion.");
  }
  const timestamp = nowIso();
  const affectedStationIds =
    closureRecord.closureType === "STATION_RANGE_TRANSITION"
      ? stationsInRange(scopeVersion, closureRecord.stationStartId, closureRecord.stationEndId).map((station) => station.stationId)
      : closureRecord.stationId
        ? [closureRecord.stationId]
        : [];
  const affectedObjectIds = new Set(closureRecord.objectIds);
  const nextStations = routeStations(scopeVersion).map((station) =>
    closureRecord.newStationState && affectedStationIds.includes(station.stationId)
      ? { ...station, stationState: closureRecord.newStationState as RouteStationState, updatedAt: timestamp }
      : station
  );
  const nextObjects = scopeObjects(scopeVersion).map((object) =>
    closureRecord.newObjectState && affectedObjectIds.has(object.objectId)
      ? { ...object, objectState: closureRecord.newObjectState as ScopeObjectState, updatedAt: timestamp }
      : object
  );
  const closures = [...closureRecords(scopeVersion), { ...closureRecord, updatedAt: timestamp }];
  const nextScope: ScopeVersion = {
    ...scopeVersion,
    closures,
    updatedAt: timestamp,
    canonicalTruth: {
      ...scopeVersion.canonicalTruth,
      stations: nextStations,
      objects: nextObjects,
      closures,
    },
  };
  const progress = calculateScopeVersionProgress(nextScope);
  const lifecycleState = deriveScopeVersionLifecycleState(nextScope);
  const updated = transitionScopeVersionLifecycle({
    ...nextScope,
    canonicalTruth: {
      ...nextScope.canonicalTruth,
      progress,
    },
  }, lifecycleState, timestamp);
  console.log("[CLOSURE_AUTHORITY]", {
    closureId: closureRecord.closureId,
    scopeVersionId: scopeVersion.scopeVersionId,
    closureType: closureRecord.closureType,
    stationIds: affectedStationIds,
    objectIds: closureRecord.objectIds,
    lifecycleState,
  });
  return updated;
}

export function calculateScopeVersionProgress(scopeVersion: ScopeVersion) {
  const stations = sortedStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const closures = closureRecords(scopeVersion);
  const stationStateCounts = stations.reduce<Record<string, number>>((counts, station) => {
    counts[station.stationState] = (counts[station.stationState] ?? 0) + 1;
    return counts;
  }, {});
  const objectStateCounts = objects.reduce<Record<string, number>>((counts, object) => {
    counts[object.objectState] = (counts[object.objectState] ?? 0) + 1;
    return counts;
  }, {});
  const totalFeet = Number(scopeVersion.canonicalTruth?.stationing?.routeFeet ?? scopeVersion.certifiedRouteReference?.routeFeet ?? scopeVersion.buildFeet ?? stations.at(-1)?.measureFeet ?? 0);
  const completeStations = stations.filter((station) => station.stationState === "COMPLETE" || station.stationState === "VERIFIED");
  const verifiedStations = stations.filter((station) => station.stationState === "VERIFIED");
  let completedFeet = completeStations.reduce((sum, station) => {
    const index = stations.findIndex((item) => item.stationId === station.stationId);
    if (index <= 0) return sum;
    return sum + Math.max(0, Number(stations[index].measureFeet) - Number(stations[index - 1].measureFeet));
  }, 0);
  if (completeStations.length === 1 && stations[0]?.stationId === completeStations[0].stationId && stations[1]) {
    completedFeet = Math.max(0, Number(stations[1].measureFeet) - Number(stations[0].measureFeet));
  }
  const percentComplete = totalFeet > 0 ? Math.min(100, (completedFeet / totalFeet) * 100) : stations.length ? (completeStations.length / stations.length) * 100 : 0;
  const lastClosure = closures.at(-1);
  const result = {
    scopeVersionId: scopeVersion.scopeVersionId,
    totalStations: stations.length,
    totalObjects: objects.length,
    totalFeet,
    releasedStations: stationStateCounts.RELEASED ?? 0,
    inProgressStations: stationStateCounts.IN_PROGRESS ?? 0,
    completeStations: completeStations.length,
    verifiedStations: verifiedStations.length,
    completedFeet,
    remainingFeet: Math.max(0, totalFeet - completedFeet),
    percentComplete,
    closureCount: closures.length,
    latestClosureTimestamp: lastClosure?.updatedAt ?? lastClosure?.createdAt,
    lastClosureId: lastClosure?.closureId,
    openClosures: closures.filter((closure) => closure.newStationState !== "COMPLETE" && closure.newStationState !== "VERIFIED" && closure.newObjectState !== "COMPLETE" && closure.newObjectState !== "VERIFIED").length,
    stationStateCounts,
    objectStateCounts,
    closureAuthorityStatus: stations.length && objects.length ? "PASS" : "FAIL",
  };
  console.log("[SCOPEVERSION_PROGRESS]", result);
  return result;
}

export function deriveScopeVersionLifecycleState(scopeVersion: ScopeVersion): ScopeVersionLifecycleState {
  const stations = routeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const stationStates = stations.map((station) => station.stationState);
  const objectStates = objects.map((object) => object.objectState);
  if (scopeVersion.status === "REJECTED" || stationStates.includes("REJECTED") || objectStates.includes("REJECTED")) return "REJECTED";
  if (scopeVersion.status === "BLOCKED" || stationStates.includes("BLOCKED") || objectStates.includes("BLOCKED")) return "BLOCKED";
  if (stations.length && stationStates.every((state) => state === "VERIFIED")) return "VERIFIED";
  if (stations.length && stationStates.every((state) => state === "COMPLETE" || state === "VERIFIED")) return "COMPLETE";
  if (stationStates.some((state) => state === "COMPLETE" || state === "VERIFIED")) return "PARTIALLY_COMPLETE";
  if (stationStates.includes("IN_PROGRESS") || objectStates.some((state) => ["INSTALLED", "TESTED", "ACCEPTED"].includes(state))) return "FIELD";
  if (closureRecords(scopeVersion).length) return "FIELD";
  if (scopeVersion.status === "CONTROL_ACTIVE" || stationStates.includes("RELEASED")) return "CONTROL_ACTIVE";
  if (scopeVersion.status === "CONTROL") return "CONTROL";
  if (scopeVersion.status === "FIELD" || scopeVersion.status === "FIELD_ACTIVE") return "FIELD";
  if (scopeVersion.status === "QUOTED") return "QUOTED";
  if (scopeVersion.status === "APPROVED" || scopeVersion.status === "ACTIVATED") return "APPROVED";
  if (scopeVersion.certifiedRouteReference?.routeAuthorityState === "PROVISIONALLY_CERTIFIED") return "PROVISIONALLY_CERTIFIED";
  return "ANALYZED";
}
