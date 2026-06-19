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
    hasOriginStation: boolean;
    hasNetworkAttachment: boolean;
    hasFinalBuildingEntrance: boolean;
    hasFinalServiceLocation: boolean;
    existingReferenceRouteId?: string;
    existingReferenceStationId?: string;
    existingReferenceNodeId?: string;
    existingReferenceEdgeId?: string;
    lateralOriginStationId?: string;
    lateralOriginCoordinate?: RouteStation["coordinate"];
    attachmentReferenceResolved: boolean;
    attachmentReferenceType: "STATION" | "NODE" | "EDGE" | "ROUTE_POINT" | "UNKNOWN";
    existingInventoryReferencePreserved: boolean;
    attachmentReferenceFallbackReason?: string;
    plannedHandholeRequired: boolean;
    productionStationsValid: boolean;
    closureReady: boolean;
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

function isProductionRouteStation(station: RouteStation, scopeVersionId: string, certifiedRouteId?: string) {
  return (
    station.scopeVersionId === scopeVersionId &&
    Boolean(station.certifiedRouteId) &&
    (!certifiedRouteId || station.certifiedRouteId === certifiedRouteId) &&
    Number.isFinite(Number(station.measureFeet)) &&
    Boolean(station.stationLabel)
  );
}

function referenceTypeFor(object: ScopeInfrastructureObject | undefined): "STATION" | "NODE" | "EDGE" | "ROUTE_POINT" | "UNKNOWN" {
  if (object?.attachmentReferenceType) return object.attachmentReferenceType;
  if (object?.sourceStationId) return "STATION";
  if (object?.sourceNodeId) return "NODE";
  if (object?.sourceEdgeId) return "EDGE";
  if (object?.sourceRouteId) return "ROUTE_POINT";
  return "UNKNOWN";
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
  const originStation = stations.find((station) => station.stationId === "STA-0000" || Math.round(Number(station.measureFeet)) === 0);
  const finalStationId = finalStation?.stationId;
  const originObjects = objects.filter((object) => object.stationId === originStation?.stationId);
  const finalObjects = objects.filter((object) => object.stationId === finalStationId);
  const networkAttachment = originObjects.find((object) => object.objectType === "NETWORK_ATTACHMENT");
  const hasNetworkAttachment = Boolean(networkAttachment);
  const hasFinalBuildingEntrance = finalObjects.some((object) => object.objectType === "BUILDING_ENTRANCE");
  const hasFinalServiceLocation = finalObjects.some((object) => object.objectType === "SERVICE_LOCATION");
  const objectsMissingStation = objects.filter((object) => !object.stationId || !stationIds.has(object.stationId)).map((object) => object.objectId ?? "unknown-object");
  const stationsWithoutCoordinate = stations.filter((station) => !coordinateValid(station.coordinate)).map((station) => station.stationId ?? "unknown-station");
  const objectsWithoutCoordinate = objects.filter((object) => !coordinateValid(object.coordinate)).map((object) => object.objectId ?? "unknown-object");
  const productionStationsValid = stations.length > 0 && stations.every((station) => isProductionRouteStation(station, scopeVersion.scopeVersionId, certifiedRouteReference?.certifiedRouteId));
  const attachmentReferenceType = referenceTypeFor(networkAttachment);
  const attachmentReferenceResolved =
    Boolean(networkAttachment?.attachmentReferenceResolved) ||
    attachmentReferenceType === "STATION" ||
    attachmentReferenceType === "NODE" ||
    attachmentReferenceType === "EDGE" ||
    attachmentReferenceType === "ROUTE_POINT";
  const existingInventoryReferencePreserved =
    Boolean(networkAttachment?.existingInventoryReferencePreserved) ||
    Boolean(networkAttachment?.sourceStationId || networkAttachment?.sourceNodeId || networkAttachment?.sourceEdgeId || networkAttachment?.sourceRouteId);
  const attachmentReferenceFallbackReason =
    networkAttachment?.attachmentReferenceFallbackReason ??
    (attachmentReferenceType === "NODE"
      ? "NO_EXISTING_STATION_REFERENCE_NEAREST_NODE_USED"
      : attachmentReferenceType === "EDGE"
        ? "NO_EXISTING_STATION_OR_NODE_REFERENCE_NEAREST_EDGE_USED"
        : attachmentReferenceType === "ROUTE_POINT"
          ? "NO_EXISTING_STATION_NODE_OR_EDGE_REFERENCE_ROUTE_POINT_USED"
          : undefined);
  const inventoryReferenceReady = attachmentReferenceResolved && existingInventoryReferencePreserved;
  const closureReady =
    Boolean(certifiedRouteReference) &&
    Boolean(stationing) &&
    Boolean(originStation) &&
    Boolean(finalStation) &&
    hasNetworkAttachment &&
    productionStationsValid &&
    objects.length > 0 &&
    objectsMissingStation.length === 0 &&
    inventoryReferenceReady;
  const errors: ScopeVersionStationingValidationIssue[] = [];
  const warnings: ScopeVersionStationingValidationIssue[] = [];
  const toleranceFeet = Math.max(2, Math.round(routeFeet * 0.005));

  if (!stationing) errors.push(issue("stationing", "ScopeVersion stationing is required for authoritative lateral ScopeVersions."));
  if (stations.length < 2) errors.push(issue("stations", "At least two route stations are required."));
  if (!firstStation) errors.push(issue("stations.first", "First station is required."));
  if (!finalStation) errors.push(issue("stations.final", "Final station is required."));
  if (!originStation) errors.push(issue("stations.STA-0000", "STA-0000 is required."));
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
  if (originStation && !hasNetworkAttachment) errors.push(issue("objects.NETWORK_ATTACHMENT", "NETWORK_ATTACHMENT is required at STA-0000."));
  if (networkAttachment && !inventoryReferenceReady) {
    errors.push(issue("objects.NETWORK_ATTACHMENT.inventoryReference", "NETWORK_ATTACHMENT must preserve an existing inventory route, station, node, edge, or route-point reference."));
  }
  if (!productionStationsValid && stations.length) {
    errors.push(issue("stations.productionAuthority", "Field production stations must be lateral RouteStations, not existing inventory stations."));
  }
  if (finalStation && !hasFinalBuildingEntrance) errors.push(issue("objects.BUILDING_ENTRANCE", "BUILDING_ENTRANCE is required at final station."));
  if (finalStation && !hasFinalServiceLocation) errors.push(issue("objects.SERVICE_LOCATION", "SERVICE_LOCATION is required at final station."));
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
      hasOriginStation: Boolean(originStation),
      hasNetworkAttachment,
      hasFinalBuildingEntrance,
      hasFinalServiceLocation,
      existingReferenceRouteId: networkAttachment?.sourceRouteId,
      existingReferenceStationId: networkAttachment?.sourceStationId,
      existingReferenceNodeId: networkAttachment?.sourceNodeId,
      existingReferenceEdgeId: networkAttachment?.sourceEdgeId,
      lateralOriginStationId: originStation?.stationId,
      lateralOriginCoordinate: originStation?.coordinate,
      attachmentReferenceResolved,
      attachmentReferenceType,
      existingInventoryReferencePreserved,
      attachmentReferenceFallbackReason,
      plannedHandholeRequired: Boolean(networkAttachment?.plannedHandholeRequired),
      productionStationsValid,
      closureReady,
    },
  };
}

export function summarizeScopeVersionStationingDiagnostics(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) return null;
  return validateScopeVersionStationing(scopeVersion).diagnostics;
}
