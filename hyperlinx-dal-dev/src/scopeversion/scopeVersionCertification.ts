import type {
  InventoryGraph,
  InventoryNode,
  InventoryRoute,
  ScopeVersion,
  ScopeVersionCertificationState,
  ScopeVersionGraphSummary,
  ValidationStatus,
} from "../types/dal";

export type ScopeVersionCertificationCheck = {
  label: string;
  status: ValidationStatus;
  detail: string;
};

export type ScopeVersionCertificationResult = {
  certificationState: ScopeVersionCertificationState;
  status: ValidationStatus;
  graphSummary: ScopeVersionGraphSummary;
  checks: ScopeVersionCertificationCheck[];
  certifiedAt?: string;
  rejectedAt?: string;
};

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pass(label: string, detail: string): ScopeVersionCertificationCheck {
  return { label, status: "PASS", detail };
}

function fail(label: string, detail: string): ScopeVersionCertificationCheck {
  return { label, status: "FAIL", detail };
}

function warn(label: string, detail: string): ScopeVersionCertificationCheck {
  return { label, status: "WARNING", detail };
}

function graphRecords(scopeVersion: ScopeVersion, graph?: InventoryGraph) {
  const truth = asRecord(scopeVersion.canonicalTruth);
  const network = asRecord(truth.network);
  const nodes = graph?.nodes ?? asArray<InventoryNode>(truth.nodes) ?? asArray<InventoryNode>(network.nodes);
  const edges = graph?.edges ?? asArray<Record<string, unknown>>(truth.edges) ?? asArray<Record<string, unknown>>(network.edges);
  const stations = graph?.stations ?? asArray<Record<string, unknown>>(truth.stations) ?? asArray<Record<string, unknown>>(network.stations);
  const routes = graph?.routes ?? asArray<InventoryRoute>(truth.routes) ?? asArray<InventoryRoute>(network.routes);
  const objects = asArray<Record<string, unknown>>(truth.objects);
  return { nodes, edges, stations, routes, objects };
}

function nodeId(node: unknown) {
  const record = asRecord(node);
  return String(record.nodeId ?? record.id ?? "");
}

function routeId(route: unknown) {
  const record = asRecord(route);
  return String(record.routeId ?? record.id ?? "");
}

function objectId(object: unknown) {
  const record = asRecord(object);
  return String(record.objectId ?? record.id ?? "");
}

export function scopeVersionGraphSummary(scopeVersion: ScopeVersion, graph?: InventoryGraph): ScopeVersionGraphSummary {
  const records = graphRecords(scopeVersion, graph);
  return {
    nodeCount: Number(scopeVersion.graphSummary?.nodeCount ?? graph?.metadata.nodeCount ?? records.nodes.length ?? 0),
    edgeCount: Number(scopeVersion.graphSummary?.edgeCount ?? graph?.metadata.edgeCount ?? records.edges.length ?? 0),
    stationCount: Number(scopeVersion.graphSummary?.stationCount ?? graph?.metadata.stationCount ?? records.stations.length ?? 0),
    routeCount: Number(scopeVersion.graphSummary?.routeCount ?? graph?.metadata.routeCount ?? records.routes.length ?? 0),
  };
}

export function certifyScopeVersion(scopeVersion: ScopeVersion, graph?: InventoryGraph): ScopeVersionCertificationResult {
  const { nodes, edges, stations, routes, objects } = graphRecords(scopeVersion, graph);
  const routeIds = new Set(routes.map(routeId).filter(Boolean));
  const nodeIds = new Set(nodes.map(nodeId).filter(Boolean));
  const graphSummary = scopeVersionGraphSummary(scopeVersion, graph);
  const checks: ScopeVersionCertificationCheck[] = [];

  checks.push(routes.length ? pass("Routes Exist", `${routes.length.toLocaleString()} routes available.`) : fail("Routes Exist", "No routes found."));
  checks.push(stations.length ? pass("Stations Exist", `${stations.length.toLocaleString()} stations available.`) : fail("Stations Exist", "No stations found."));
  checks.push(nodes.length ? pass("Nodes Exist", `${nodes.length.toLocaleString()} nodes available.`) : fail("Nodes Exist", "No nodes found."));
  checks.push(edges.length ? pass("Edges Exist", `${edges.length.toLocaleString()} edges available.`) : fail("Edges Exist", "No edges found."));

  const invalidNodeRefs = edges.filter((edge) => {
    const record = asRecord(edge);
    const from = String(record.fromNodeId ?? record.from ?? "");
    const to = String(record.toNodeId ?? record.to ?? "");
    return !from || !to || !nodeIds.has(from) || !nodeIds.has(to);
  }).length;
  checks.push(
    invalidNodeRefs
      ? fail("Node References Valid", `${invalidNodeRefs.toLocaleString()} edge node references are missing or invalid.`)
      : pass("Node References Valid", "All edge node references resolve.")
  );

  const invalidEdgeRouteRefs = edges.filter((edge) => {
    const record = asRecord(edge);
    const id = String(record.routeId ?? "");
    return !id || !routeIds.has(id);
  }).length;
  checks.push(
    invalidEdgeRouteRefs
      ? fail("Edge References Valid", `${invalidEdgeRouteRefs.toLocaleString()} edge route references are missing or invalid.`)
      : pass("Edge References Valid", "All edge route references resolve.")
  );

  const invalidStationRouteRefs = stations.filter((station) => {
    const record = asRecord(station);
    const id = String(record.routeId ?? "");
    return !id || !routeIds.has(id);
  }).length;
  checks.push(
    invalidStationRouteRefs
      ? fail("Station References Valid", `${invalidStationRouteRefs.toLocaleString()} station route references are missing or invalid.`)
      : pass("Station References Valid", "All station route references resolve.")
  );

  const invalidObjects = objects.filter((object) => !objectId(object)).length;
  checks.push(
    objects.length
      ? invalidObjects
        ? fail("Object References Valid", `${invalidObjects.toLocaleString()} attached objects are missing object IDs.`)
        : pass("Object References Valid", "All attached objects have stable IDs.")
      : warn("Object References Valid", "No attached objects present on this ScopeVersion.")
  );

  const hasFailure = checks.some((check) => check.status === "FAIL");
  const hasWarning = checks.some((check) => check.status === "WARNING");
  const timestamp = new Date().toISOString();
  return {
    certificationState: hasFailure ? "REJECTED" : "CERTIFIED",
    status: hasFailure ? "FAIL" : hasWarning ? "WARNING" : "PASS",
    graphSummary,
    checks,
    certifiedAt: hasFailure ? undefined : timestamp,
    rejectedAt: hasFailure ? timestamp : undefined,
  };
}

export function applyScopeVersionCertification(scopeVersion: ScopeVersion, graph?: InventoryGraph): ScopeVersion {
  const certification = certifyScopeVersion(scopeVersion, graph);
  const certified = certification.certificationState === "CERTIFIED";
  return {
    ...scopeVersion,
    certificationState: certification.certificationState,
    isImmutable: certified,
    graphSummary: certification.graphSummary,
    updatedAt: new Date().toISOString(),
    canonicalTruth: {
      ...scopeVersion.canonicalTruth,
      certification,
      graphSummary: certification.graphSummary,
      constitutionalAuthority: certified ? "CERTIFIED_SCOPEVERSION" : "NON_AUTHORITATIVE",
    },
  };
}
