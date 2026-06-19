import { getAllowedObjectTransitions, getAllowedStationTransitions } from "../scopeversion/ClosureAuthorityEngine";
import type {
  ClosureRecord,
  FieldObjectWorkContext,
  FieldStationWorkContext,
  RouteStation,
  RouteStationState,
  ScopeInfrastructureObject,
  ScopeInfrastructureObjectType,
  ScopeObjectState,
  ScopeVersion,
} from "../types/dal";

const HUMAN_OBJECT_NAMES: Record<ScopeInfrastructureObjectType, string> = {
  NETWORK_ATTACHMENT: "Network Attachment",
  HANDHOLE: "Handhole",
  VAULT: "Vault",
  DUCT: "Duct",
  FIBER: "Fiber",
  BUILDING_ENTRANCE: "Building Entrance",
  SERVICE_LOCATION: "Service Location",
  SPLICE: "Splice",
  ATTACHMENT_POINT: "Attachment Point",
  ROAD_CROSSING: "Road Crossing",
  WATERWAY: "Water Crossing",
  RAILROAD: "Rail Crossing",
  PARCEL: "Parcel Constraint",
  BUILDING: "Building Constraint",
  TERRAIN_ZONE: "Terrain Constraint",
  UTILITY_CONFLICT: "Utility Conflict",
  PERMIT_AUTHORITY: "Permit Authority",
};

const OPEN_OBJECT_STATES = new Set<ScopeObjectState>(["PLANNED", "RELEASED", "INSTALLED", "TESTED", "ACCEPTED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isRouteStation(value: unknown): value is RouteStation {
  return (
    isRecord(value) &&
    typeof value.stationId === "string" &&
    typeof value.routeId === "string" &&
    Array.isArray(value.coordinate) &&
    typeof value.stationState === "string"
  );
}

function isScopeObject(value: unknown): value is ScopeInfrastructureObject {
  return isRecord(value) && typeof value.objectId === "string" && typeof value.stationId === "string" && typeof value.objectType === "string";
}

function stations(scopeVersion: ScopeVersion): RouteStation[] {
  return Array.isArray(scopeVersion.canonicalTruth?.stations)
    ? (scopeVersion.canonicalTruth.stations as unknown[]).filter(isRouteStation).sort((a, b) => Number(a.measureFeet) - Number(b.measureFeet))
    : [];
}

function objects(scopeVersion: ScopeVersion): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion.canonicalTruth?.objects) ? (scopeVersion.canonicalTruth.objects as unknown[]).filter(isScopeObject) : [];
}

function closures(scopeVersion: ScopeVersion): ClosureRecord[] {
  const byId = new Map<string, ClosureRecord>();
  [...(scopeVersion.canonicalTruth?.closures ?? []), ...(scopeVersion.closures ?? [])].forEach((closure) => byId.set(closure.closureId, closure));
  return Array.from(byId.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function siteValue(scopeVersion: ScopeVersion, key: string, fallback = "Not assigned") {
  const truth = scopeVersion.canonicalTruth as any;
  const site = truth?.sourceCandidate ?? truth?.site ?? truth?.candidateSite ?? scopeVersion.candidateSite;
  return String(site?.[key] ?? fallback);
}

function nearestRoad(scopeVersion: ScopeVersion) {
  const constructability = ((scopeVersion.canonicalTruth as any)?.constructabilityAssessment ?? scopeVersion.constructability) as any;
  return String(constructability?.road?.nearestRoad?.name ?? constructability?.nearestRoad?.name ?? "Road not assigned");
}

function nearestParcel(scopeVersion: ScopeVersion) {
  const constructability = ((scopeVersion.canonicalTruth as any)?.constructabilityAssessment ?? scopeVersion.constructability) as any;
  return String(constructability?.parcel?.parcel?.parcelId ?? constructability?.parcelId ?? "Parcel not assigned");
}

export function objectHumanName(objectType: ScopeInfrastructureObjectType) {
  return HUMAN_OBJECT_NAMES[objectType] ?? objectType.replaceAll("_", " ");
}

function requiredWorkFor(object: ScopeInfrastructureObject) {
  switch (object.objectType) {
    case "NETWORK_ATTACHMENT":
      return "Establish and verify the lateral connection to the existing inventory reference.";
    case "DUCT":
      return "Place buried conduit along the certified lateral path.";
    case "FIBER":
      return "Place or pull fiber through the installed duct pathway.";
    case "BUILDING_ENTRANCE":
      return "Build and verify the entrance pathway into the customer premise.";
    case "SERVICE_LOCATION":
      return "Prepare the service location for activation and handoff.";
    case "HANDHOLE":
      return "Install or verify the planned handhole.";
    case "VAULT":
      return "Install or verify the planned vault.";
    case "SPLICE":
      return "Complete splice work and record acceptance evidence.";
    case "ROAD_CROSSING":
      return "Clear and verify the road crossing constraint.";
    case "WATERWAY":
      return "Clear and verify the water crossing constraint.";
    case "RAILROAD":
      return "Clear and verify the rail crossing constraint.";
    case "PERMIT_AUTHORITY":
      return "Confirm permit authority requirements and evidence.";
    default:
      return object.objectCategory === "CONSTRAINT" ? "Review and clear the construction constraint." : "Perform required field work for this object.";
  }
}

function dependenciesFor(object: ScopeInfrastructureObject, stationObjects: ScopeInfrastructureObject[]) {
  const has = (type: ScopeInfrastructureObjectType) => stationObjects.find((candidate) => candidate.objectType === type)?.objectId;
  if (object.objectType === "FIBER") return [has("DUCT")].filter(Boolean) as string[];
  if (object.objectType === "SPLICE") return [has("FIBER")].filter(Boolean) as string[];
  if (object.objectType === "SERVICE_LOCATION") return [has("BUILDING_ENTRANCE")].filter(Boolean) as string[];
  return [];
}

function objectClosures(objectId: string, allClosures: ClosureRecord[]) {
  return allClosures.filter((closure) => Array.isArray(closure.objectIds) && closure.objectIds.includes(objectId));
}

function isClosableObject(object: FieldObjectWorkContext) {
  return object.objectCategory === "INFRASTRUCTURE";
}

export function deriveStationStateFromObjects(objectsAtStation: FieldObjectWorkContext[], fallbackState: RouteStationState): RouteStationState {
  const closable = objectsAtStation.filter(isClosableObject);
  const stateObjects = closable.length ? closable : objectsAtStation;
  if (!stateObjects.length) return fallbackState;
  const states = stateObjects.map((object) => object.objectState);
  if (states.includes("BLOCKED")) return "BLOCKED";
  if (states.every((state) => state === "VERIFIED")) return "VERIFIED";
  if (states.every((state) => state === "COMPLETE" || state === "VERIFIED")) return "COMPLETE";
  if (states.some((state) => state === "INSTALLED" || state === "TESTED" || state === "ACCEPTED")) return "IN_PROGRESS";
  if (states.some((state) => state === "RELEASED")) return "RELEASED";
  return "PLANNED";
}

function objectContextFor(
  scopeVersion: ScopeVersion,
  object: ScopeInfrastructureObject,
  stationObjects: ScopeInfrastructureObject[],
  allClosures: ClosureRecord[]
): FieldObjectWorkContext {
  const closureHistory = objectClosures(object.objectId, allClosures);
  return {
    objectId: object.objectId,
    stationId: object.stationId,
    objectType: object.objectType,
    objectCategory: object.objectCategory,
    objectLabel: object.label,
    humanName: objectHumanName(object.objectType),
    objectState: object.objectState,
    measureFeet: Number(object.measureFeet),
    coordinate: object.coordinate,
    requiredWork: requiredWorkFor(object),
    dependencies: dependenciesFor(object, stationObjects),
    allowedTransitions: getAllowedObjectTransitions(object),
    isClosable: object.objectCategory === "INFRASTRUCTURE" && !["COMPLETE", "VERIFIED", "REJECTED"].includes(object.objectState),
    isBlocked: object.objectState === "BLOCKED",
    closureHistory,
    sourceObject: object,
  };
}

export function buildFieldExecutionViewModel(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) {
    return {
      scopeVersionId: "",
      certifiedRouteId: "",
      stations: [] as FieldStationWorkContext[],
      objectStateCounts: {} as Record<string, number>,
      stationDerivedStateCounts: {} as Record<string, number>,
      closureCount: 0,
    };
  }
  const routeStations = stations(scopeVersion);
  const scopeObjects = objects(scopeVersion);
  const closureRecords = closures(scopeVersion);
  const certifiedRouteId =
    scopeVersion.certifiedRouteReference?.certifiedRouteId ??
    (scopeVersion.canonicalTruth as any)?.certifiedRouteReference?.certifiedRouteId ??
    scopeVersion.canonicalTruth?.stationing?.certifiedRouteId ??
    "";
  const nearestAddress = siteValue(scopeVersion, "address", siteValue(scopeVersion, "streetAddress", "Address not assigned"));
  const routeRoad = nearestRoad(scopeVersion);
  const parcel = nearestParcel(scopeVersion);
  const stationContexts = routeStations.map<FieldStationWorkContext>((station) => {
    const stationObjects = scopeObjects.filter((object) => object.stationId === station.stationId);
    const objectContexts = stationObjects.map((object) => objectContextFor(scopeVersion, object, stationObjects, closureRecords));
    const stationDerivedState = deriveStationStateFromObjects(objectContexts, station.stationState);
    const openObjectsAtStation = objectContexts.filter((object) => OPEN_OBJECT_STATES.has(object.objectState));
    const context = {
      scopeVersionId: scopeVersion.scopeVersionId,
      certifiedRouteId,
      routeId: station.routeId,
      stationId: station.stationId,
      stationLabel: station.stationLabel,
      measureFeet: Number(station.measureFeet),
      coordinate: station.coordinate,
      nearestRoad: routeRoad,
      nearestAddress,
      nearestParcel: parcel,
      stationState: station.stationState,
      stationDerivedState,
      objectsAtStation: objectContexts,
      openObjectsAtStation,
      completeObjectsAtStation: objectContexts.filter((object) => object.objectState === "COMPLETE"),
      verifiedObjectsAtStation: objectContexts.filter((object) => object.objectState === "VERIFIED"),
      blockedObjectsAtStation: objectContexts.filter((object) => object.objectState === "BLOCKED"),
      allowedStationTransitions: getAllowedStationTransitions(station),
      nextRecommendedObjectId: openObjectsAtStation[0]?.objectId,
      sourceStation: station,
    };
    console.log("[STATION_DERIVED_STATE]", {
      stationId: station.stationId,
      stationState: station.stationState,
      stationDerivedState,
      objectStates: objectContexts.map((object) => `${object.objectType}:${object.objectState}`),
    });
    return context;
  });
  const objectStateCounts = scopeObjects.reduce<Record<string, number>>((counts, object) => {
    counts[object.objectState] = (counts[object.objectState] ?? 0) + 1;
    return counts;
  }, {});
  const stationDerivedStateCounts = stationContexts.reduce<Record<string, number>>((counts, station) => {
    counts[station.stationDerivedState] = (counts[station.stationDerivedState] ?? 0) + 1;
    return counts;
  }, {});
  const result = {
    scopeVersionId: scopeVersion.scopeVersionId,
    certifiedRouteId,
    stations: stationContexts,
    objectStateCounts,
    stationDerivedStateCounts,
    closureCount: closureRecords.length,
  };
  console.log("[FIELD_OBJECT_CONTEXT]", {
    scopeVersionId: scopeVersion.scopeVersionId,
    stations: stationContexts.length,
    objects: scopeObjects.length,
    closureCount: closureRecords.length,
  });
  console.log("[OBJECT_PROGRESS]", {
    scopeVersionId: scopeVersion.scopeVersionId,
    objectStateCounts,
    stationDerivedStateCounts,
  });
  return result;
}
