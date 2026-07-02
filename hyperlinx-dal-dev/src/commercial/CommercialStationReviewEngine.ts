import type { DraftIofPackageRuntime } from "../api/teralinxRuntime";
import type { MapKernelPrimitive, MapKernelRenderSpec } from "../mapkernel/MapLayerManager";
import type { DALCoordinate } from "../types/dal";
import type {
  AuthorizedStation,
  MeasuredSpine,
  ObjectStationAttachment,
  StationAuthority,
  StationIndexedGraph,
} from "../spine/SpineAuthorityContracts";
import type {
  SpineAuditProjection,
  SpineReviewObject,
  StationRangeExpectation,
} from "../spine/SpineAuditProjectionContracts";
import { lookupStationExpectations, type StationExpectationLookup } from "../spine/SpineAuditProjectionEngine";
import { distanceFeet } from "../spine/MeasuredSpineEngine";

type JsonObject = Record<string, unknown>;
export type CommercialStationReviewMapMode = "ROUTE_VIEW" | "ENGINEERING_REVIEW_VIEW" | "FIELD_PREVIEW_VIEW";

export type CommercialStationLookupQuery =
  | string
  | number
  | { stationId?: string; stationLabel?: string; measureFeet?: number; coordinate?: DALCoordinate };

export interface CommercialStationLookupResult {
  stationId: string;
  stationLabel: string;
  measureFeet: number;
  coordinate: DALCoordinate;
  lat: number;
  lng: number;
  segmentId: string;
  spineId: string;
  routeId: string;
  packageId: string;
  geometryHash: string;
}

export interface CommercialMovableObjectReview {
  objectId: string;
  objectType: string;
  currentStationId: string;
  currentStationLabel: string;
  currentMeasureFeet: number;
  currentCoordinate?: DALCoordinate;
  attachmentMethod: string;
  attachmentStatus: string;
  spacingFromPriorFacilityFeet: number | null;
  spacingToNextFacilityFeet: number | null;
  doctrineSpacingStatus: "PASS" | "WARNING" | "FAIL" | "NEEDS_ENGINEERING_REVIEW";
  commercialImpactStatus: "NO_CHANGE" | "ADVISORY" | "NEEDS_ENGINEERING_REVIEW";
  movable: boolean;
  raw: JsonObject;
}

export interface CommercialStationReviewReadiness {
  status: "PASS" | "WARNING" | "FAIL";
  blockingIssues: string[];
  advisoryIssues: string[];
  canSubmitToEngineering: boolean;
}

export interface CommercialStationReviewState {
  packageId: string;
  measuredSpine?: MeasuredSpine;
  stationAuthority?: StationAuthority;
  stationIndexedGraph?: StationIndexedGraph;
  spineAuditProjection?: SpineAuditProjection;
  movableObjects: CommercialMovableObjectReview[];
  stationLookupReady: boolean;
  stationExpectationLookupReady: boolean;
  mapSpec: MapKernelRenderSpec;
  mapModes: CommercialStationReviewMapMode[];
  readiness: CommercialStationReviewReadiness;
  commercialAuthority: "COMMERCIAL_STATION_REVIEW";
  canCertifyStationAuthority: false;
  canCreateScopeVersion: false;
}

const MOVABLE_OBJECT_TYPES = new Set([
  "ILA",
  "ILA_FACILITY",
  "REGEN",
  "REGENERATION",
  "REGENERATION_FACILITY",
  "HUT",
  "HANDHOLE",
  "VAULT",
  "SPLICE_CASE",
  "PULL_POINT",
  "MARKER",
]);

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
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
  return normalizeCoordinate([record.lon ?? record.lng ?? record.longitude ?? record.x, record.lat ?? record.latitude ?? record.y]);
}

function stationLabelToMeasureFeet(value: string) {
  const match = value.trim().match(/^(\d+)\+(\d{1,2})$/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 100 + Number(match[2]);
}

function queryMeasureFeet(value: CommercialStationLookupQuery) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value.measureFeet);
  const stationMeasure = stationLabelToMeasureFeet(value);
  if (Number.isFinite(stationMeasure)) return stationMeasure;
  const numeric = Number(value.replace(/ft|feet/gi, "").trim());
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export function measuredSpineFromCommercialDraft(draftPackage: DraftIofPackageRuntime | null | undefined) {
  const measuredSpine = asRecord((draftPackage as JsonObject | null | undefined)?.measuredSpine);
  if (!asString(measuredSpine.spineId) || !asString(measuredSpine.geometryHash)) return undefined;
  return measuredSpine as unknown as MeasuredSpine;
}

export function stationAuthorityFromCommercialDraft(draftPackage: DraftIofPackageRuntime | null | undefined) {
  const stationAuthority = asRecord((draftPackage as JsonObject | null | undefined)?.stationAuthority);
  if (!asString(stationAuthority.authorityId) || !asArray(stationAuthority.stations).length) return undefined;
  return stationAuthority as unknown as StationAuthority;
}

export function stationIndexedGraphFromCommercialDraft(draftPackage: DraftIofPackageRuntime | null | undefined) {
  const graph = asRecord((draftPackage as JsonObject | null | undefined)?.stationIndexedGraph);
  if (!asString(graph.graphId) || !asArray(graph.edges).length) return undefined;
  return graph as unknown as StationIndexedGraph;
}

export function spineAuditProjectionFromCommercialDraft(draftPackage: DraftIofPackageRuntime | null | undefined) {
  const projection = asRecord((draftPackage as JsonObject | null | undefined)?.spineAuditProjection);
  const attachments = asArray(projection.attachments);
  if (!asString(projection.projectionId) || !attachments.length) return undefined;
  return projection as unknown as SpineAuditProjection;
}

export function objectStationAttachmentsFromCommercialDraft(draftPackage: DraftIofPackageRuntime | null | undefined) {
  return asArray<ObjectStationAttachment>((draftPackage as JsonObject | null | undefined)?.objectStationAttachments);
}

export function lookupCommercialStationExpectations(draftPackage: DraftIofPackageRuntime | null | undefined, stationIdOrLabel: string) {
  return lookupStationExpectations(spineAuditProjectionFromCommercialDraft(draftPackage), stationIdOrLabel);
}

function stationResult(station: AuthorizedStation): CommercialStationLookupResult {
  return {
    stationId: station.stationId,
    stationLabel: station.stationLabel,
    measureFeet: station.measureFeet,
    coordinate: station.coordinate,
    lat: station.lat,
    lng: station.lng,
    segmentId: station.segmentId,
    spineId: station.spineId,
    routeId: station.routeId,
    packageId: station.packageId,
    geometryHash: station.geometryHash,
  };
}

export function lookupCommercialStation(draftPackage: DraftIofPackageRuntime | null | undefined, query: CommercialStationLookupQuery): CommercialStationLookupResult | null {
  const stationAuthority = stationAuthorityFromCommercialDraft(draftPackage);
  const stations = stationAuthority?.stations ?? [];
  if (!stations.length) return null;
  if (typeof query === "string") {
    const text = query.trim();
    const exact = stations.find((station) => station.stationId === text || station.stationLabel === text);
    if (exact) return stationResult(exact);
  }
  if (typeof query === "object" && query !== null && !Array.isArray(query)) {
    const stationId = asString(query.stationId);
    const stationLabel = asString(query.stationLabel);
    const exact = stations.find((station) => station.stationId === stationId || station.stationLabel === stationLabel);
    if (exact) return stationResult(exact);
    if (query.coordinate) {
      const nearestCoordinateStation = stations.reduce<AuthorizedStation | null>((nearest, station) => {
        if (!nearest) return station;
        return distanceFeet(station.coordinate, query.coordinate as DALCoordinate) < distanceFeet(nearest.coordinate, query.coordinate as DALCoordinate)
          ? station
          : nearest;
      }, null);
      return nearestCoordinateStation ? stationResult(nearestCoordinateStation) : null;
    }
  }
  const measureFeet = queryMeasureFeet(query);
  if (Number.isFinite(measureFeet)) {
    const nearestMeasureStation = stations.reduce<AuthorizedStation | null>((nearest, station) => {
      if (!nearest) return station;
      return Math.abs(station.measureFeet - measureFeet) < Math.abs(nearest.measureFeet - measureFeet) ? station : nearest;
    }, null);
    return nearestMeasureStation ? stationResult(nearestMeasureStation) : null;
  }
  return null;
}

export function sourceObjectsForCommercialStationReview(draftPackage: DraftIofPackageRuntime | null | undefined) {
  const draft = draftPackage as JsonObject | null | undefined;
  const objects = [
    ...asArray<JsonObject>(draft?.objects),
    ...asArray<JsonObject>(draft?.structures),
  ];
  return objects.length ? objects : asArray<JsonObject>(draft?.proposedIofUnits);
}

export function commercialObjectId(record: JsonObject, packageId: string, index: number) {
  return asString(
    record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? record.runtimeObjectId,
    `${packageId}:COMMERCIAL-OBJECT:${String(index + 1).padStart(4, "0")}`,
  );
}

export function commercialObjectType(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asString(metadata.structureType ?? record.structureType ?? record.unitType ?? record.objectType ?? record.type, "OBJECT").toUpperCase();
}

export function isCommercialMovableObjectType(objectType: string) {
  return MOVABLE_OBJECT_TYPES.has(objectType.toUpperCase());
}

function reviewAttachmentForObject(attachments: ObjectStationAttachment[], objectId: string) {
  return attachments.find((attachment) => attachment.objectId === objectId);
}

function spacingStatus(attachment: ObjectStationAttachment | undefined, priorFeet: number | null, nextFeet: number | null) {
  if (!attachment || attachment.attachmentStatus === "UNRESOLVED" || attachment.attachmentMethod === "UNRESOLVED") return "FAIL";
  const spacingValues = [priorFeet, nextFeet].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (spacingValues.some((value) => value < 100)) return "WARNING";
  return "PASS";
}

export function buildCommercialStationReview(draftPackage: DraftIofPackageRuntime | null | undefined): CommercialStationReviewState {
  const packageId = draftPackage?.packageId ?? "DRAFT-IOF-PENDING";
  const measuredSpine = measuredSpineFromCommercialDraft(draftPackage);
  const stationAuthority = stationAuthorityFromCommercialDraft(draftPackage);
  const stationIndexedGraph = stationIndexedGraphFromCommercialDraft(draftPackage);
  const spineAuditProjection = spineAuditProjectionFromCommercialDraft(draftPackage);
  const attachments = objectStationAttachmentsFromCommercialDraft(draftPackage);
  const objects = sourceObjectsForCommercialStationReview(draftPackage);
  const movableCandidates = objects
    .map((record, index) => ({
      record,
      objectId: commercialObjectId(record, packageId, index),
      objectType: commercialObjectType(record),
    }))
    .filter((object) => isCommercialMovableObjectType(object.objectType));
  const movedObjectIds = new Set(asArray<JsonObject>((draftPackage as JsonObject | null | undefined)?.commercialObjectPlacementHistory).map((entry) => asString(entry.objectId)));
  const sortedFacilities = movableCandidates
    .map((object) => ({ ...object, attachment: reviewAttachmentForObject(attachments, object.objectId) }))
    .filter((object) => Number.isFinite(object.attachment?.measureFeet))
    .sort((left, right) => Number(left.attachment?.measureFeet ?? 0) - Number(right.attachment?.measureFeet ?? 0));
  const movableObjects = movableCandidates.map((object): CommercialMovableObjectReview => {
    const attachment = reviewAttachmentForObject(attachments, object.objectId);
    const station = attachment?.stationId ? lookupCommercialStation(draftPackage, attachment.stationId) : null;
    const facilityIndex = sortedFacilities.findIndex((facility) => facility.objectId === object.objectId);
    const prior = facilityIndex > 0 ? sortedFacilities[facilityIndex - 1].attachment : undefined;
    const next = facilityIndex >= 0 && facilityIndex < sortedFacilities.length - 1 ? sortedFacilities[facilityIndex + 1].attachment : undefined;
    const spacingFromPriorFacilityFeet = attachment && prior ? Math.round(Math.abs(Number(attachment.measureFeet ?? 0) - Number(prior.measureFeet ?? 0))) : null;
    const spacingToNextFacilityFeet = attachment && next ? Math.round(Math.abs(Number(next.measureFeet ?? 0) - Number(attachment.measureFeet ?? 0))) : null;
    return {
      objectId: object.objectId,
      objectType: object.objectType,
      currentStationId: asString(attachment?.stationId ?? station?.stationId, ""),
      currentStationLabel: asString(attachment?.stationLabel ?? station?.stationLabel, ""),
      currentMeasureFeet: asNumber(attachment?.measureFeet ?? station?.measureFeet, 0),
      currentCoordinate: coordinateFrom(attachment?.coordinate) ?? station?.coordinate,
      attachmentMethod: asString(attachment?.attachmentMethod, "UNRESOLVED"),
      attachmentStatus: asString(attachment?.attachmentStatus, attachment ? "ATTACHED" : "UNRESOLVED"),
      spacingFromPriorFacilityFeet,
      spacingToNextFacilityFeet,
      doctrineSpacingStatus: spacingStatus(attachment, spacingFromPriorFacilityFeet, spacingToNextFacilityFeet),
      commercialImpactStatus: movedObjectIds.has(object.objectId) ? "NEEDS_ENGINEERING_REVIEW" : "NO_CHANGE",
      movable: true,
      raw: object.record,
    };
  });
  const readiness = assessCommercialStationReviewReadiness(draftPackage);
  return {
    packageId,
    measuredSpine,
    stationAuthority,
    stationIndexedGraph,
    spineAuditProjection,
    movableObjects,
    stationLookupReady: Boolean(stationAuthority?.stations?.length),
    stationExpectationLookupReady: Boolean(spineAuditProjection?.closureExpectations?.length),
    mapSpec: buildCommercialStationReviewMapSpec(draftPackage, "ENGINEERING_REVIEW_VIEW"),
    mapModes: ["ROUTE_VIEW", "ENGINEERING_REVIEW_VIEW", "FIELD_PREVIEW_VIEW"],
    readiness,
    commercialAuthority: "COMMERCIAL_STATION_REVIEW",
    canCertifyStationAuthority: false,
    canCreateScopeVersion: false,
  };
}

export function assessCommercialStationReviewReadiness(draftPackage: DraftIofPackageRuntime | null | undefined): CommercialStationReviewReadiness {
  const blockingIssues: string[] = [];
  const advisoryIssues: string[] = [];
  const measuredSpine = measuredSpineFromCommercialDraft(draftPackage);
  const stationAuthority = stationAuthorityFromCommercialDraft(draftPackage);
  const attachments = objectStationAttachmentsFromCommercialDraft(draftPackage);
  const geometryCoordinates = asArray(asRecord((draftPackage as JsonObject | null | undefined)?.geometry).coordinates);
  const centerlineCoordinates = asArray((draftPackage as JsonObject | null | undefined)?.centerline);
  if (!geometryCoordinates.length && !centerlineCoordinates.length) blockingIssues.push("route geometry missing");
  if (!measuredSpine) blockingIssues.push("measuredSpine missing");
  if (!stationAuthority) blockingIssues.push("stationAuthority missing");
  if (!attachments.length) blockingIssues.push("objectStationAttachments missing");
  const objects = sourceObjectsForCommercialStationReview(draftPackage);
  const requiredUnresolved = objects
    .map((record, index) => ({
      objectId: commercialObjectId(record, draftPackage?.packageId ?? "DRAFT-IOF-PENDING", index),
      objectType: commercialObjectType(record),
    }))
    .filter((object) => isCommercialMovableObjectType(object.objectType))
    .filter((object) => {
      const attachment = attachments.find((candidate) => candidate.objectId === object.objectId);
      return !attachment || attachment.attachmentMethod === "UNRESOLVED" || attachment.attachmentStatus === "UNRESOLVED";
    })
    .map((object) => object.objectId);
  if (requiredUnresolved.length) blockingIssues.push(`unresolved required facility object: ${requiredUnresolved.join(", ")}`);
  if (!stationAuthority?.stationToCoordinateMap?.entries?.length) advisoryIssues.push("stationToCoordinateMap not available for Commercial lookup");
  return {
    status: blockingIssues.length ? "FAIL" : advisoryIssues.length ? "WARNING" : "PASS",
    blockingIssues,
    advisoryIssues,
    canSubmitToEngineering: blockingIssues.length === 0,
  };
}

function routeCoordinatesFromDraft(draftPackage: DraftIofPackageRuntime | null | undefined): DALCoordinate[] {
  const draft = draftPackage as JsonObject | null | undefined;
  const geoJsonCoordinates = asArray(draft?.geometry && asRecord(draft.geometry).coordinates).map(coordinateFrom).filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
  if (geoJsonCoordinates.length > 1) return geoJsonCoordinates;
  const centerlineCoordinates = asArray(draft?.centerline).map(coordinateFrom).filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
  if (centerlineCoordinates.length > 1) return centerlineCoordinates;
  return [];
}

function measuredSpineCoordinates(measuredSpine: MeasuredSpine | undefined) {
  if (!measuredSpine?.segments?.length) return [];
  const coordinates: DALCoordinate[] = [];
  measuredSpine.segments.forEach((segment, index) => {
    if (index === 0) coordinates.push(segment.startCoordinate);
    coordinates.push(segment.endCoordinate);
  });
  return coordinates;
}

function stationById(stationAuthority: StationAuthority | undefined, stationId: string | undefined) {
  if (!stationId) return undefined;
  return stationAuthority?.stations.find((station) => station.stationId === stationId);
}

function rangeColor(expectation: StationRangeExpectation) {
  if (expectation.expectationType === "PLOW") return "#84cc16";
  if (expectation.expectationType === "BORE") return "#a855f7";
  if (expectation.expectationType === "OPEN_TRENCH") return "#f97316";
  if (expectation.expectationType === "CONDUIT") return "#22c55e";
  if (expectation.expectationType === "FIBER") return "#38bdf8";
  return "#64748b";
}

function reviewColor(reviewObject: SpineReviewObject) {
  if (reviewObject.reviewType === "UNKNOWN_CONDITION") return "#ef4444";
  if (reviewObject.reviewType === "CONFIDENCE_RISK") return "#f59e0b";
  if (reviewObject.reviewType === "JURISDICTION_REVIEW") return "#8b5cf6";
  return "#64748b";
}

export function buildCommercialStationReviewMapSpec(draftPackage: DraftIofPackageRuntime | null | undefined, mapMode: CommercialStationReviewMapMode = "ENGINEERING_REVIEW_VIEW"): MapKernelRenderSpec {
  const packageId = draftPackage?.packageId ?? "DRAFT-IOF-PENDING";
  const measuredSpine = measuredSpineFromCommercialDraft(draftPackage);
  const stationAuthority = stationAuthorityFromCommercialDraft(draftPackage);
  const stationIndexedGraph = stationIndexedGraphFromCommercialDraft(draftPackage);
  const spineAuditProjection = spineAuditProjectionFromCommercialDraft(draftPackage);
  const review = {
    attachments: objectStationAttachmentsFromCommercialDraft(draftPackage),
    objects: sourceObjectsForCommercialStationReview(draftPackage),
  };
  const primitives: MapKernelPrimitive[] = [];
  const centerline = routeCoordinatesFromDraft(draftPackage);
  if (centerline.length > 1) {
    primitives.push({
      id: `${packageId}:commercial-centerline`,
      layerId: "iofPackage",
      kind: "line",
      coordinates: centerline,
      label: "Commercial centerline",
      style: { stroke: "#38bdf8", strokeWidth: 4, opacity: 0.78 },
      metadata: { source: "Commercial Review", sourceLayer: "COMMERCIAL_CENTERLINE", renderAuthority: "COMMERCIAL_DRAFT_IOF_PACKAGE", packageId },
      ref: { kind: "Route", id: `${packageId}:commercial-centerline`, routeId: `${packageId}:commercial-centerline`, scopeVersionId: "commercial-review" },
    });
  }
  const spineCoordinates = measuredSpineCoordinates(measuredSpine);
  if (spineCoordinates.length > 1) {
    primitives.push({
      id: `${packageId}:commercial-measured-spine`,
      layerId: "routeAuthorityDraft",
      kind: "line",
      coordinates: spineCoordinates,
      label: "Measured spine",
      style: { stroke: "#22c55e", strokeWidth: 3, opacity: 0.9, dasharray: "8 5" },
      metadata: { source: "Commercial Review", sourceLayer: "COMMERCIAL_MEASURED_SPINE", renderAuthority: "MEASURED_SPINE_AUTHORITY", packageId, geometryHash: measuredSpine?.geometryHash },
      ref: { kind: "Route", id: `${packageId}:commercial-measured-spine`, routeId: measuredSpine?.spineId ?? `${packageId}:spine`, scopeVersionId: "commercial-review" },
    });
  }
  if (mapMode !== "ROUTE_VIEW") stationIndexedGraph?.edges?.forEach((edge) => {
    const fromStation = stationAuthority?.stations.find((station) => station.stationId === edge.fromStationId);
    const toStation = stationAuthority?.stations.find((station) => station.stationId === edge.toStationId);
    if (!fromStation || !toStation) return;
    primitives.push({
      id: `${edge.edgeId}:commercial-edge`,
      layerId: "edge",
      kind: "line",
      coordinates: [fromStation.coordinate, toStation.coordinate],
      label: `${fromStation.stationLabel} to ${toStation.stationLabel}`,
      style: { stroke: "#f59e0b", strokeWidth: 2, opacity: 0.48, dasharray: "2 4" },
      metadata: { source: "Commercial Review", sourceLayer: "COMMERCIAL_STATION_INDEXED_GRAPH", renderAuthority: "STATION_INDEXED_GRAPH_AUTHORITY", packageId, geometryHash: edge.geometryHash },
      ref: { kind: "Edge", id: edge.edgeId, edgeId: edge.edgeId, scopeVersionId: "commercial-review" },
    });
  });
  if (mapMode !== "ROUTE_VIEW") {
    spineAuditProjection?.stationRangeExpectations?.forEach((expectation) => {
      const fromStation = stationById(stationAuthority, expectation.fromStationId);
      const toStation = stationById(stationAuthority, expectation.toStationId);
      if (!fromStation || !toStation) return;
      primitives.push({
        id: `${expectation.expectationId}:audit-range-overlay`,
        layerId: "iofPackage",
        kind: "line",
        coordinates: [fromStation.coordinate, toStation.coordinate],
        label: expectation.expectationType.replaceAll("_", " "),
        style: { stroke: rangeColor(expectation), strokeWidth: mapMode === "FIELD_PREVIEW_VIEW" ? 9 : 6, opacity: 0.42 },
        payload: expectation,
        metadata: {
          source: "Commercial Review",
          sourceLayer: "COMMERCIAL_AUDIT_RANGE_OVERLAY",
          renderAuthority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
          packageId,
          expectationType: expectation.expectationType,
          closureRequired: expectation.closureRequired,
          auditEntryIds: expectation.auditEntryIds,
        },
        ref: { kind: "ProductionUnit", id: expectation.expectationId, objectId: expectation.expectationId, scopeVersionId: "commercial-review" },
      });
    });
    spineAuditProjection?.spineReviewObjects?.forEach((reviewObject) => {
      const station = stationById(stationAuthority, reviewObject.stationId);
      const coordinate = reviewObject.coordinate ?? station?.coordinate;
      if (!coordinate) return;
      primitives.push({
        id: `${reviewObject.reviewObjectId}:audit-review-object`,
        layerId: "object",
        kind: "point",
        coordinate,
        label: reviewObject.label,
        style: { fill: reviewColor(reviewObject), stroke: "#111827", radius: 7, opacity: 0.92 },
        payload: reviewObject,
        metadata: {
          source: "Commercial Review",
          sourceLayer: "COMMERCIAL_AUDIT_REVIEW_OBJECTS",
          renderAuthority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
          packageId,
          reviewType: reviewObject.reviewType,
          reviewRequired: reviewObject.reviewRequired,
        },
        ref: { kind: "Object", id: reviewObject.reviewObjectId, objectId: reviewObject.reviewObjectId, stationId: reviewObject.stationId, scopeVersionId: "commercial-review" },
      });
    });
  }
  stationAuthority?.stations?.forEach((station) => {
    const major = station.stationIndex === 0 || station.stationIndex === stationAuthority.stations.length - 1 || Math.round(station.measureFeet) % 5280 === 0;
    if (mapMode === "ROUTE_VIEW" && !major) return;
    primitives.push({
      id: `${station.stationId}:commercial-point`,
      layerId: "station",
      kind: "point",
      coordinate: station.coordinate,
      label: station.stationLabel,
      style: { fill: major ? "#fde68a" : "#bfdbfe", stroke: major ? "#713f12" : "#1d4ed8", radius: major ? 4 : 2.5, opacity: major ? 0.95 : 0.68 },
      metadata: { stationFeet: station.measureFeet, source: "Commercial Review", sourceLayer: "COMMERCIAL_STATIONS", renderAuthority: "STATION_AUTHORITY", packageId, geometryHash: station.geometryHash },
      ref: { kind: "Station", id: station.stationId, stationId: station.stationId, scopeVersionId: "commercial-review" },
    });
    if (!major || mapMode === "FIELD_PREVIEW_VIEW") return;
    primitives.push({
      id: `${station.stationId}:commercial-label`,
      layerId: "station",
      kind: "label",
      coordinate: station.coordinate,
      label: station.stationLabel,
      style: { fill: "#172554", fontSize: 11, fontWeight: 800 },
      metadata: { stationFeet: station.measureFeet, source: "Commercial Review", sourceLayer: "COMMERCIAL_MAJOR_STATION_LABELS", renderAuthority: "STATION_AUTHORITY", packageId, geometryHash: station.geometryHash },
      ref: { kind: "Station", id: station.stationId, stationId: station.stationId, scopeVersionId: "commercial-review" },
    });
  });
  const attachmentsByObjectId = new Map(review.attachments.map((attachment) => [attachment.objectId, attachment]));
  if (mapMode !== "ROUTE_VIEW") review.objects.forEach((object, index) => {
    const objectId = commercialObjectId(object, packageId, index);
    const attachment = attachmentsByObjectId.get(objectId);
    const coordinate = coordinateFrom(attachment?.coordinate ?? object.coordinate);
    if (!coordinate) return;
    primitives.push({
      id: `${objectId}:commercial-object`,
      layerId: "object",
      kind: "point",
      coordinate,
      label: commercialObjectType(object),
      style: { fill: "#fb7185", stroke: "#881337", radius: 6, opacity: 0.9 },
      payload: { object, attachment },
      metadata: { source: "Commercial Review", sourceLayer: "COMMERCIAL_STATION_OBJECTS", renderAuthority: "OBJECT_STATION_ATTACHMENT_AUTHORITY", packageId, attachmentMethod: attachment?.attachmentMethod, attachmentStatus: attachment?.attachmentStatus },
      ref: { kind: "Object", id: objectId, objectId, stationId: attachment?.stationId, scopeVersionId: "commercial-review" },
    });
  });
  return {
    specId: `commercial-station-review:${packageId}:${mapMode}`,
    sourceType: "IOFPackage",
    sourceId: packageId,
    name: "Commercial Station-Aware Review",
    primitives,
    features: [],
    metadata: {
      packageId,
      scopeVersionId: "commercial-review",
      sourceAuthority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
      noScopeVersionCreation: true,
      canCertifyStationAuthority: false,
      mapMode,
      auditProjectionId: spineAuditProjection?.projectionId,
      closureExpectationCount: spineAuditProjection?.closureExpectations.length ?? 0,
    },
  };
}
