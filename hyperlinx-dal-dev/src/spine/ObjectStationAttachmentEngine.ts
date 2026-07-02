import type {
  AuthorizedStation,
  ObjectStationAttachment,
  ObjectStationAttachmentMethod,
  StationAuthority,
  StationIndexedGraph,
} from "./SpineAuthorityContracts";
import type { DALCoordinate } from "../types/dal";
import { distanceFeet } from "./MeasuredSpineEngine";

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = Number.NaN) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeCoordinate(value: unknown): DALCoordinate | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined;
  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
  return undefined;
}

function coordinateFrom(value: unknown): DALCoordinate | undefined {
  const direct = normalizeCoordinate(value);
  if (direct) return direct;
  const record = asRecord(value);
  const nested = record.coordinate ?? record.coordinates ?? record.location ?? record.point ?? record.geometry;
  if (nested !== undefined && nested !== value) return coordinateFrom(nested);
  const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.x);
  const lat = Number(record.lat ?? record.latitude ?? record.y);
  return normalizeCoordinate([lon, lat]);
}

function objectIdFor(record: JsonObject, packageId: string, index: number) {
  return asString(
    record.objectId ?? record.unitId ?? record.structureId ?? record.segmentId ?? record.id ?? record.runtimeObjectId,
    `${packageId}:OBJECT:${String(index + 1).padStart(6, "0")}`,
  );
}

function parentReferenceFor(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asString(record.parentId ?? record.parentReference ?? record.segmentId ?? record.spineId ?? metadata.parentId ?? metadata.segmentId ?? metadata.spineId, "");
}

function stationReferenceFor(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asString(record.stationId ?? record.station ?? record.stationLabel ?? metadata.stationId ?? metadata.station ?? metadata.stationLabel, "");
}

function measureFor(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asNumber(record.measureFeet ?? record.stationFeet ?? record.cumulativeMeasureFeet ?? metadata.measureFeet ?? metadata.stationFeet);
}

function nearestStationByMeasure(stations: AuthorizedStation[], measureFeet: number) {
  return stations.reduce<AuthorizedStation | undefined>((nearest, station) => {
    if (!nearest) return station;
    return Math.abs(station.measureFeet - measureFeet) < Math.abs(nearest.measureFeet - measureFeet) ? station : nearest;
  }, undefined);
}

function nearestStationByCoordinate(stations: AuthorizedStation[], coordinate: DALCoordinate) {
  return stations.reduce<AuthorizedStation | undefined>((nearest, station) => {
    if (!nearest) return station;
    return distanceFeet(station.coordinate, coordinate) < distanceFeet(nearest.coordinate, coordinate) ? station : nearest;
  }, undefined);
}

function stationFromReference(stations: AuthorizedStation[], reference: string) {
  if (!reference) return undefined;
  return stations.find((station) => (
    station.stationId === reference ||
    station.stationLabel === reference ||
    String(station.stationIndex) === reference
  ));
}

function stationFromParentSegment(stations: AuthorizedStation[], graph: StationIndexedGraph | undefined, parentReference: string) {
  if (!parentReference || !graph) return undefined;
  const edge = graph.edges.find((candidate) => (
    candidate.edgeId === parentReference ||
    candidate.segmentId === parentReference ||
    candidate.fromStationId === parentReference ||
    candidate.toStationId === parentReference
  ));
  return edge ? stationFromReference(stations, edge.fromStationId) : undefined;
}

function attachmentForStation(args: {
  objectId: string;
  packageId: string;
  stationAuthority: StationAuthority;
  station: AuthorizedStation | undefined;
  method: ObjectStationAttachmentMethod;
  parentReference?: string;
  reason?: string;
}): ObjectStationAttachment {
  const station = args.station;
  return {
    attachmentId: `${args.packageId}:OBJECT-STATION-ATTACHMENT:${args.objectId.replace(/[^A-Za-z0-9_-]+/g, "-")}`,
    objectId: args.objectId,
    packageId: args.packageId,
    spineId: args.stationAuthority.spineId,
    routeId: args.stationAuthority.routeId,
    stationId: station?.stationId,
    stationLabel: station?.stationLabel,
    measureFeet: station?.measureFeet,
    coordinate: station?.coordinate,
    attachmentMethod: station ? args.method : "UNRESOLVED",
    attachmentStatus: station ? "ATTACHED" : "UNRESOLVED",
    parentReference: args.parentReference,
    geometryHash: args.stationAuthority.geometryHash,
    authority: "OBJECT_STATION_ATTACHMENT_AUTHORITY",
    reason: args.reason,
  };
}

export function createObjectStationAttachments(args: {
  packageId?: string;
  objects: unknown[];
  stationAuthority: StationAuthority;
  stationIndexedGraph?: StationIndexedGraph;
}): ObjectStationAttachment[] {
  const packageId = args.packageId ?? args.stationAuthority.packageId;
  const stations = args.stationAuthority.stations;
  return args.objects.map((object, index) => {
    const record = asRecord(object);
    const objectId = objectIdFor(record, packageId, index);
    const parentReference = parentReferenceFor(record);
    const stationReference = stationReferenceFor(record);
    const explicitStation = stationFromReference(stations, stationReference);
    if (explicitStation) {
      return attachmentForStation({
        objectId,
        packageId,
        stationAuthority: args.stationAuthority,
        station: explicitStation,
        method: "EXPLICIT_STATION",
        parentReference,
      });
    }

    const measureFeet = measureFor(record);
    if (Number.isFinite(measureFeet)) {
      return attachmentForStation({
        objectId,
        packageId,
        stationAuthority: args.stationAuthority,
        station: nearestStationByMeasure(stations, measureFeet),
        method: "EXPLICIT_MEASURE",
        parentReference,
      });
    }

    const coordinate = coordinateFrom(record.coordinate ?? record.geometry ?? asRecord(record.metadata).coordinate);
    if (coordinate) {
      return attachmentForStation({
        objectId,
        packageId,
        stationAuthority: args.stationAuthority,
        station: nearestStationByCoordinate(stations, coordinate),
        method: "EXPLICIT_COORDINATE_NEAREST_STATION",
        parentReference,
      });
    }

    const parentStation = stationFromParentSegment(stations, args.stationIndexedGraph, parentReference);
    if (parentStation) {
      return attachmentForStation({
        objectId,
        packageId,
        stationAuthority: args.stationAuthority,
        station: parentStation,
        method: "DERIVED_FROM_PARENT_SEGMENT",
        parentReference,
      });
    }

    const objectType = asString(record.objectType ?? record.unitType ?? record.structureType ?? asRecord(record.metadata).objectType, "");
    if (objectType && stations.length) {
      const derivedStation = stations[Math.min(stations.length - 1, Math.round((index / Math.max(1, args.objects.length - 1)) * (stations.length - 1)))];
      return attachmentForStation({
        objectId,
        packageId,
        stationAuthority: args.stationAuthority,
        station: derivedStation,
        method: "DERIVED_FROM_DOCTRINE_RULE",
        parentReference,
        reason: "No explicit station found; attached by deterministic doctrine ordering.",
      });
    }

    return attachmentForStation({
      objectId,
      packageId,
      stationAuthority: args.stationAuthority,
      station: undefined,
      method: "UNRESOLVED",
      parentReference,
      reason: "No station, measure, coordinate, parent segment, or doctrine object type available.",
    });
  });
}
