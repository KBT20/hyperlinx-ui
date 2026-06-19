import type { CertifiedRoute } from "../routing/CertifiedRouteAuthority";
import type { DALCoordinate, RouteStation, ScopeVersion, ScopeVersionStationingSummary } from "../types/dal";

export const DEFAULT_LATERAL_STATION_INTERVAL_FEET = 100;
const FEET_PER_METER = 3.28084;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceFeet(a: DALCoordinate, b: DALCoordinate) {
  const radiusMeters = 6371008.8;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * radiusMeters * Math.asin(Math.min(1, Math.sqrt(h))) * FEET_PER_METER;
}

function isCoordinate(value: unknown): value is DALCoordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function cleanGeometry(geometry: DALCoordinate[]) {
  return geometry.filter(isCoordinate).map((coord) => [Number(coord[0]), Number(coord[1])] as DALCoordinate);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function routeLengthFeet(geometry: DALCoordinate[]) {
  const coordinates = cleanGeometry(geometry);
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceFeet(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

export function stationLabelForMeasure(measureFeet: number) {
  const feet = Math.max(0, Math.round(measureFeet));
  const station = Math.floor(feet / 100);
  const remainder = feet % 100;
  return `${station}+${remainder.toString().padStart(2, "0")}`;
}

export function stationIdForMeasure(measureFeet: number) {
  return `STA-${Math.max(0, Math.round(measureFeet)).toString().padStart(4, "0")}`;
}

export function interpolateRouteCoordinate(geometry: DALCoordinate[], measureFeet: number, routeFeet?: number): DALCoordinate {
  const coordinates = cleanGeometry(geometry);
  if (!coordinates.length) return [0, 0];
  if (coordinates.length === 1) return coordinates[0];

  const geometryFeet = routeLengthFeet(coordinates);
  const normalizedMeasure = Math.max(0, Number(measureFeet));
  const targetFeet = Number.isFinite(Number(routeFeet)) && Number(routeFeet) > 0 && geometryFeet > 0
    ? (normalizedMeasure / Number(routeFeet)) * geometryFeet
    : normalizedMeasure;

  if (targetFeet <= 0) return coordinates[0];
  if (targetFeet >= geometryFeet) return coordinates[coordinates.length - 1];

  let walked = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentFeet = distanceFeet(start, end);
    if (walked + segmentFeet >= targetFeet) {
      const ratio = segmentFeet > 0 ? (targetFeet - walked) / segmentFeet : 0;
      return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
    }
    walked += segmentFeet;
  }

  return coordinates[coordinates.length - 1];
}

export function generateRouteStationsFromCertifiedRoute(args: {
  scopeVersion: ScopeVersion;
  certifiedRoute: CertifiedRoute;
  stationIntervalFeet?: number;
  createdAt?: string;
}) {
  const stationIntervalFeet = Number(args.stationIntervalFeet ?? DEFAULT_LATERAL_STATION_INTERVAL_FEET);
  const interval = Number.isFinite(stationIntervalFeet) && stationIntervalFeet > 0 ? stationIntervalFeet : DEFAULT_LATERAL_STATION_INTERVAL_FEET;
  const routeFeet = Math.max(0, Math.round(Number(args.certifiedRoute.routeFeet ?? routeLengthFeet(args.certifiedRoute.geometry))));
  const routeId = args.certifiedRoute.nearestRouteId ?? String(args.scopeVersion.canonicalTruth.networkBasis?.routeId ?? asRecord(args.scopeVersion.route).routeId ?? args.certifiedRoute.certifiedRouteId);
  const createdAt = args.createdAt ?? new Date().toISOString();
  const measures: number[] = [];
  console.log("[STATION_GENERATOR]", {
    routeId,
    routeLengthFeet: routeFeet,
    stationSpacingFeet: interval,
  });

  for (let measure = 0; measure < routeFeet; measure += interval) {
    measures.push(Math.round(measure));
  }
  if (!measures.length || measures[0] !== 0) measures.unshift(0);
  if (measures[measures.length - 1] !== routeFeet) measures.push(routeFeet);

  const stations: RouteStation[] = Array.from(new Set(measures)).map((measureFeet) => ({
    stationId: stationIdForMeasure(measureFeet),
    scopeVersionId: args.scopeVersion.scopeVersionId,
    certifiedRouteId: args.certifiedRoute.certifiedRouteId,
    routeId,
    measureFeet,
    stationLabel: stationLabelForMeasure(measureFeet),
    coordinate: Math.round(measureFeet) === 0 ? args.certifiedRoute.attachmentCoordinate : interpolateRouteCoordinate(args.certifiedRoute.geometry, measureFeet, routeFeet),
    stationState: "PLANNED",
    createdAt,
    updatedAt: createdAt,
  }));

  console.log("[STATION_GENERATOR_RESULT]", {
    routeId,
    stationCount: stations.length,
    firstStation: stations[0],
    lastStation: stations[stations.length - 1],
  });

  return stations;
}

export function summarizeRouteStationing(args: {
  certifiedRoute: CertifiedRoute;
  stations: RouteStation[];
  stationIntervalFeet?: number;
}): ScopeVersionStationingSummary {
  const routeFeet = Math.max(0, Math.round(Number(args.certifiedRoute.routeFeet ?? routeLengthFeet(args.certifiedRoute.geometry))));
  const finalStation = args.stations[args.stations.length - 1];
  return {
    stationIntervalFeet: args.stationIntervalFeet ?? DEFAULT_LATERAL_STATION_INTERVAL_FEET,
    routeFeet,
    stationCount: args.stations.length,
    firstStationId: args.stations[0]?.stationId,
    finalStationId: finalStation?.stationId,
    finalStationMeasureFeet: finalStation?.measureFeet ?? 0,
    certifiedRouteId: args.certifiedRoute.certifiedRouteId,
    geometryHash: args.certifiedRoute.geometryHash,
  };
}
