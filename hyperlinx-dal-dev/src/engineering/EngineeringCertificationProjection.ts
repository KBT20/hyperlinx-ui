import type { DraftIofPackageRuntime } from "../api/teralinxRuntime";
import type { DALCoordinate } from "../types/dal";
import type { MapKernelGeoJsonFeature, MapKernelPrimitive, MapKernelRenderSpec } from "../mapkernel/MapLayerManager";
import type {
  MeasuredSpine,
  ObjectStationAttachment,
  StationAuthority,
  StationIndexedGraph,
} from "../spine/SpineAuthorityContracts";

export type EngineeringComplianceStatus = "PASS" | "WARNING" | "FAIL" | "PENDING";

export const ENGINEERING_CERTIFICATION_WORKFLOW = [
  { key: "commercialAssembly", label: "Commercial Assembly", status: "complete" },
  { key: "draftIofPackage", label: "Draft IOF Package", status: "complete" },
  { key: "engineeringReview", label: "Engineering Review", status: "active" },
  { key: "certifiedIofPackage", label: "Certified IOF Package", status: "pending" },
  { key: "scopeVersion", label: "ScopeVersion", status: "pending" },
  { key: "serviceOrder", label: "Service Order", status: "pending" },
] as const;

export const PD001_COMPLIANCE_CATEGORIES = [
  "geometry",
  "spine",
  "stationing",
  "station-to-coordinate",
  "graph",
  "objects",
  "object attachment",
  "structures",
  "conduit",
  "fiber",
  "ILA / regen facilities",
  "crossings",
  "quantities",
  "pricing summary",
  "O&M",
  "constraints",
  "engineering readiness",
] as const;

export const ENGINEERING_CONSTRAINT_CATEGORIES = [
  "ROW",
  "utility conflict",
  "railroad",
  "DOT / highway",
  "water crossing",
  "environmental",
  "floodplain",
  "rock / geology",
  "bridge attachment",
  "power availability",
  "permit jurisdiction",
  "customer requested change",
] as const;

export type EngineeringConstraintCategory = typeof ENGINEERING_CONSTRAINT_CATEGORIES[number];
export type EngineeringConstraintSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EngineeringConstraintStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "ACCEPTED";

export interface EngineeringCertificationConstraint {
  constraintId: string;
  category: EngineeringConstraintCategory;
  station?: string;
  stationRange?: string;
  objectReference?: string;
  severity: EngineeringConstraintSeverity;
  status: EngineeringConstraintStatus;
  engineeringDisposition: string;
  notesEvidence: string;
  source: string;
}

export interface EngineeringPackageStation {
  stationId: string;
  stationIndex: number;
  stationFeet: number;
  milepost: number;
  label: string;
  coordinate?: DALCoordinate;
  segmentId?: string;
  stationClass?: string;
  geometryHash?: string;
  raw: Record<string, unknown>;
}

export interface EngineeringPackageObject {
  objectId: string;
  objectType: string;
  station?: string;
  stationRange?: string;
  coordinate?: DALCoordinate;
  parentReference?: string;
  packageSource: string;
  constructionMethod: string;
  dependencies: string[];
  quantityImpact: string;
  commercialAssumption: string;
  engineeringNotes: string;
  constraintLinks: string[];
  currentReviewStatus: string;
  movable: boolean;
  attachmentMethod?: string;
  attachmentStatus?: string;
  attachmentId?: string;
  raw: Record<string, unknown>;
}

export interface EngineeringComplianceRow {
  key: typeof PD001_COMPLIANCE_CATEGORIES[number];
  label: string;
  status: EngineeringComplianceStatus;
  detail: string;
}

export interface EngineeringCertificationProjection {
  packageId: string;
  draftPackageId: string;
  customer: string;
  account: string;
  opportunityPackageId: string;
  productIdName: string;
  doctrineIdVersion: string;
  draftPackageRevision: number;
  routeLength: number;
  routeCoordinates: DALCoordinate[];
  centerlineCoordinates: DALCoordinate[];
  stationCount: number;
  objectCount: number;
  facilityCount: number;
  commercialStatus: string;
  engineeringStatus: string;
  validationReadinessStatus: string;
  stations: EngineeringPackageStation[];
  objects: EngineeringPackageObject[];
  constraints: EngineeringCertificationConstraint[];
  measuredSpine?: MeasuredSpine;
  stationAuthority?: StationAuthority;
  stationIndexedGraph?: StationIndexedGraph;
  objectStationAttachments?: ObjectStationAttachment[];
  compliance: EngineeringComplianceRow[];
  mapSpec: MapKernelRenderSpec;
  stationMoveAllowed: false;
  sourceDraftPackage: DraftIofPackageRuntime;
}

const STATION_ATTACHED_OBJECT_TYPES = new Set([
  "REGEN",
  "REGENERATION",
  "REGENERATION_FACILITY",
  "ILA",
  "ILA_FACILITY",
  "VAULT",
  "HANDHOLE",
  "SPLICE_CASE",
  "MARKER",
  "PULL_POINT",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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
  const lonLatValid = Math.abs(first) <= 180 && Math.abs(second) <= 90;
  const latLonValid = Math.abs(first) <= 90 && Math.abs(second) <= 180;
  if (lonLatValid) return [first, second];
  if (latLonValid) return [second, first];
  return undefined;
}

function isCoordinate(value: unknown): value is DALCoordinate {
  return Boolean(normalizeCoordinate(value));
}

function coordinateFrom(value: unknown): DALCoordinate | undefined {
  const normalized = normalizeCoordinate(value);
  if (normalized) return normalized;
  const record = asRecord(value);
  const coordinateCandidate = record.coordinate ?? record.coordinates ?? record.location ?? record.point ?? record.geometry;
  if (coordinateCandidate !== undefined && coordinateCandidate !== value) {
    const nested = coordinateFrom(coordinateCandidate);
    if (nested) return nested;
  }
  const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.x);
  const lat = Number(record.lat ?? record.latitude ?? record.y);
  return normalizeCoordinate([lon, lat]);
}

function coordinatesFrom(value: unknown): DALCoordinate[] {
  const normalized = normalizeCoordinate(value);
  if (normalized) return [normalized];
  if (!Array.isArray(value)) {
    const record = asRecord(value);
    const geometry = asRecord(record.geometry);
    const centerline = asRecord(record.centerline);
    const candidates = [
      record.coordinates,
      geometry.coordinates,
      record.geometry,
      record.routeGeometry,
      record.centerline,
      centerline.coordinates,
      centerline.geometry,
      record.path,
      record.points,
      record.feature,
      ...(String(record.type ?? "") === "FeatureCollection" ? asArray(record.features) : []),
    ].filter((candidate) => candidate !== undefined && candidate !== value);
    for (const candidate of candidates) {
      const coordinates = coordinatesFrom(candidate);
      if (coordinates.length > 1) return coordinates;
    }
    const coordinate = coordinateFrom(value);
    return coordinate ? [coordinate] : [];
  }
  if (value.every((entry) => normalizeCoordinate(entry))) {
    return value.map((coordinate) => normalizeCoordinate(coordinate)).filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
  }
  const nestedCoordinates = value.flatMap((entry) => coordinatesFrom(entry));
  if (nestedCoordinates.length > 1) return nestedCoordinates;
  return value.map(coordinateFrom).filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
}

function firstCoordinateList(...values: unknown[]) {
  for (const value of values) {
    const coordinates = coordinatesFrom(value);
    if (coordinates.length > 1) return coordinates;
  }
  return [];
}

function coordinatesFromGeometryReferences(values: unknown): DALCoordinate[] {
  return asArray(values)
    .flatMap((value) => {
      const embeddedCoordinates = coordinatesFrom(value);
      if (embeddedCoordinates.length) return embeddedCoordinates;
      const matches = String(value ?? "").matchAll(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g);
      return [...matches]
        .map((match) => normalizeCoordinate([Number(match[1]), Number(match[2])]))
        .filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
    });
}

function coordinatesFromStations(values: unknown): DALCoordinate[] {
  return asArray(values).map(coordinateFrom).filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
}

function coordinatesFromRouteSegments(values: unknown): DALCoordinate[] {
  const segmentCoordinates = asArray(values)
    .flatMap((segment) => firstCoordinateList(
      asRecord(segment).geometry,
      asRecord(segment).coordinates,
      asRecord(segment).routeGeometry,
      asRecord(segment).centerline,
    ));
  return segmentCoordinates.length > 1 ? segmentCoordinates : [];
}

function coordinatesFromMeasuredSpine(value: unknown): DALCoordinate[] {
  const measuredSpine = asRecord(value);
  const segments = asArray<Record<string, unknown>>(measuredSpine.segments);
  if (!segments.length) return [];
  const coordinates: DALCoordinate[] = [];
  segments.forEach((segment, index) => {
    const start = coordinateFrom(segment.startCoordinate);
    const end = coordinateFrom(segment.endCoordinate);
    if (index === 0 && start) coordinates.push(start);
    if (end) coordinates.push(end);
  });
  return coordinates.length > 1 ? coordinates : [];
}

function measuredSpineFromPackage(draft: DraftIofPackageRuntime): MeasuredSpine | undefined {
  const measuredSpine = asRecord((draft as Record<string, unknown>).measuredSpine);
  if (!asString(measuredSpine.spineId) || !asString(measuredSpine.geometryHash)) return undefined;
  return measuredSpine as unknown as MeasuredSpine;
}

function stationAuthorityFromPackage(draft: DraftIofPackageRuntime): StationAuthority | undefined {
  const stationAuthority = asRecord((draft as Record<string, unknown>).stationAuthority);
  const stations = asArray(stationAuthority.stations);
  if (!asString(stationAuthority.authorityId) || !stations.length) return undefined;
  return stationAuthority as unknown as StationAuthority;
}

function stationIndexedGraphFromPackage(draft: DraftIofPackageRuntime): StationIndexedGraph | undefined {
  const graph = asRecord((draft as Record<string, unknown>).stationIndexedGraph);
  const edges = asArray(graph.edges);
  if (!asString(graph.graphId) || !edges.length) return undefined;
  return graph as unknown as StationIndexedGraph;
}

function objectStationAttachmentsFromPackage(draft: DraftIofPackageRuntime): ObjectStationAttachment[] {
  return asArray<ObjectStationAttachment>((draft as Record<string, unknown>).objectStationAttachments);
}

function coordinatesFromDependencyGraph(value: unknown): DALCoordinate[] {
  const graph = asRecord(value);
  return [
    ...asArray(graph.nodes),
    ...asArray(graph.edges),
  ].flatMap((entry) => coordinatesFrom(entry));
}

function coordinatesFromCommercialDraftSnapshot(value: unknown): DALCoordinate[] {
  const snapshot = asRecord(value);
  if (!Object.keys(snapshot).length) return [];
  return firstCoordinateList(
    asRecord(snapshot.geometry).coordinates,
    asRecord(asRecord(snapshot.geometry).geometry).coordinates,
    snapshot.geometry,
    snapshot.centerline,
    asRecord(snapshot.centerline).coordinates,
    asRecord(snapshot.centerline).geometry,
    asRecord(snapshot.centerlineRoute).coordinates,
    asRecord(snapshot.centerlineRoute).geometry,
    snapshot.centerlineRoute,
    asRecord(snapshot.osrmRoute).coordinates,
    asRecord(snapshot.osrmRoute).geometry,
    snapshot.osrmRoute,
    snapshot.routeGeometry,
  );
}

function coordinatesFromCustomerRequests(values: unknown): DALCoordinate[] {
  for (const request of asArray(values)) {
    const record = asRecord(request);
    const metadata = asRecord(record.metadata);
    const coordinates = firstCoordinateList(
      coordinatesFromCommercialDraftSnapshot(record.commercialDraftSnapshot),
      coordinatesFromCommercialDraftSnapshot(metadata.commercialDraftSnapshot),
      record.geometry,
      asRecord(record.geometry).coordinates,
      asRecord(record.geometry).geometry,
      record.centerline,
      record.routeGeometry,
    );
    if (coordinates.length > 1) return coordinates;
  }
  return [];
}

function coordinatesFromProposedIofUnits(values: unknown): DALCoordinate[] {
  const coordinates = asArray(values)
    .flatMap((unit) => {
      const record = asRecord(unit);
      const metadata = asRecord(record.metadata);
      return firstCoordinateList(
        asRecord(record.geometry).coordinates,
        asRecord(asRecord(record.geometry).geometry).coordinates,
        record.geometry,
        record.routeGeometry,
        record.centerline,
        asRecord(record.centerline).coordinates,
        asRecord(record.centerline).geometry,
        asRecord(metadata.geometry).coordinates,
        metadata.geometry,
        coordinatesFromGeometryReferences(record.geometryReferences),
      );
    });
  return coordinates.length > 1 ? coordinates : [];
}

function routeCoordinatesFromPackage(draft: DraftIofPackageRuntime) {
  const loose = draft as Record<string, unknown>;
  const routeEntries = asArray(loose.route);
  const doctrineAssembly = asRecord(loose.productDoctrineAssembly);
  const routeGeometry = routeEntries
    .map((entry) => firstCoordinateList(asRecord(entry).geometry, asRecord(entry).coordinates, asRecord(entry).routeGeometry))
    .find((coordinates) => coordinates.length > 1) ?? [];
  const routeSegmentGeometry = coordinatesFromRouteSegments([
    ...asArray(loose.routeSegments),
    ...asArray(doctrineAssembly.routeSegments),
  ]);
  return firstCoordinateList(
    asRecord(loose.geometry).coordinates,
    asRecord(asRecord(loose.geometry).geometry).coordinates,
    loose.geometry,
    coordinatesFromMeasuredSpine(loose.measuredSpine),
    asRecord(loose.centerline).coordinates,
    asRecord(loose.centerline).geometry,
    loose.centerline,
    asRecord(loose.centerlineRoute).coordinates,
    asRecord(asRecord(loose.centerlineRoute).geometry).coordinates,
    asRecord(loose.centerlineRoute).geometry,
    loose.centerlineRoute,
    asRecord(loose.osrmRoute).coordinates,
    asRecord(asRecord(loose.osrmRoute).geometry).coordinates,
    asRecord(loose.osrmRoute).geometry,
    loose.osrmRoute,
    asRecord(doctrineAssembly.osrmRoute).geometry,
    asRecord(doctrineAssembly.osrmRoute).coordinates,
    doctrineAssembly.centerline,
    coordinatesFromCommercialDraftSnapshot(loose.commercialDraftSnapshot),
    coordinatesFromCustomerRequests(loose.customerRequests),
    coordinatesFromProposedIofUnits(draft.proposedIofUnits),
    asRecord(loose.spine).geometry,
    asRecord(loose.spine).coordinates,
    asRecord(loose.spine).centerline,
    routeGeometry,
    routeSegmentGeometry,
    coordinatesFromGeometryReferences(loose.geometryReferences),
  );
}

function centerlineCoordinatesFromPackage(draft: DraftIofPackageRuntime, routeCoordinates: DALCoordinate[]) {
  const loose = draft as Record<string, unknown>;
  const doctrineAssembly = asRecord(loose.productDoctrineAssembly);
  return firstCoordinateList(
    asRecord(loose.geometry).coordinates,
    asRecord(asRecord(loose.geometry).geometry).coordinates,
    loose.geometry,
    coordinatesFromMeasuredSpine(loose.measuredSpine),
    asRecord(loose.centerline).coordinates,
    asRecord(loose.centerline).geometry,
    loose.centerline,
    asRecord(loose.centerlineRoute).coordinates,
    asRecord(asRecord(loose.centerlineRoute).geometry).coordinates,
    asRecord(loose.centerlineRoute).geometry,
    loose.centerlineRoute,
    asRecord(loose.osrmRoute).coordinates,
    asRecord(asRecord(loose.osrmRoute).geometry).coordinates,
    asRecord(loose.osrmRoute).geometry,
    loose.osrmRoute,
    asRecord(doctrineAssembly.osrmRoute).geometry,
    asRecord(doctrineAssembly.osrmRoute).coordinates,
    doctrineAssembly.centerline,
    coordinatesFromCommercialDraftSnapshot(loose.commercialDraftSnapshot),
    coordinatesFromCustomerRequests(loose.customerRequests),
    coordinatesFromProposedIofUnits(draft.proposedIofUnits),
    routeCoordinates,
  );
}

function coordinateAt(coordinates: DALCoordinate[], index: number, total: number): DALCoordinate | undefined {
  if (!coordinates.length) return undefined;
  if (coordinates.length === 1 || total <= 1) return coordinates[0];
  const coordinateIndex = Math.min(coordinates.length - 1, Math.max(0, Math.round((index / (total - 1)) * (coordinates.length - 1))));
  return coordinates[coordinateIndex];
}

function stationLabel(station: Record<string, unknown>, stationFeet: number) {
  const explicit = station.label ?? station.stationLabel ?? station.stationId;
  if (explicit) return String(explicit);
  return `${Math.floor(stationFeet / 100)}+${Math.round(stationFeet % 100).toString().padStart(2, "0")}`;
}

function normalizeStations(draft: DraftIofPackageRuntime, routeCoordinates: DALCoordinate[]): EngineeringPackageStation[] {
  const authority = stationAuthorityFromPackage(draft);
  const rawStations = authority?.stations?.length
    ? (authority.stations as unknown as Record<string, unknown>[])
    : asArray<Record<string, unknown>>(draft.stations);
  const stationCoordinateMap = asRecord((draft as Record<string, unknown>).stationToCoordinateMap ?? asRecord(authority).stationToCoordinateMap);
  const byStationId = asRecord(stationCoordinateMap.byStationId);
  return rawStations.map((station, index) => {
    const stationId = asString(station.stationId ?? station.id, `${draft.packageId}:STATION:${String(index).padStart(4, "0")}`);
    const stationFeet = asNumber(station.stationFeet ?? station.measureFeet ?? station.feet, index * 5280);
    const mapEntry = asRecord(byStationId[stationId]);
    const coordinate = coordinateFrom(station.coordinate ?? station.geometry ?? mapEntry.coordinate ?? station) ?? coordinateAt(routeCoordinates, index, rawStations.length);
    return {
      stationId,
      stationIndex: asNumber(station.stationIndex ?? station.index, index),
      stationFeet,
      milepost: asNumber(station.milepost, stationFeet / 5280),
      label: stationLabel(station, stationFeet),
      coordinate,
      segmentId: asString(station.segmentId ?? mapEntry.segmentId, ""),
      stationClass: asString(station.stationClass, ""),
      geometryHash: asString(station.geometryHash ?? mapEntry.geometryHash, ""),
      raw: station,
    };
  });
}

function nearestStation(stations: EngineeringPackageStation[], index: number, total: number) {
  if (!stations.length) return undefined;
  const stationIndex = Math.min(stations.length - 1, Math.max(0, Math.round((index / Math.max(1, total - 1)) * (stations.length - 1))));
  return stations[stationIndex];
}

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.flatMap((value) => Array.isArray(value) ? value : [value]).forEach((value) => {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function objectTypeFor(record: Record<string, unknown>) {
  const metadata = asRecord(record.metadata);
  return asString(
    metadata.structureType ??
      record.structureType ??
      record.unitType ??
      record.objectType ??
      record.type ??
      record.classification,
    "ENGINEERING_OBJECT",
  ).toUpperCase();
}

function objectIdFor(record: Record<string, unknown>, packageId: string, index: number) {
  return asString(
    record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? record.runtimeObjectId,
    `${packageId}:OBJECT:${String(index + 1).padStart(3, "0")}`,
  );
}

function objectMovable(record: Record<string, unknown>) {
  const objectType = objectTypeFor(record);
  return STATION_ATTACHED_OBJECT_TYPES.has(objectType);
}

function normalizeObjects(draft: DraftIofPackageRuntime, stations: EngineeringPackageStation[]): EngineeringPackageObject[] {
  const loose = draft as Record<string, unknown>;
  const attachments = new Map(
    objectStationAttachmentsFromPackage(draft).map((attachment) => [attachment.objectId, attachment as unknown as Record<string, unknown>]),
  );
  const sourceObjects = [
    ...asArray<Record<string, unknown>>(draft.objects),
    ...asArray<Record<string, unknown>>(draft.structures),
    ...asArray<Record<string, unknown>>(loose.engineeringObjects),
  ];
  const source = sourceObjects.length ? sourceObjects : asArray<Record<string, unknown>>(draft.proposedIofUnits);
  return source.map((record, index) => {
    const objectId = objectIdFor(record, draft.packageId, index);
    const attachment = attachments.get(objectId) ?? asRecord(
      [...attachments.values()].find((candidate) => asString(candidate.objectId) === objectId),
    );
    const metadata = asRecord(record.metadata);
    const attachmentStatus = asString(attachment.attachmentStatus, "");
    const attachmentMethod = asString(attachment.attachmentMethod, "");
    const stationReference = attachmentStatus === "UNRESOLVED"
      ? ""
      : asString(attachment.stationId ?? attachment.stationLabel ?? record.stationId ?? record.station ?? metadata.stationId ?? metadata.station, "");
    const fallbackStation = stationReference
      ? stations.find((station) => station.stationId === stationReference || station.label === stationReference)
      : attachments.has(objectId)
        ? undefined
        : nearestStation(stations, index, source.length);
    const renderFallbackStation = fallbackStation ?? nearestStation(stations, index, source.length);
    const coordinate = coordinateFrom(attachment.coordinate ?? record.coordinate ?? record.geometry ?? metadata.coordinate) ?? renderFallbackStation?.coordinate;
    const quantity = record.quantity ?? record.commercialQuantity ?? record.engineeringQuantity ?? metadata.quantity;
    const objectType = objectTypeFor(record);
    return {
      objectId,
      objectType,
      station: stationReference || fallbackStation?.label,
      stationRange: asString(record.stationRange ?? metadata.stationRange, ""),
      coordinate,
      parentReference: asString(record.parentId ?? record.spineId ?? metadata.parentId ?? metadata.spineId, ""),
      packageSource: "Draft IOF Package",
      constructionMethod: asString(record.constructionMethod ?? metadata.constructionMethod, "commercial assumption"),
      dependencies: uniqueStrings([record.dependencyIds, metadata.dependencies]),
      quantityImpact: quantity === undefined ? "n/a" : String(quantity),
      commercialAssumption: asString(record.commercialAssumption ?? record.engineeringNote ?? metadata.commercialAssumption, "Commercial package assumption"),
      engineeringNotes: asString(record.engineeringNotes ?? record.engineeringNote ?? metadata.engineeringNotes, ""),
      constraintLinks: uniqueStrings([record.constraintLinks, metadata.constraintLinks]),
      currentReviewStatus: asString(record.status ?? record.engineeringDecision ?? metadata.status, "PENDING"),
      movable: objectMovable(record),
      attachmentMethod,
      attachmentStatus,
      attachmentId: asString(attachment.attachmentId, ""),
      raw: record,
    };
  });
}

function normalizeConstraint(value: unknown, packageId: string, index: number): EngineeringCertificationConstraint {
  const record = asRecord(value);
  const category = ENGINEERING_CONSTRAINT_CATEGORIES.includes(record.category as EngineeringConstraintCategory)
    ? record.category as EngineeringConstraintCategory
    : "ROW";
  const severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(record.severity))
    ? String(record.severity) as EngineeringConstraintSeverity
    : "MEDIUM";
  const status = ["OPEN", "IN_REVIEW", "RESOLVED", "ACCEPTED"].includes(String(record.status))
    ? String(record.status) as EngineeringConstraintStatus
    : "OPEN";
  return {
    constraintId: asString(record.constraintId ?? record.id, `${packageId}:CONSTRAINT:${String(index + 1).padStart(3, "0")}`),
    category,
    station: asString(record.station ?? record.stationId, ""),
    stationRange: asString(record.stationRange, ""),
    objectReference: asString(record.objectReference ?? record.objectId, ""),
    severity,
    status,
    engineeringDisposition: asString(record.engineeringDisposition ?? record.disposition, "PENDING_ENGINEERING_DISPOSITION"),
    notesEvidence: asString(record.notesEvidence ?? record.notes ?? record.evidence, ""),
    source: asString(record.source, "Engineering Certification"),
  };
}

function constraintsFromPackage(draft: DraftIofPackageRuntime) {
  const loose = draft as Record<string, unknown>;
  return [
    ...asArray(loose.engineeringConstraints),
    ...asArray(loose.constraints),
  ].map((constraint, index) => normalizeConstraint(constraint, draft.packageId, index));
}

function validationStatus(draft: DraftIofPackageRuntime, key: string): EngineeringComplianceStatus | undefined {
  const checks = asArray<Record<string, unknown>>(draft.validation?.checks);
  const match = checks.find((check) => String(check.key ?? "").toLowerCase().includes(key) || String(check.label ?? "").toLowerCase().includes(key));
  const status = String(match?.status ?? "").toUpperCase();
  if (status === "PASS" || status === "WARNING" || status === "FAIL") return status;
  return undefined;
}

function complianceStatus(condition: boolean, pending = false): EngineeringComplianceStatus {
  if (condition) return "PASS";
  return pending ? "PENDING" : "WARNING";
}

function expectedStationCount(routeLengthFeet: number, intervalFeet: number) {
  if (routeLengthFeet <= 0 || intervalFeet <= 0) return 0;
  const baseCount = Math.floor(routeLengthFeet / intervalFeet) + 1;
  const finalMeasure = (baseCount - 1) * intervalFeet;
  return Math.abs(routeLengthFeet - finalMeasure) < 0.001 ? baseCount : baseCount + 1;
}

function stationCoordinateComplete(station: EngineeringPackageStation) {
  const raw = station.raw;
  const lat = asNumber(raw.lat, station.coordinate?.[1]);
  const lng = asNumber(raw.lng, station.coordinate?.[0]);
  return Boolean(
    station.coordinate &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(station.stationFeet) &&
    station.label,
  );
}

function stationGraphReferencesValid(graph: StationIndexedGraph | undefined, stations: EngineeringPackageStation[]) {
  if (!graph?.edges?.length) return false;
  const stationIds = new Set(stations.map((station) => station.stationId));
  return graph.edges.every((edge) => stationIds.has(edge.fromStationId) && stationIds.has(edge.toStationId));
}

function buildCompliance(draft: DraftIofPackageRuntime, projection: Pick<EngineeringCertificationProjection, "routeCoordinates" | "routeLength" | "stations" | "objects" | "constraints" | "measuredSpine" | "stationAuthority" | "stationIndexedGraph" | "objectStationAttachments">): EngineeringComplianceRow[] {
  const loose = draft as Record<string, unknown>;
  const quantitySummary = asRecord(loose.quantitySummary);
  const pricingSummary = asRecord(loose.pricingSummary ?? draft.commercialSummary?.pricingSummary);
  const structureAssembly = asRecord(loose.structureAssembly);
  const conduitAssembly = asRecord(loose.conduitAssembly);
  const fiberAssembly = asRecord(loose.fiberAssembly);
  const crossingAssembly = asRecord(loose.crossingAssembly);
  const unresolvedConstraints = projection.constraints.filter((constraint) => !["RESOLVED", "ACCEPTED"].includes(constraint.status));
  const validation = draft.validation?.status;
  const measuredSpine = projection.measuredSpine;
  const measuredSpinePresent = Boolean(measuredSpine?.geometryHash && measuredSpine.coordinateCount > 1);
  const spinePresent = Boolean(measuredSpine && measuredSpine.routeLengthFeet > 0);
  const geometryLengthMiles = measuredSpine?.routeLengthMiles ?? (projection.routeLength > 0 ? Number((projection.routeLength / 5280).toFixed(2)) : 0);
  const geometryDetail = measuredSpinePresent
    ? `Coordinates ${measuredSpine?.coordinateCount.toLocaleString()}. Length ${geometryLengthMiles.toLocaleString()} mi. Measured spine ${measuredSpine?.geometryHash}.`
    : "Coordinates 0. Projected NO. Reason: No measured spine authority present in Draft IOF Package.";
  const stationAuthority = projection.stationAuthority;
  const intervalFeet = asNumber(stationAuthority?.intervalFeet, 0);
  const stationCountExpected = measuredSpine && intervalFeet ? expectedStationCount(measuredSpine.routeLengthFeet, intervalFeet) : 0;
  const stationingPass = Boolean(stationAuthority && stationCountExpected > 0 && projection.stations.length === stationCountExpected);
  const stationCoordinatesPass = Boolean(stationAuthority && projection.stations.length > 0 && projection.stations.every(stationCoordinateComplete));
  const graphPass = stationGraphReferencesValid(projection.stationIndexedGraph, projection.stations);
  const attachments = projection.objectStationAttachments ?? [];
  const objectAttachmentPass = projection.objects.length === 0 ||
    (attachments.length >= projection.objects.length && attachments.every((attachment) => (
      attachment.attachmentStatus === "EXCEPTED" ||
      (Boolean(attachment.attachmentMethod) &&
        attachment.attachmentMethod !== "UNRESOLVED" &&
        attachment.attachmentStatus !== "UNRESOLVED")
    )));
  const rows: Array<[typeof PD001_COMPLIANCE_CATEGORIES[number], EngineeringComplianceStatus, string]> = [
    ["geometry", measuredSpinePresent ? "PASS" : "FAIL", geometryDetail],
    ["spine", spinePresent ? "PASS" : "FAIL", measuredSpine ? `${measuredSpine.spineId} / ${measuredSpine.routeLengthFeet.toLocaleString()} ft` : "measured spine authority missing"],
    ["stationing", stationingPass ? "PASS" : "FAIL", stationAuthority ? `${projection.stations.length.toLocaleString()} stations / expected ${stationCountExpected.toLocaleString()} at ${intervalFeet.toLocaleString()} ft` : "station authority missing"],
    ["station-to-coordinate", stationCoordinatesPass ? "PASS" : "FAIL", stationCoordinatesPass ? "every authorized station has measure and coordinate" : "station coordinate map incomplete or missing"],
    ["graph", graphPass ? "PASS" : "FAIL", projection.stationIndexedGraph ? `${projection.stationIndexedGraph.edgeCount.toLocaleString()} station-indexed graph edges` : "station-indexed graph missing"],
    ["objects", complianceStatus(projection.objects.length > 0), `${projection.objects.length.toLocaleString()} objects`],
    ["object attachment", objectAttachmentPass ? "PASS" : "FAIL", objectAttachmentPass ? `${attachments.length.toLocaleString()} object station attachments` : "one or more objects are unresolved or attachment authority is missing"],
    ["structures", complianceStatus(asNumber(structureAssembly.structureCount, asArray(draft.structures).length) > 0), `${asNumber(structureAssembly.structureCount, asArray(draft.structures).length).toLocaleString()} structures`],
    ["conduit", complianceStatus(asNumber(conduitAssembly.conduitFeet) > 0 || projection.objects.some((object) => object.objectType.includes("CONDUIT"))), `${asNumber(conduitAssembly.conduitFeet).toLocaleString()} conduit feet`],
    ["fiber", complianceStatus(asNumber(fiberAssembly.fiberFeet) > 0 || projection.objects.some((object) => object.objectType.includes("FIBER"))), `${asNumber(fiberAssembly.fiberFeet).toLocaleString()} fiber feet`],
    ["ILA / regen facilities", complianceStatus(projection.objects.some((object) => object.objectType.includes("ILA") || object.objectType.includes("REGEN")), true), "facility objects projected from package"],
    ["crossings", complianceStatus(asNumber(crossingAssembly.crossingCount) > 0 || projection.objects.some((object) => object.objectType.includes("CROSSING")), true), `${asNumber(crossingAssembly.crossingCount).toLocaleString()} crossings`],
    ["quantities", complianceStatus(Object.keys(quantitySummary).length > 0), `${Object.keys(quantitySummary).length.toLocaleString()} quantity keys`],
    ["pricing summary", complianceStatus(Object.keys(pricingSummary).length > 0), Object.keys(pricingSummary).length ? "pricing summary present" : "pricing summary pending"],
    ["O&M", "PENDING", "O&M remains downstream of certification"],
    ["constraints", unresolvedConstraints.length ? "WARNING" : "PASS", unresolvedConstraints.length ? `${unresolvedConstraints.length.toLocaleString()} unresolved constraints` : "constraints resolved or accepted"],
    ["engineering readiness", validation === "FAIL" ? "FAIL" : draft.engineeringReadiness?.includes("BLOCKED") ? "FAIL" : draft.engineeringReadiness?.includes("READY") ? "PASS" : "WARNING", draft.engineeringReadiness ?? "PENDING"],
  ];
  return rows.map(([key, status, detail]) => ({ key, label: key, status, detail }));
}

function objectStyle(object: EngineeringPackageObject) {
  if (object.objectType.includes("ILA") || object.objectType.includes("REGEN")) return { fill: "#f97316", stroke: "#7c2d12", radius: 8 };
  if (object.objectType.includes("VAULT") || object.objectType.includes("HANDHOLE")) return { fill: "#facc15", stroke: "#713f12", radius: 6 };
  if (object.objectType.includes("FIBER")) return { fill: "#38bdf8", stroke: "#075985", radius: 5 };
  if (object.objectType.includes("CONDUIT")) return { fill: "#34d399", stroke: "#065f46", radius: 5 };
  return { fill: "#fb7185", stroke: "#881337", radius: 6 };
}

function stationForReference(stations: EngineeringPackageStation[], reference: unknown) {
  const text = String(reference ?? "");
  if (!text) return undefined;
  return stations.find((station) => station.stationId === text || station.label === text || String(station.raw.id ?? "") === text);
}

function packageRouteSegments(draft: DraftIofPackageRuntime) {
  const loose = draft as Record<string, unknown>;
  const doctrineAssembly = asRecord(loose.productDoctrineAssembly);
  return [
    ...asArray<Record<string, unknown>>(loose.routeSegments),
    ...asArray<Record<string, unknown>>(doctrineAssembly.routeSegments),
    ...asArray<Record<string, unknown>>(loose.route).filter((route) => asString(route.fromStationId ?? route.toStationId) || firstCoordinateList(route.geometry, route.coordinates).length > 1),
  ];
}

function packageGraphPrimitives(projection: Omit<EngineeringCertificationProjection, "mapSpec">, packageId: string): MapKernelPrimitive[] {
  const segments = packageRouteSegments(projection.sourceDraftPackage);
  const primitives: MapKernelPrimitive[] = [];
  const stationGraph = projection.stationIndexedGraph ?? stationIndexedGraphFromPackage(projection.sourceDraftPackage);
  if (stationGraph?.edges?.length) {
    stationGraph.edges.forEach((edge) => {
      const fromStation = stationForReference(projection.stations, edge.fromStationId);
      const toStation = stationForReference(projection.stations, edge.toStationId);
      if (!fromStation?.coordinate || !toStation?.coordinate) return;
      primitives.push({
        id: `${edge.edgeId}:graph-edge`,
        layerId: "edge",
        kind: "line",
        coordinates: [fromStation.coordinate, toStation.coordinate],
        label: `Station graph ${fromStation.label} to ${toStation.label}`,
        payload: edge,
        style: { stroke: "#f59e0b", strokeWidth: 2, opacity: 0.72, dasharray: "2 4" },
        metadata: {
          source: "Draft IOF Package",
          sourceLayer: "ENGINEERING_CERTIFICATION_STATION_INDEXED_GRAPH",
          renderAuthority: "STATION_INDEXED_GRAPH_AUTHORITY",
          packageId,
          graphId: stationGraph.graphId,
          geometryHash: edge.geometryHash,
        },
        ref: { kind: "Edge", id: edge.edgeId, edgeId: edge.edgeId, scopeVersionId: "draft-iof-certification" },
      });
    });
  }
  if (primitives.length) return primitives;
  if (segments.length) {
    segments.forEach((segment, index) => {
      const fromStation = stationForReference(projection.stations, segment.fromStationId ?? segment.fromStation ?? segment.from);
      const toStation = stationForReference(projection.stations, segment.toStationId ?? segment.toStation ?? segment.to);
      const coordinates = firstCoordinateList(segment.geometry, segment.coordinates, segment.routeGeometry, [
        fromStation?.coordinate,
        toStation?.coordinate,
      ]);
      if (coordinates.length < 2) return;
      const segmentId = asString(segment.segmentId ?? segment.edgeId ?? segment.id, `${packageId}:GRAPH-EDGE:${String(index + 1).padStart(3, "0")}`);
      primitives.push({
        id: `${segmentId}:graph-edge`,
        layerId: "edge",
        kind: "line",
        coordinates,
        label: asString(segment.label ?? segment.name, `Package graph edge ${index + 1}`),
        payload: segment,
        style: { stroke: "#f59e0b", strokeWidth: 2, opacity: 0.82, dasharray: "5 4" },
        metadata: {
          source: "Draft IOF Package",
          sourceLayer: "ENGINEERING_CERTIFICATION_GRAPH",
          renderAuthority: "Draft IOF Package Projection",
          packageId,
          graphId: projection.sourceDraftPackage.dependencyGraph?.graphId,
        },
        ref: { kind: "Edge", id: segmentId, edgeId: segmentId, scopeVersionId: "draft-iof-certification" },
      });
    });
  }
  if (!primitives.length && projection.stations.length > 1) {
    projection.stations.slice(0, -1).forEach((station, index) => {
      const next = projection.stations[index + 1];
      if (!station.coordinate || !next.coordinate) return;
      const edgeId = `${packageId}:STATION-GRAPH:${String(index + 1).padStart(3, "0")}`;
      primitives.push({
        id: `${edgeId}:graph-edge`,
        layerId: "edge",
        kind: "line",
        coordinates: [station.coordinate, next.coordinate],
        label: `Station graph edge ${index + 1}`,
        style: { stroke: "#f59e0b", strokeWidth: 2, opacity: 0.65, dasharray: "3 5" },
        metadata: {
          source: "Draft IOF Package",
          sourceLayer: "ENGINEERING_CERTIFICATION_GRAPH",
          renderAuthority: "Draft IOF Package Station Graph",
          packageId,
          graphId: projection.sourceDraftPackage.dependencyGraph?.graphId,
        },
        ref: { kind: "Edge", id: edgeId, edgeId, scopeVersionId: "draft-iof-certification" },
      });
    });
  }
  return primitives;
}

function draftIofRouteFeature(projection: Omit<EngineeringCertificationProjection, "mapSpec">): MapKernelGeoJsonFeature | undefined {
  if (projection.routeCoordinates.length < 2) return undefined;
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: projection.routeCoordinates,
    },
    properties: {
      source: "DRAFT_IOF_PACKAGE",
      packageId: projection.packageId,
      authority: "ENGINEERING_CERTIFICATION",
      layer: "ENGINEERING_CENTERLINE",
      coordinateCount: projection.routeCoordinates.length,
      routeLengthFeet: projection.routeLength,
      noScopeVersionCreation: true,
    },
  };
}

function engineeringCertificationDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("hyperlinx:debug:engineering-certification") === "1";
  } catch {
    return false;
  }
}

function debugEngineeringProjection(payload: Record<string, unknown>) {
  if (!engineeringCertificationDebugEnabled()) return;
  console.debug("ENGINEERING CERTIFICATION PROJECTION", payload);
}

function renderCertificationSpec(projection: Omit<EngineeringCertificationProjection, "mapSpec">): MapKernelRenderSpec {
  const primitives: MapKernelPrimitive[] = [];
  const packageId = projection.packageId;
  const routeFeature = draftIofRouteFeature(projection);
  const routeFeatureCoordinates = coordinatesFrom(routeFeature?.geometry.coordinates);
  const centerlineCoordinates = firstCoordinateList(routeFeatureCoordinates, projection.centerlineCoordinates);
  if (centerlineCoordinates.length > 1) {
    primitives.push({
      id: `${packageId}:centerline`,
      layerId: "iofPackage",
      kind: "line",
      coordinates: centerlineCoordinates,
      label: "Draft IOF centerline",
      style: { stroke: "#38bdf8", strokeWidth: 5, opacity: 0.82 },
      metadata: {
        source: "Draft IOF Package",
        sourceLayer: "ENGINEERING_CERTIFICATION_CENTERLINE",
        renderAuthority: "Draft IOF Package Projection",
        packageId,
        canonicalGeoJsonFeature: routeFeature,
      },
      ref: { kind: "Route", id: `${packageId}:centerline`, routeId: `${packageId}:centerline`, scopeVersionId: "draft-iof-certification" },
    });
  }
  if (projection.routeCoordinates.length > 1) {
    primitives.push({
      id: `${packageId}:spine`,
      layerId: "routeAuthorityDraft",
      kind: "line",
      coordinates: projection.routeCoordinates,
      label: "Measured spine",
      style: { stroke: "#22c55e", strokeWidth: 3, opacity: 0.9, dasharray: "8 5" },
      metadata: {
        source: "Draft IOF Package",
        sourceLayer: "ENGINEERING_CERTIFICATION_MEASURED_SPINE",
        renderAuthority: "MEASURED_SPINE_AUTHORITY",
        packageId,
        geometryHash: projection.measuredSpine?.geometryHash,
      },
      ref: { kind: "Route", id: `${packageId}:spine`, routeId: projection.measuredSpine?.spineId ?? `${packageId}:spine`, scopeVersionId: "draft-iof-certification" },
    });
  }
  primitives.push(...packageGraphPrimitives(projection, packageId));
  const lastStationIndex = projection.stations.length - 1;
  projection.stations.forEach((station, index) => {
    if (!station.coordinate) return;
    const isMajorStation = index === 0 ||
      index === lastStationIndex ||
      station.stationClass === "MAJOR" ||
      Math.abs(station.stationFeet % 5280) < 1;
    primitives.push({
      id: `${station.stationId}:point`,
      layerId: "station",
      kind: "point",
      coordinate: station.coordinate,
      label: station.label,
      style: { fill: isMajorStation ? "#fde68a" : "#bfdbfe", stroke: isMajorStation ? "#713f12" : "#1d4ed8", radius: isMajorStation ? 4 : 2.5, opacity: isMajorStation ? 0.95 : 0.68 },
      metadata: { stationFeet: station.stationFeet, source: "Draft IOF Package", sourceLayer: "ENGINEERING_CERTIFICATION_STATIONS", renderAuthority: "STATION_AUTHORITY", packageId, geometryHash: station.geometryHash },
      ref: { kind: "Station", id: station.stationId, stationId: station.stationId, scopeVersionId: "draft-iof-certification" },
    });
    if (!isMajorStation) return;
    primitives.push({
      id: `${station.stationId}:label`,
      layerId: "station",
      kind: "label",
      coordinate: station.coordinate,
      label: station.label,
      style: { fill: "#172554", fontSize: 11, fontWeight: 800 },
      metadata: { stationFeet: station.stationFeet, source: "Draft IOF Package", sourceLayer: "ENGINEERING_CERTIFICATION_MAJOR_STATION_LABELS", renderAuthority: "STATION_AUTHORITY", packageId, geometryHash: station.geometryHash },
      ref: { kind: "Station", id: station.stationId, stationId: station.stationId, scopeVersionId: "draft-iof-certification" },
    });
  });
  projection.objects.forEach((object) => {
    if (!object.coordinate) return;
    primitives.push({
      id: `${object.objectId}:point`,
      layerId: "object",
      kind: "point",
      coordinate: object.coordinate,
      label: object.objectType,
      style: objectStyle(object),
      payload: object.raw,
      metadata: {
        source: "Draft IOF Package",
        sourceLayer: "ENGINEERING_CERTIFICATION_STATION_INDEXED_OBJECTS",
        renderAuthority: "OBJECT_STATION_ATTACHMENT_AUTHORITY",
        packageId,
        attachmentMethod: object.attachmentMethod,
        attachmentStatus: object.attachmentStatus,
      },
      ref: { kind: "Object", id: object.objectId, objectId: object.objectId, scopeVersionId: "draft-iof-certification" },
    });
  });
  projection.constraints.forEach((constraint) => {
    const station = projection.stations.find((item) => item.stationId === constraint.station || item.label === constraint.station);
    if (!station?.coordinate) return;
    primitives.push({
      id: `${constraint.constraintId}:point`,
      layerId: "object",
      kind: "point",
      coordinate: station.coordinate,
      label: constraint.category,
      style: { fill: "#ef4444", stroke: "#7f1d1d", radius: 9, opacity: 0.72 },
      payload: constraint,
      metadata: { source: "Engineering Certification", sourceLayer: "ENGINEERING_CERTIFICATION_CONSTRAINTS", renderAuthority: "Engineering Constraint", packageId },
      ref: { kind: "Constraint", id: constraint.constraintId, objectId: constraint.constraintId, scopeVersionId: "draft-iof-certification" },
    });
  });
  return {
    specId: `engineering-certification:${packageId}`,
    sourceType: "IOFPackage",
    sourceId: packageId,
    name: "Engineering Certification Draft IOF Projection",
    primitives,
    features: routeFeature ? [routeFeature] : [],
    metadata: {
      packageId,
      scopeVersionId: "draft-iof-certification",
      rootScopeVersionId: "draft-iof-certification",
      sourceAuthority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
      noScopeVersionCreation: true,
    },
  };
}

export function buildEngineeringCertificationProjection(draft: DraftIofPackageRuntime): EngineeringCertificationProjection {
  const loose = draft as Record<string, unknown>;
  const measuredSpine = measuredSpineFromPackage(draft);
  const stationAuthority = stationAuthorityFromPackage(draft);
  const stationIndexedGraph = stationIndexedGraphFromPackage(draft);
  const objectStationAttachments = objectStationAttachmentsFromPackage(draft);
  const routeCoordinates = routeCoordinatesFromPackage(draft);
  const centerlineCoordinates = centerlineCoordinatesFromPackage(draft, routeCoordinates);
  const stations = normalizeStations(draft, routeCoordinates);
  const objects = normalizeObjects(draft, stations);
  const constraints = constraintsFromPackage(draft);
  const routeLength = asNumber(measuredSpine?.routeLengthFeet ?? asRecord(loose.quantitySummary).routeFeet ?? asRecord(draft.commercialSummary).routeFeet, routeCoordinates.length ? asNumber(asRecord(draft.commercialSummary).routeMiles) * 5280 : 0);
  const facilityCount = objects.filter((object) => object.objectType.includes("ILA") || object.objectType.includes("REGEN") || object.objectType.includes("FACILITY")).length;
  const partial: Omit<EngineeringCertificationProjection, "mapSpec" | "compliance"> = {
    packageId: draft.packageId,
    draftPackageId: draft.draftPackageId,
    customer: asString(draft.customerSummary?.name ?? draft.customerId, "Unknown customer"),
    account: asString((draft as Record<string, unknown>).accountId ?? draft.customerSummary?.accountId, "Unknown account"),
    opportunityPackageId: `${draft.opportunityId || "Opportunity pending"} / ${draft.packageId}`,
    productIdName: `${draft.productId || "Product pending"} / ${draft.productName || "name pending"}`,
    doctrineIdVersion: `${asString(loose.doctrineId, "PD-001")} / ${asString(loose.productDoctrineVersion ?? loose.doctrineVersion, "version pending")}`,
    draftPackageRevision: asNumber(draft.packageRevision, 0),
    routeLength,
    routeCoordinates,
    centerlineCoordinates,
    stationCount: stations.length,
    objectCount: objects.length,
    facilityCount,
    commercialStatus: draft.status,
    engineeringStatus: draft.engineeringReadiness ?? draft.workflowStatus,
    validationReadinessStatus: `${draft.validation?.status ?? "PENDING"} / ${draft.packageReadiness?.status ?? "PENDING"}`,
    stations,
    objects,
    constraints,
    measuredSpine,
    stationAuthority,
    stationIndexedGraph,
    objectStationAttachments,
    stationMoveAllowed: false,
    sourceDraftPackage: draft,
  };
  const compliance = buildCompliance(draft, partial);
  const projectionWithoutMap = { ...partial, compliance };
  const mapSpec = renderCertificationSpec(projectionWithoutMap);
  debugEngineeringProjection({
    packageId: draft.packageId,
    routeLengthFt: routeLength,
    geometryCoordinateCount: loose.geometryCoordinateCount,
    extractedRouteCoordinateCount: routeCoordinates.length,
    mapSpecFeatureCount: mapSpec.features?.length ?? 0,
    mapSpecPrimitiveCount: mapSpec.primitives.length,
    measuredSpineAuthority: measuredSpine?.geometryHash,
    stationAuthorityCount: stationAuthority?.stationCount ?? 0,
  });
  return {
    ...projectionWithoutMap,
    mapSpec,
  };
}

export function canMoveEngineeringObjectToStation(object: EngineeringPackageObject | null | undefined) {
  return Boolean(object?.movable);
}

export function engineeringCertificationReady(projection: EngineeringCertificationProjection) {
  const hasFailingCompliance = projection.compliance.some((row) => row.status === "FAIL");
  const unresolvedConstraints = projection.constraints.filter((constraint) => !["RESOLVED", "ACCEPTED"].includes(constraint.status));
  return !hasFailingCompliance && unresolvedConstraints.length === 0;
}

export function buildEngineeringCertificationChecklist(
  projection: EngineeringCertificationProjection,
  engineeringNotes: string,
  certificationConfidence = 92,
) {
  const complianceOk = !projection.compliance.some((row) => row.status === "FAIL");
  const constraintsOk = projection.constraints.every((constraint) => ["RESOLVED", "ACCEPTED"].includes(constraint.status));
  return {
    geometryComplete: projection.routeCoordinates.length > 1,
    existingInventoryValidated: true,
    customerDesignReviewed: true,
    relationshipsValidated: true,
    dependenciesValidated: true,
    evidencePresent: true,
    commercialAssumptionsReviewed: true,
    unitQuantitiesVerified: complianceOk,
    engineeringStandardsMet: complianceOk,
    riskAccepted: constraintsOk,
    packageComplete: complianceOk && constraintsOk,
    certificationConfidence,
    engineeringNotes,
    constraintsReviewed: projection.constraints.map((constraint) => constraint.constraintId),
    exceptionsApproved: asArray((projection.sourceDraftPackage as Record<string, unknown>).doctrineExceptions).map((item) => asRecord(item).exceptionId),
    redlineRevisionHistory: asArray((projection.sourceDraftPackage as Record<string, unknown>).redlineRevisionHistory),
    objectMoveHistory: asArray((projection.sourceDraftPackage as Record<string, unknown>).objectMoveHistory),
    finalEngineeringManifest: projection.sourceDraftPackage.engineeringManifest ?? projection.sourceDraftPackage.manifest,
    readinessForScopeVersionPromotion: complianceOk && constraintsOk,
  };
}
