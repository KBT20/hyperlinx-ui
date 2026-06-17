import type {
  DALCoordinate,
  HyperlinxInventoryPackage,
  InventoryEdge,
  InventoryGraph,
  InventoryNode,
  InventoryRoute,
  InventoryStation,
  ValidationStatus,
} from "../types/dal";

export type InventoryValidationCheckName =
  | "Missing nodes"
  | "Missing edges"
  | "Orphan nodes"
  | "Orphan stations"
  | "Duplicate IDs"
  | "Route references"
  | "Invalid geometry";

export type InventoryValidationCheck = {
  check: InventoryValidationCheckName;
  status: ValidationStatus;
  count: number;
  message: string;
  samples: string[];
};

export type InventoryValidationReport = {
  status: ValidationStatus;
  checkedAt: string;
  summary: {
    nodeCount: number;
    edgeCount: number;
    stationCount: number;
    routeCount: number;
    duplicateNodeIds: number;
    duplicateEdgeIds: number;
    missingNodeReferences: number;
    missingEdgeReferences: number;
    orphanNodeCount: number;
    orphanStationCount: number;
    invalidGeometryCount: number;
  };
  checks: InventoryValidationCheck[];
};

type GraphLike = Partial<InventoryGraph> | HyperlinxInventoryPackage;

const MAX_SAMPLES = 8;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function graphParts(graph: GraphLike) {
  return {
    nodes: asArray<InventoryNode>((graph as InventoryGraph).nodes),
    edges: asArray<InventoryEdge>((graph as InventoryGraph).edges),
    stations: asArray<InventoryStation>((graph as InventoryGraph).stations),
    routes: asArray<InventoryRoute>((graph as InventoryGraph).routes),
  };
}

function samplePush(samples: string[], value: unknown) {
  if (samples.length < MAX_SAMPLES) samples.push(String(value));
}

function coordinateIsValid(coord: unknown): coord is DALCoordinate {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const lon = Number(coord[0]);
  const lat = Number(coord[1]);
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function pointIsValid(lat: unknown, lon: unknown) {
  const nextLat = Number(lat);
  const nextLon = Number(lon);
  return Number.isFinite(nextLat) && Number.isFinite(nextLon) && nextLat >= -90 && nextLat <= 90 && nextLon >= -180 && nextLon <= 180;
}

function duplicateIds<T>(records: T[], idFor: (record: T) => unknown) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const missing: string[] = [];

  records.forEach((record, index) => {
    const raw = idFor(record);
    const id = typeof raw === "string" && raw.trim() ? raw.trim() : "";
    if (!id) {
      samplePush(missing, `missing-id-${index}`);
      return;
    }
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });

  return { seen, duplicateCount: duplicates.size, duplicateSamples: Array.from(duplicates).slice(0, MAX_SAMPLES), missing };
}

function statusFor(count: number, severity: "WARNING" | "FAIL" = "FAIL"): ValidationStatus {
  return count > 0 ? severity : "PASS";
}

function aggregateStatus(checks: InventoryValidationCheck[]): ValidationStatus {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "WARNING")) return "WARNING";
  return "PASS";
}

export function validateInventoryGraph(graph: GraphLike): InventoryValidationReport {
  const checkedAt = new Date().toISOString();
  const { nodes, edges, stations, routes } = graphParts(graph);
  const nodeIds = duplicateIds(nodes, (node) => node.nodeId);
  const edgeIds = duplicateIds(edges, (edge) => edge.edgeId);
  const routeIds = duplicateIds(routes, (route) => route.routeId);
  const stationIds = duplicateIds(stations, (station) => station.stationId);
  const referencedNodes = new Set<string>();
  const missingNodeSamples: string[] = [];
  const missingEdgeSamples: string[] = [];
  const orphanNodeSamples: string[] = [];
  const orphanStationSamples: string[] = [];
  const routeReferenceSamples: string[] = [];
  const invalidGeometrySamples: string[] = [];

  let missingNodeReferences = 0;
  let missingEdgeReferences = 0;
  let orphanStationCount = 0;
  let invalidGeometryCount = 0;
  let routeReferenceCount = 0;

  nodes.forEach((node) => {
    if (!pointIsValid(node.lat, node.lon)) {
      invalidGeometryCount += 1;
      samplePush(invalidGeometrySamples, node.nodeId || "node");
    }
  });

  edges.forEach((edge) => {
    const from = String(edge.fromNodeId ?? "");
    const to = String(edge.toNodeId ?? "");
    if (from) referencedNodes.add(from);
    if (to) referencedNodes.add(to);
    if (!from || !nodeIds.seen.has(from)) {
      missingNodeReferences += 1;
      samplePush(missingNodeSamples, `${edge.edgeId}:from=${from || "missing"}`);
    }
    if (!to || !nodeIds.seen.has(to)) {
      missingNodeReferences += 1;
      samplePush(missingNodeSamples, `${edge.edgeId}:to=${to || "missing"}`);
    }
    if (!edge.routeId || !routeIds.seen.has(edge.routeId)) {
      routeReferenceCount += 1;
      samplePush(routeReferenceSamples, `${edge.edgeId}:route=${edge.routeId || "missing"}`);
    }
    if (!Array.isArray(edge.coordinates) || edge.coordinates.length < 2 || edge.coordinates.some((coord) => !coordinateIsValid(coord))) {
      invalidGeometryCount += 1;
      samplePush(invalidGeometrySamples, edge.edgeId || "edge");
    }
  });

  routes.forEach((route) => {
    if (!route.routeId) {
      routeReferenceCount += 1;
      samplePush(routeReferenceSamples, "route missing routeId");
    }
    if (!Array.isArray(route.coordinates) || route.coordinates.length < 2 || route.coordinates.some((coord) => !coordinateIsValid(coord))) {
      invalidGeometryCount += 1;
      samplePush(invalidGeometrySamples, route.routeId || "route");
    }
    asArray<string>(route.edgeIds).forEach((edgeId) => {
      if (!edgeIds.seen.has(edgeId)) {
        missingEdgeReferences += 1;
        samplePush(missingEdgeSamples, `${route.routeId}:edge=${edgeId}`);
      }
    });
  });

  stations.forEach((station) => {
    if (!station.routeId || !routeIds.seen.has(station.routeId)) {
      orphanStationCount += 1;
      samplePush(orphanStationSamples, `${station.stationId}:route=${station.routeId || "missing"}`);
    }
    if (!pointIsValid(station.lat, station.lon)) {
      invalidGeometryCount += 1;
      samplePush(invalidGeometrySamples, station.stationId || "station");
    }
  });

  nodes.forEach((node) => {
    if (node.nodeId && !referencedNodes.has(node.nodeId)) samplePush(orphanNodeSamples, node.nodeId);
  });

  const duplicateIdCount =
    nodeIds.duplicateCount +
    edgeIds.duplicateCount +
    routeIds.duplicateCount +
    stationIds.duplicateCount +
    nodeIds.missing.length +
    edgeIds.missing.length +
    routeIds.missing.length +
    stationIds.missing.length;
  const orphanNodeCount = nodes.reduce((count, node) => count + (node.nodeId && !referencedNodes.has(node.nodeId) ? 1 : 0), 0);

  const checks: InventoryValidationCheck[] = [
    {
      check: "Missing nodes",
      status: statusFor(missingNodeReferences),
      count: missingNodeReferences,
      message: missingNodeReferences
        ? `${missingNodeReferences.toLocaleString()} edge endpoint references do not resolve to inventory nodes.`
        : "All edge endpoint references resolve to inventory nodes.",
      samples: missingNodeSamples,
    },
    {
      check: "Missing edges",
      status: statusFor(missingEdgeReferences),
      count: missingEdgeReferences,
      message: missingEdgeReferences
        ? `${missingEdgeReferences.toLocaleString()} route edge references do not resolve to inventory edges.`
        : "All route edge references resolve to inventory edges.",
      samples: missingEdgeSamples,
    },
    {
      check: "Orphan nodes",
      status: statusFor(orphanNodeCount, "WARNING"),
      count: orphanNodeCount,
      message: orphanNodeCount
        ? `${orphanNodeCount.toLocaleString()} nodes are not referenced by any edge.`
        : "All nodes participate in at least one edge.",
      samples: orphanNodeSamples,
    },
    {
      check: "Orphan stations",
      status: statusFor(orphanStationCount),
      count: orphanStationCount,
      message: orphanStationCount
        ? `${orphanStationCount.toLocaleString()} stations reference missing routes.`
        : "All stations reference known routes.",
      samples: orphanStationSamples,
    },
    {
      check: "Duplicate IDs",
      status: statusFor(duplicateIdCount),
      count: duplicateIdCount,
      message: duplicateIdCount
        ? `${duplicateIdCount.toLocaleString()} missing or duplicate IDs detected across graph collections.`
        : "Inventory node, edge, route, and station IDs are unique.",
      samples: [
        ...nodeIds.duplicateSamples,
        ...edgeIds.duplicateSamples,
        ...routeIds.duplicateSamples,
        ...stationIds.duplicateSamples,
        ...nodeIds.missing,
        ...edgeIds.missing,
        ...routeIds.missing,
        ...stationIds.missing,
      ].slice(0, MAX_SAMPLES),
    },
    {
      check: "Route references",
      status: statusFor(routeReferenceCount),
      count: routeReferenceCount,
      message: routeReferenceCount
        ? `${routeReferenceCount.toLocaleString()} edge or route records have missing route references.`
        : "Edges and routes maintain route references.",
      samples: routeReferenceSamples,
    },
    {
      check: "Invalid geometry",
      status: statusFor(invalidGeometryCount),
      count: invalidGeometryCount,
      message: invalidGeometryCount
        ? `${invalidGeometryCount.toLocaleString()} records have malformed or out-of-range coordinates.`
        : "Node, edge, route, and station geometry passed coordinate validation.",
      samples: invalidGeometrySamples,
    },
  ];

  return {
    status: aggregateStatus(checks),
    checkedAt,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      stationCount: stations.length,
      routeCount: routes.length,
      duplicateNodeIds: nodeIds.duplicateCount,
      duplicateEdgeIds: edgeIds.duplicateCount,
      missingNodeReferences,
      missingEdgeReferences,
      orphanNodeCount,
      orphanStationCount,
      invalidGeometryCount,
    },
    checks,
  };
}
