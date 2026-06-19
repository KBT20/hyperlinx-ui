import type { RouteStation, ScopeInfrastructureObject, ScopeVersion } from "../types/dal";
import { getAllowedTransitions } from "./StationStateEngine";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isCoordinate(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function isConstitutionalRouteStation(value: unknown): value is RouteStation {
  if (!isRecord(value)) return false;
  return (
    typeof value.stationId === "string" &&
    typeof value.scopeVersionId === "string" &&
    typeof value.certifiedRouteId === "string" &&
    typeof value.routeId === "string" &&
    Number.isFinite(Number(value.measureFeet)) &&
    typeof value.stationLabel === "string" &&
    typeof value.stationState === "string" &&
    isCoordinate(value.coordinate)
  );
}

function isConstitutionalScopeObject(value: unknown): value is ScopeInfrastructureObject {
  if (!isRecord(value)) return false;
  return (
    typeof value.objectId === "string" &&
    typeof value.scopeVersionId === "string" &&
    typeof value.stationId === "string" &&
    typeof value.objectCategory === "string" &&
    typeof value.objectType === "string" &&
    typeof value.objectState === "string" &&
    isCoordinate(value.coordinate)
  );
}

function asStations(value: unknown): RouteStation[] {
  return Array.isArray(value) ? value.filter(isConstitutionalRouteStation) : [];
}

function asObjects(value: unknown): ScopeInfrastructureObject[] {
  return Array.isArray(value) ? value.filter(isConstitutionalScopeObject) : [];
}

export function buildScopeVersionFieldViewModel(scopeVersion: ScopeVersion) {
  const stations = asStations(scopeVersion.canonicalTruth.stations);
  const objects = asObjects(scopeVersion.canonicalTruth.objects);
  const certifiedRoute = scopeVersion.certifiedRouteReference ?? scopeVersion.canonicalTruth.certifiedRouteReference;
  console.log(
    "FIELD STATIONS",
    stations.length,
    stations.map((station) => station.stationId)
  );
  console.log(
    "FIELD OBJECTS",
    objects.length,
    objects.map((object) => object.objectType)
  );
  const objectsByStation = stations.map((station) => {
    const stationObjects = objects.filter((object) => object.stationId === station.stationId);
    return {
      station,
      allowedTransitions: getAllowedTransitions(station.stationState),
      infrastructureObjects: stationObjects.filter((object) => object.objectCategory === "INFRASTRUCTURE"),
      constraintObjects: stationObjects.filter((object) => object.objectCategory === "CONSTRAINT"),
    };
  });

  return {
    scopeVersionId: scopeVersion.scopeVersionId,
    certifiedRoute,
    stations,
    objects,
    stationStates: stations.map((station) => ({
      stationId: station.stationId,
      stationLabel: station.stationLabel,
      stationState: station.stationState,
      allowedTransitions: getAllowedTransitions(station.stationState),
    })),
    objectsByStation,
  };
}
