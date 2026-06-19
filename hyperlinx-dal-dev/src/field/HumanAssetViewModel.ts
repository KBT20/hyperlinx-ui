import type { DALCoordinate, RouteStation, ScopeInfrastructureObject, ScopeObjectState, ScopeVersion } from "../types/dal";
import { getAllowedStationTransitions } from "../scopeversion/ClosureAuthorityEngine";

export type HumanAsset = {
  assetId: string;
  assetName: string;
  assetType: string;
  scopeVersionId: string;
  routeId: string;
  stationId: string;
  measure: number;
  stationLabel: string;
  latitude: number;
  longitude: number;
  coordinate: DALCoordinate;
  nearestRoad: string;
  nearestAddress: string;
  nearestCity: string;
  nearestParcel: string;
  currentState: RouteStation["stationState"];
  objectState?: ScopeObjectState;
  allowedTransitions: RouteStation["stationState"][];
  objectIds: string[];
  diagnostics: {
    stationId: string;
    routeStationId: string;
    objectIds: string[];
    scopeVersionId: string;
    routeId: string;
  };
};

function asStations(scopeVersion: ScopeVersion): RouteStation[] {
  return Array.isArray(scopeVersion.canonicalTruth?.stations)
    ? (scopeVersion.canonicalTruth.stations as unknown[]).filter((station): station is RouteStation => {
        const candidate = station as RouteStation;
        return Boolean(candidate?.stationId && candidate?.coordinate && typeof candidate.stationState === "string");
      })
    : [];
}

function asObjects(scopeVersion: ScopeVersion): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion.canonicalTruth?.objects)
    ? (scopeVersion.canonicalTruth.objects as unknown[]).filter((object): object is ScopeInfrastructureObject => {
        const candidate = object as ScopeInfrastructureObject;
        return Boolean(candidate?.objectId && candidate?.stationId && candidate?.objectType);
      })
    : [];
}

function siteName(scopeVersion: ScopeVersion) {
  const truth = scopeVersion.canonicalTruth as any;
  const site = truth?.sourceCandidate ?? truth?.site ?? truth?.candidateSite ?? scopeVersion.candidateSite;
  return String(site?.name ?? site?.companyName ?? "FiberLight Site");
}

function siteAddress(scopeVersion: ScopeVersion) {
  const truth = scopeVersion.canonicalTruth as any;
  const site = truth?.sourceCandidate ?? truth?.site ?? truth?.candidateSite ?? scopeVersion.candidateSite;
  return {
    address: String(site?.address ?? site?.streetAddress ?? "Address not assigned"),
    city: String(site?.city ?? site?.nearestCity ?? ""),
  };
}

function nearestRoad(scopeVersion: ScopeVersion) {
  const constructability = ((scopeVersion.canonicalTruth as any)?.constructabilityAssessment ?? scopeVersion.constructability) as any;
  return String(constructability?.road?.nearestRoad?.name ?? constructability?.nearestRoad?.name ?? "Road not assigned");
}

function nearestParcel(scopeVersion: ScopeVersion) {
  const constructability = ((scopeVersion.canonicalTruth as any)?.constructabilityAssessment ?? scopeVersion.constructability) as any;
  return String(constructability?.parcel?.parcel?.parcelId ?? constructability?.parcelId ?? "Parcel not assigned");
}

function friendlyType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function assetNameFor(scopeVersion: ScopeVersion, station: RouteStation, objects: ScopeInfrastructureObject[]) {
  const primary = objects[0];
  const name = siteName(scopeVersion);
  if (primary?.label && !primary.label.startsWith(primary.objectType)) return primary.label;
  if (primary?.objectType === "NETWORK_ATTACHMENT") return `${name} Network Attachment`;
  if (primary?.objectType === "BUILDING_ENTRANCE") return `${name} Building Entrance`;
  if (primary?.objectType === "SERVICE_LOCATION") return `${name} Service Location`;
  if (primary?.objectType === "HANDHOLE") return `Handhole ${station.stationLabel}`;
  if (primary?.objectType === "VAULT") return `Vault ${station.stationLabel}`;
  if (Math.round(Number(station.measureFeet)) === 0) return `${name} Network Attachment`;
  return `Lateral Segment ${station.stationLabel}`;
}

export function buildHumanAssets(scopeVersion: ScopeVersion | null | undefined): HumanAsset[] {
  if (!scopeVersion) return [];
  const stations = asStations(scopeVersion).sort((a, b) => Number(a.measureFeet) - Number(b.measureFeet));
  const objects = asObjects(scopeVersion);
  const address = siteAddress(scopeVersion);
  const road = nearestRoad(scopeVersion);
  const parcel = nearestParcel(scopeVersion);
  return stations.map((station) => {
    const stationObjects = objects.filter((object) => object.stationId === station.stationId);
    const primary = stationObjects[0];
    const assetType = primary?.objectType ?? "LATERAL_SEGMENT";
    return {
      assetId: primary?.objectId ?? station.stationId,
      assetName: assetNameFor(scopeVersion, station, stationObjects),
      assetType,
      scopeVersionId: scopeVersion.scopeVersionId,
      routeId: station.routeId,
      stationId: station.stationId,
      measure: Number(station.measureFeet),
      stationLabel: station.stationLabel,
      latitude: Number(station.coordinate[1]),
      longitude: Number(station.coordinate[0]),
      coordinate: station.coordinate,
      nearestRoad: primary?.sourceRouteId ? road : road,
      nearestAddress: address.address,
      nearestCity: address.city,
      nearestParcel: parcel,
      currentState: station.stationState,
      objectState: primary?.objectState,
      allowedTransitions: getAllowedStationTransitions(station),
      objectIds: stationObjects.map((object) => object.objectId),
      diagnostics: {
        stationId: station.stationId,
        routeStationId: station.stationId,
        objectIds: stationObjects.map((object) => object.objectId),
        scopeVersionId: scopeVersion.scopeVersionId,
        routeId: station.routeId,
      },
    };
  });
}

