import type { DALCoordinate, ScopeVersion } from "../types/dal";
import { getAuthoritativeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import { isValidCoordinate } from "./MapViewportManager";
import type { MapKernelPrimitive, MapKernelRenderSpec } from "./MapLayerManager";

// Constitutional guardrail: this renderer consumes ScopeVersion canonical truth.
// Workspace maps must not generate independent authoritative geometry outside ScopeVersion lineage.
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function coordinateFrom(value: unknown): DALCoordinate | undefined {
  if (isValidCoordinate(value)) return value;
  const record = asRecord(value);
  const lon = Number(record.lon ?? record.lng ?? record.longitude);
  const lat = Number(record.lat ?? record.latitude);
  return isValidCoordinate([lon, lat]) ? [lon, lat] : undefined;
}

function coordinatesFrom(value: unknown): DALCoordinate[] {
  if (!Array.isArray(value)) return [];
  if (value.every(isValidCoordinate)) return value as DALCoordinate[];
  return value.map(coordinateFrom).filter((coord): coord is DALCoordinate => Boolean(coord));
}

function firstCoordinates(...values: unknown[]) {
  for (const value of values) {
    const coords = coordinatesFrom(value);
    if (coords.length) return coords;
  }
  return [];
}

function firstCoordinate(...values: unknown[]) {
  for (const value of values) {
    const coord = coordinateFrom(value);
    if (coord) return coord;
  }
  return undefined;
}

function labelForStation(station: Record<string, unknown>) {
  const label = station.label ?? station.stationLabel ?? station.stationId;
  const feet = Number(station.feet ?? station.stationFeet ?? station.measureFeet ?? 0);
  if (label) return String(label);
  if (!Number.isFinite(feet)) return "Station";
  const hundreds = Math.floor(feet / 100);
  const remainder = Math.round(feet % 100).toString().padStart(2, "0");
  return `${hundreds}+${remainder}`;
}

function stationStyleForState(state: unknown) {
  switch (state) {
    case "RELEASED":
      return { stroke: "#2563eb", fill: "#60a5fa", radius: 4 };
    case "IN_PROGRESS":
      return { stroke: "#ca8a04", fill: "#facc15", radius: 4 };
    case "COMPLETE":
      return { stroke: "#15803d", fill: "#22c55e", radius: 4 };
    case "BLOCKED":
      return { stroke: "#c2410c", fill: "#fb923c", radius: 5 };
    case "REJECTED":
      return { stroke: "#991b1b", fill: "#ef4444", radius: 5 };
    case "PLANNED":
    default:
      return { stroke: "#f59e0b", fill: "#fbbf24", radius: 3 };
  }
}

function objectStyleForType(type: unknown, category: unknown) {
  if (category === "CONSTRAINT") return { stroke: "#b91c1c", fill: "#fca5a5", radius: 4 };
  switch (type) {
    case "NETWORK_ATTACHMENT":
      return { stroke: "#c2410c", fill: "#f97316", radius: 6 };
    case "HANDHOLE":
    case "VAULT":
      return { stroke: "#4338ca", fill: "#818cf8", radius: 5 };
    case "DUCT":
    case "FIBER":
      return { stroke: "#6d28d9", fill: "#a78bfa", radius: 4 };
    case "BUILDING_ENTRANCE":
    case "SERVICE_LOCATION":
      return { stroke: "#0369a1", fill: "#38bdf8", radius: 5 };
    default:
      return undefined;
  }
}

function addPoint(args: {
  primitives: MapKernelPrimitive[];
  id: string;
  layerId: MapKernelPrimitive["layerId"];
  kind: MapKernelPrimitive["ref"]["kind"];
  coordinate?: DALCoordinate;
  label?: string;
  payload?: unknown;
  scopeVersionId: string;
  metadata?: MapKernelPrimitive["metadata"];
}) {
  if (!args.coordinate) return;
  args.primitives.push({
    id: args.id,
    layerId: args.layerId,
    kind: "point",
    coordinate: args.coordinate,
    label: args.label,
    payload: args.payload,
    metadata: args.metadata,
    ref: {
      kind: args.kind,
      id: args.id,
      scopeVersionId: args.scopeVersionId,
    },
  });
}

function assertScopeVersionTruth(scopeVersion: ScopeVersion) {
  if (!scopeVersion.canonicalTruth) {
    console.warn("MAP KERNEL SCOPEVERSION TRUTH MISSING", scopeVersion.scopeVersionId);
  }
}

export function renderScopeVersion(scopeVersion: ScopeVersion): MapKernelRenderSpec {
  assertScopeVersionTruth(scopeVersion);
  const truth = asRecord(scopeVersion.canonicalTruth);
  const networkBasis = asRecord(truth.networkBasis);
  const geographicBasis = asRecord(truth.geographicBasis);
  const primitives: MapKernelPrimitive[] = [];
  const scopeVersionId = scopeVersion.scopeVersionId;
  const parentScopeVersionId = scopeVersion.parentScopeVersionId;
  const rootScopeVersionId = String(scopeVersion.rootScopeVersionId ?? (truth.rootScopeVersionId as string | undefined) ?? parentScopeVersionId ?? scopeVersionId);
  const routeLayerId: MapKernelPrimitive["layerId"] = scopeVersion.source === "InventoryGraph" ? "inventory" : "scopeVersion";
  const renderAuthority = scopeVersion.source === "InventoryGraph" ? "Inventory Geometry" : parentScopeVersionId ? "Child Geometry" : "Certified Geometry";
  const routeId = String(networkBasis.routeId ?? scopeVersion.route?.["routeId" as keyof typeof scopeVersion.route] ?? `${scopeVersionId}-route`);
  const routeGeometry = firstCoordinates(
    geographicBasis.routeGeometry,
    geographicBasis.geometry,
    scopeVersion.geometry,
    asRecord(scopeVersion.route).coordinates,
    asRecord(truth.route).coordinates
  );
  const renderedRouteIds = new Set<string>();

  const addRoute = (args: { id: string; label: string; coordinates: DALCoordinate[]; payload: unknown }) => {
    if (args.coordinates.length < 2 || renderedRouteIds.has(args.id)) return;
    renderedRouteIds.add(args.id);
    primitives.push({
      id: `${scopeVersionId}:route:${args.id}`,
      layerId: routeLayerId,
      kind: "line",
      coordinates: args.coordinates,
      label: args.label,
      payload: args.payload,
      metadata: { sourceLayer: routeLayerId, rootScopeVersionId, parentScopeVersionId, renderAuthority },
      ref: { kind: "Route", id: args.id, scopeVersionId, routeId: args.id },
    });
  };

  const routeRecords = [...asArray(truth.routes), ...asArray(asRecord(truth.network).routes)];
  routeRecords.forEach((routeValue, index) => {
    const route = asRecord(routeValue);
    const coordinates = firstCoordinates(route.coordinates, route.geometry);
    const id = String(route.routeId ?? route.id ?? `${routeId}:${index}`);
    addRoute({
      id,
      label: String(route.name ?? route.label ?? id),
      coordinates,
      payload: routeValue,
    });
  });

  if (routeGeometry.length > 1) {
    addRoute({
      id: routeId,
      label: String(networkBasis.routeName ?? routeId),
      coordinates: routeGeometry,
      payload: { scopeVersion, routeId },
    });
  }

  const streetCenterlineRecords = [
    ...asArray(truth.streetCenterlines),
    ...asArray(geographicBasis.streetCenterlines),
    ...asArray(asRecord(truth.geographicTruth).streetCenterlines),
  ];
  streetCenterlineRecords.forEach((streetValue, index) => {
    const street = asRecord(streetValue);
    const coordinates = firstCoordinates(street.geometry, street.coordinates);
    if (coordinates.length < 2) return;
    const streetId = String(street.streetId ?? street.id ?? `${scopeVersionId}:street:${index}`);
    primitives.push({
      id: `${scopeVersionId}:street:${streetId}`,
      layerId: "streetReference",
      kind: "line",
      coordinates,
      label: String(street.streetName ?? street.name ?? streetId),
      payload: streetValue,
      metadata: { referenceLayer: true, minZoom: 13, source: "scopeversion-geographic-reference", sourceLayer: "streetReference", rootScopeVersionId, parentScopeVersionId, renderAuthority: "Geographic Reference" },
      ref: { kind: "StreetReference", id: streetId, scopeVersionId },
    });
  });

  const lateralGeometry = firstCoordinates(
    geographicBasis.lateralGeometry,
    asRecord(geographicBasis.buildPath).coordinates,
    asRecord(scopeVersion.buildPath).coordinates,
    asRecord(asRecord(scopeVersion.certificationSnapshot).lateralPath).geometry
  );
  if (lateralGeometry.length > 1) {
    primitives.push({
      id: `${scopeVersionId}:lateral`,
      layerId: "lateral",
      kind: "line",
      coordinates: lateralGeometry,
      payload: scopeVersion.certificationSnapshot,
      metadata: { sourceLayer: "lateral", rootScopeVersionId, parentScopeVersionId, renderAuthority: "Certified Geometry" },
      ref: { kind: "Lateral", id: `${scopeVersionId}:lateral`, scopeVersionId, routeId },
    });
  }

  const siteCoordinate = firstCoordinate(
    [Number(geographicBasis.candidateLongitude), Number(geographicBasis.candidateLatitude)],
    [Number(scopeVersion.longitude), Number(scopeVersion.latitude)],
    asRecord(scopeVersion.candidateSite).coordinate,
    scopeVersion.candidateSite
  );
  addPoint({
    primitives,
    id: String(scopeVersion.candidateSiteId ?? `${scopeVersionId}:site`),
    layerId: "site",
    kind: "Site",
    coordinate: siteCoordinate,
    label: String(asRecord(scopeVersion.candidateSite).companyName ?? scopeVersion.candidateSiteId ?? "Site"),
    payload: scopeVersion.candidateSite,
    scopeVersionId,
    metadata: { sourceLayer: "site", rootScopeVersionId, parentScopeVersionId, renderAuthority },
  });

  const snappedCoordinate = firstCoordinate(
    geographicBasis.snappedGeometry,
    truth.snappedCoordinate,
    asRecord(truth.snapCertification).snappedCoordinate,
    asRecord(truth.snapAuthority).snappedCoordinate
  );
  addPoint({
    primitives,
    id: String(truth.snapCertificationId ?? `${scopeVersionId}:street-snap`),
    layerId: "object",
    kind: "StreetSnap",
    coordinate: snappedCoordinate,
    label: String(truth.snappedStreetName ?? asRecord(truth.snapCertification).streetName ?? "Street snap"),
    payload: truth.snapCertification ?? truth.snapAuthority,
    scopeVersionId,
    metadata: { sourceLayer: "object", rootScopeVersionId, parentScopeVersionId, renderAuthority: "Certified Geometry" },
  });

  const attachmentCoordinate = firstCoordinate(
    networkBasis.attachmentCoordinates,
    networkBasis.attachmentPoint,
    geographicBasis.attachmentGeometry,
    scopeVersion.attachmentCoordinates,
    scopeVersion.attachmentPoint,
    asRecord(scopeVersion.certificationSnapshot).attachmentPoint
  );
  addPoint({
    primitives,
    id: String(networkBasis.attachmentId ?? `${scopeVersionId}:attachment`),
    layerId: "attachment",
    kind: "Attachment",
    coordinate: attachmentCoordinate,
    label: String(networkBasis.attachmentStrategy ?? "Attachment"),
    payload: networkBasis,
    scopeVersionId,
    metadata: { sourceLayer: "attachment", rootScopeVersionId, parentScopeVersionId, renderAuthority },
  });

  const stationRecords = [
    ...asArray(truth.stations),
    ...asArray(asRecord(truth.network).stations),
    scopeVersion.nearestStation,
    scopeVersion.station,
  ].filter(Boolean);
  console.log("[RENDER_AUTHORITY_STATIONS]", {
    stationCount: stationRecords.length,
  });
  const renderedStationAuthority = new Set<string>();
  stationRecords.forEach((stationValue, index) => {
    const station = asRecord(stationValue);
    const coordinate = firstCoordinate(station, station.coordinate, station.geometry, geographicBasis.stationGeometry);
    if (!coordinate) return;
    const stationId = String(station.stationId ?? station.id ?? networkBasis.stationId ?? `${scopeVersionId}:station:${index}`);
    const label = labelForStation(station);
    const stationFeet = Number(station.feet ?? station.stationFeet ?? station.measureFeet ?? 0);
    const stationAuthorityKey = `${scopeVersionId}:${routeId}:${stationId}:${coordinate[0]}:${coordinate[1]}:${label}`;
    if (renderedStationAuthority.has(stationAuthorityKey)) return;
    renderedStationAuthority.add(stationAuthorityKey);
    primitives.push({
      id: `${stationId}:point`,
      layerId: "station",
      kind: "point",
      coordinate,
      label,
      payload: stationValue,
      style: stationStyleForState(station.stationState),
      metadata: { stationFeet, sourceLayer: "station", rootScopeVersionId, parentScopeVersionId, renderAuthority, stationState: station.stationState },
      ref: { kind: "Station", id: stationId, scopeVersionId, routeId, stationId },
    });
    primitives.push({
      id: `${stationId}:label`,
      layerId: "station",
      kind: "label",
      coordinate,
      label,
      payload: stationValue,
      metadata: { stationFeet, sourceLayer: "station", rootScopeVersionId, parentScopeVersionId, renderAuthority, stationState: station.stationState },
      ref: { kind: "Station", id: stationId, scopeVersionId, routeId, stationId },
    });
  });

  const nodeRecords = [...asArray(truth.nodes), scopeVersion.nearestNode].filter(Boolean);
  nodeRecords.forEach((nodeValue, index) => {
    const node = asRecord(nodeValue);
    const coordinate = firstCoordinate(node, node.coordinate, node.geometry, geographicBasis.nodeGeometry);
    const nodeId = String(node.nodeId ?? node.id ?? networkBasis.nodeId ?? `${scopeVersionId}:node:${index}`);
    addPoint({
      primitives,
      id: nodeId,
      layerId: "node",
      kind: "Node",
      coordinate,
      label: nodeId,
      payload: nodeValue,
      scopeVersionId,
      metadata: { sourceLayer: "node", rootScopeVersionId, parentScopeVersionId, renderAuthority },
    });
  });

  asArray(truth.edges).forEach((edgeValue, index) => {
    const edge = asRecord(edgeValue);
    const coordinates = firstCoordinates(edge.coordinates, edge.geometry);
    if (coordinates.length < 2) return;
    const edgeId = String(edge.edgeId ?? edge.id ?? `${scopeVersionId}:edge:${index}`);
    primitives.push({
      id: edgeId,
      layerId: "edge",
      kind: "line",
      coordinates,
      payload: edgeValue,
      metadata: { sourceLayer: "edge", rootScopeVersionId, parentScopeVersionId, renderAuthority },
      ref: { kind: "Edge", id: edgeId, scopeVersionId, routeId, edgeId },
    });
  });

  asArray(truth.objects).forEach((objectValue, index) => {
    const object = asRecord(objectValue);
    const coordinate = firstCoordinate(object, object.coordinate, object.geometry);
    if (!coordinate) return;
    const objectId = String(object.objectId ?? object.id ?? `${scopeVersionId}:object:${index}`);
    primitives.push({
      id: objectId,
      layerId: "object",
      kind: "point",
      coordinate,
      label: String(object.label ?? object.name ?? object.objectType ?? object.type ?? "Object"),
      payload: objectValue,
      style: objectStyleForType(object.objectType, object.objectCategory),
      metadata: { sourceLayer: "object", rootScopeVersionId, parentScopeVersionId, renderAuthority, objectCategory: object.objectCategory, objectType: object.objectType },
      ref: { kind: "Object", id: objectId, scopeVersionId, stationId: String(object.stationId ?? ""), objectId },
    });
  });

  return {
    specId: `scope:${scopeVersionId}`,
    sourceType: "ScopeVersion",
    sourceId: scopeVersionId,
    name: scopeVersionId,
    primitives,
    metadata: {
      lifecycleState: getAuthoritativeLifecycleState(scopeVersion),
      inventoryId: scopeVersion.inventoryId,
      graphId: scopeVersion.graphId,
    },
  };
}
