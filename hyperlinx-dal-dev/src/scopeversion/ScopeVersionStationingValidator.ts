import type { RouteStation, ScopeInfrastructureObject, ScopeVersion, ScopeVersionCertifiedRouteReference } from "../types/dal";

export type ScopeVersionStationingValidationIssue = {
  field: string;
  message: string;
};

export type ScopeVersionStationingValidationResult = {
  valid: boolean;
  errors: ScopeVersionStationingValidationIssue[];
  warnings: ScopeVersionStationingValidationIssue[];
  diagnostics: {
    stationIntervalFeet?: number;
    routeFeet: number;
    stationCount: number;
    finalStationMeasureFeet: number;
    certifiedRouteId?: string;
    geometryHash?: string;
    objectCount: number;
    objectTypes: string[];
    objectsMissingStation: string[];
    stationsWithoutCoordinate: string[];
    objectsWithoutCoordinate: string[];
  };
};

function issue(field: string, message: string): ScopeVersionStationingValidationIssue {
  return { field, message };
}

function asStations(value: unknown): RouteStation[] {
  return Array.isArray(value) ? (value as RouteStation[]) : [];
}

function asObjects(value: unknown): ScopeInfrastructureObject[] {
  return Array.isArray(value) ? (value as ScopeInfrastructureObject[]) : [];
}

function coordinateValid(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

export function validateScopeVersionStationing(scopeVersion: ScopeVersion): ScopeVersionStationingValidationResult {
  const truth = scopeVersion.canonicalTruth ?? {};
  const stationing = truth.stationing;
  const certifiedRouteReference = (scopeVersion.certifiedRouteReference ?? truth.certifiedRouteReference) as ScopeVersionCertifiedRouteReference | undefined;
  const stations = asStations(truth.stations);
  const objects = asObjects(truth.objects);
  const routeFeet = Number(stationing?.routeFeet ?? certifiedRouteReference?.routeFeet ?? truth.engineeringBasis?.buildFeet ?? scopeVersion.buildFeet ?? 0);
  const finalStation = stations[stations.length - 1];
  const firstStation = stations[0];
  const stationIds = new Set(stations.map((station) => station.stationId));
  const objectsMissingStation = objects.filter((object) => !object.stationId || !stationIds.has(object.stationId)).map((object) => object.objectId ?? "unknown-object");
  const stationsWithoutCoordinate = stations.filter((station) => !coordinateValid(station.coordinate)).map((station) => station.stationId ?? "unknown-station");
  const objectsWithoutCoordinate = objects.filter((object) => !coordinateValid(object.coordinate)).map((object) => object.objectId ?? "unknown-object");
  const errors: ScopeVersionStationingValidationIssue[] = [];
  const warnings: ScopeVersionStationingValidationIssue[] = [];
  const toleranceFeet = Math.max(2, Math.round(routeFeet * 0.005));

  if (!stationing) errors.push(issue("stationing", "ScopeVersion stationing is required for authoritative lateral ScopeVersions."));
  if (stations.length < 2) errors.push(issue("stations", "At least two route stations are required."));
  if (!firstStation) errors.push(issue("stations.first", "First station is required."));
  if (!finalStation) errors.push(issue("stations.final", "Final station is required."));
  if (firstStation && Math.round(Number(firstStation.measureFeet)) !== 0) {
    errors.push(issue("stations.first.measureFeet", "First station must be measureFeet 0."));
  }
  if (finalStation && Math.abs(Number(finalStation.measureFeet) - routeFeet) > toleranceFeet) {
    errors.push(issue("stations.final.measureFeet", "Final station measure must match routeFeet within tolerance."));
  }
  stations.forEach((station) => {
    if (station.scopeVersionId !== scopeVersion.scopeVersionId) errors.push(issue(`stations.${station.stationId}.scopeVersionId`, "Every station must reference the owning ScopeVersion."));
    if (!station.certifiedRouteId || station.certifiedRouteId !== certifiedRouteReference?.certifiedRouteId) {
      errors.push(issue(`stations.${station.stationId}.certifiedRouteId`, "Every station must reference the CertifiedRoute."));
    }
  });
  if (!objects.length) errors.push(issue("objects", "ScopeVersion infrastructure objects are required."));
  objects.forEach((object) => {
    if (!object.stationId) errors.push(issue(`objects.${object.objectId}.stationId`, "Object stationId is required."));
    if (object.stationId && !stationIds.has(object.stationId)) errors.push(issue(`objects.${object.objectId}.stationId`, "Object stationId must reference a valid station."));
    if (!object.objectCategory) errors.push(issue(`objects.${object.objectId}.objectCategory`, "Object category is required."));
    if (!object.objectType) errors.push(issue(`objects.${object.objectId}.objectType`, "Object type is required."));
  });
  if (stationsWithoutCoordinate.length) warnings.push(issue("stations.coordinate", "Some stations are missing coordinates."));
  if (objectsWithoutCoordinate.length) warnings.push(issue("objects.coordinate", "Some objects are missing coordinates."));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    diagnostics: {
      stationIntervalFeet: stationing?.stationIntervalFeet,
      routeFeet,
      stationCount: stations.length,
      finalStationMeasureFeet: Number(finalStation?.measureFeet ?? 0),
      certifiedRouteId: certifiedRouteReference?.certifiedRouteId,
      geometryHash: certifiedRouteReference?.geometryHash,
      objectCount: objects.length,
      objectTypes: Array.from(new Set(objects.map((object) => object.objectType).filter(Boolean))),
      objectsMissingStation,
      stationsWithoutCoordinate,
      objectsWithoutCoordinate,
    },
  };
}

export function summarizeScopeVersionStationingDiagnostics(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) return null;
  return validateScopeVersionStationing(scopeVersion).diagnostics;
}
