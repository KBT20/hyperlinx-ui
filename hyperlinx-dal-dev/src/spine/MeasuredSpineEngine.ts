import type {
  MeasuredSpine,
  MeasuredSpineSegment,
  SpineSiteReference,
} from "./SpineAuthorityContracts";
import type { DALCoordinate } from "../types/dal";

const EARTH_RADIUS_FEET = 20925524.9;
const FEET_PER_MILE = 5280;

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeSpineCoordinate(value: unknown): DALCoordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
  return null;
}

export function normalizeSpineGeometry(coordinates: unknown): DALCoordinate[] {
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map(normalizeSpineCoordinate)
    .filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
}

export function distanceFeet(a: DALCoordinate, b: DALCoordinate) {
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const deltaLat = (b[1] - a[1]) * Math.PI / 180;
  const deltaLon = (b[0] - a[0]) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_FEET * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function bearingDegrees(a: DALCoordinate, b: DALCoordinate) {
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const deltaLon = (b[0] - a[0]) * Math.PI / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360, 3);
}

export function computeGeometryHash(coordinates: DALCoordinate[]) {
  const text = coordinates
    .map(([lng, lat]) => `${round(lng, 7)},${round(lat, 7)}`)
    .join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `GEOM-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function routeLengthFeet(coordinates: DALCoordinate[]) {
  return coordinates.slice(0, -1).reduce((total, coordinate, index) => (
    total + distanceFeet(coordinate, coordinates[index + 1])
  ), 0);
}

export function createMeasuredSpine(args: {
  packageId: string;
  routeId?: string;
  geometry: DALCoordinate[] | { coordinates?: unknown } | unknown;
  aSite?: SpineSiteReference | null;
  zSite?: SpineSiteReference | null;
  sourceGeometryRef?: string;
}): MeasuredSpine {
  const geometryValue = Array.isArray(args.geometry)
    ? args.geometry
    : (args.geometry && typeof args.geometry === "object" ? (args.geometry as { coordinates?: unknown }).coordinates : args.geometry);
  const coordinates = normalizeSpineGeometry(geometryValue);
  if (coordinates.length < 2) {
    throw new Error("Measured spine requires at least two valid geometry coordinates.");
  }

  let cumulativeFeet = 0;
  const routeId = stableIdPart(args.routeId, args.packageId);
  const spineId = `${args.packageId}:MEASURED-SPINE:${routeId}`;
  const segments: MeasuredSpineSegment[] = [];

  coordinates.slice(0, -1).forEach((coordinate, index) => {
    const next = coordinates[index + 1];
    const segmentLengthFeet = distanceFeet(coordinate, next);
    if (segmentLengthFeet <= 0) return;
    const cumulativeStartFeet = cumulativeFeet;
    cumulativeFeet += segmentLengthFeet;
    segments.push({
      segmentId: `${spineId}:SEGMENT:${String(segments.length + 1).padStart(5, "0")}`,
      startCoordinate: coordinate,
      endCoordinate: next,
      segmentLengthFeet: round(segmentLengthFeet),
      cumulativeStartFeet: round(cumulativeStartFeet),
      cumulativeEndFeet: round(cumulativeFeet),
      bearing: bearingDegrees(coordinate, next),
      geometryIndexStart: index,
      geometryIndexEnd: index + 1,
    });
  });

  if (!segments.length) {
    throw new Error("Measured spine requires non-zero measured segment length.");
  }

  const geometryHash = computeGeometryHash(coordinates);
  const routeLengthFeetValue = round(cumulativeFeet);
  return {
    spineId,
    packageId: args.packageId,
    routeId,
    geometryHash,
    sourceGeometryRef: args.sourceGeometryRef ?? `${args.packageId}:geometry:${geometryHash}`,
    originSiteId: args.aSite?.siteId ?? `${args.packageId}:SITE:A`,
    terminalSiteId: args.zSite?.siteId ?? `${args.packageId}:SITE:Z`,
    routeLengthFeet: routeLengthFeetValue,
    routeLengthMiles: round(routeLengthFeetValue / FEET_PER_MILE, 6),
    coordinateCount: coordinates.length,
    segments,
    cumulativeMeasureIndex: segments.map((segment) => ({
      segmentId: segment.segmentId,
      geometryIndexStart: segment.geometryIndexStart,
      geometryIndexEnd: segment.geometryIndexEnd,
      cumulativeStartFeet: segment.cumulativeStartFeet,
      cumulativeEndFeet: segment.cumulativeEndFeet,
    })),
    authority: "MEASURED_SPINE_AUTHORITY",
  };
}

export function coordinateAtMeasureOnSpine(spine: MeasuredSpine, measureFeet: number) {
  const boundedMeasure = Math.max(0, Math.min(spine.routeLengthFeet, measureFeet));
  const segment = spine.segments.find((candidate) => (
    boundedMeasure >= candidate.cumulativeStartFeet &&
    boundedMeasure <= candidate.cumulativeEndFeet
  )) ?? spine.segments[spine.segments.length - 1];
  const denominator = Math.max(0.000001, segment.cumulativeEndFeet - segment.cumulativeStartFeet);
  const ratio = Math.max(0, Math.min(1, (boundedMeasure - segment.cumulativeStartFeet) / denominator));
  const lng = segment.startCoordinate[0] + (segment.endCoordinate[0] - segment.startCoordinate[0]) * ratio;
  const lat = segment.startCoordinate[1] + (segment.endCoordinate[1] - segment.startCoordinate[1]) * ratio;
  return {
    coordinate: [round(lng, 7), round(lat, 7)] as DALCoordinate,
    segmentId: segment.segmentId,
  };
}
