type StationLike = {
  id?: string;
  stationId?: string;
  station?: string;
  label?: string;
  lat?: number;
  lon?: number;
  lng?: number;
  feet?: number;
  [key: string]: any;
};

type CloseRecord = {
  id: string;
  scope_version_id?: string;
  scopeVersionId?: string;
  corridor_id?: string;
  corridorId?: string;
  segment_id?: string;
  segmentId?: string;
  close_type?: string;
  closeType?: string;
  status?: string;
  payload?: any;
  station_id?: string;
  stationId?: string;
  created_at?: string;
  createdAt?: string;
  lat?: number;
  lon?: number;
};

type LoadedScope = {
  id?: string;
  scopeVersionId?: string;
  corridor_id?: string;
  corridorId?: string;
  segment_id?: string;
  segmentId?: string;
  created_at?: string;
  createdAt?: string;
  event?: string;
  canonicalTruth?: {
    route?: [number, number][];
    stations?: StationLike[];
    objects?: any[];
    constraints?: any;
    closeTaxonomy?: any;
    stateModel?: any;
    [key: string]: any;
  };
  stations?: StationLike[];
  route?: [number, number][];
  objects?: any[];
  events?: any[];
  closes?: CloseRecord[];
  [key: string]: any;
};

type GraphNode = {
  id: string;
  type: string;
  attributes?: any;
  location?: { lat: number; lng: number };
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: "physical" | "service" | "logical";
  ownership: "internal" | "external";
  attributes?: any;
};

type GraphEvent = {
  id: string;
  scopeVersionId: string;
  type: string;
  targetId: string;
  timestamp: number;
  payload?: any;
};

type GraphScopeVersion = {
  id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  events: GraphEvent[];
  metadata?: any;
};

function normalizeId(value: any): string {
  return value == null ? "" : String(value);
}

function getStationKey(station: StationLike, index: number): string {
  return (
    normalizeId(station.id) ||
    normalizeId(station.stationId) ||
    `station-${index}`
  );
}

function getStationLabel(station: StationLike, index: number): string {
  return (
    normalizeId(station.station) ||
    normalizeId(station.label) ||
    normalizeId(station.stationId) ||
    normalizeId(station.id) ||
    `Station ${index + 1}`
  );
}

function safeJsonParse(value: any) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractStations(scope: LoadedScope): StationLike[] {
  if (Array.isArray(scope?.canonicalTruth?.stations)) {
    return scope.canonicalTruth.stations;
  }
  if (Array.isArray(scope?.stations)) {
    return scope.stations;
  }
  return [];
}

function extractRoute(scope: LoadedScope): [number, number][] {
  if (Array.isArray(scope?.canonicalTruth?.route)) {
    return scope.canonicalTruth.route;
  }
  if (Array.isArray(scope?.route)) {
    return scope.route;
  }
  return [];
}

function buildNodes(stations: StationLike[]): GraphNode[] {
  return stations.map((station, index) => {
    const id = getStationKey(station, index);
    const lat =
      typeof station.lat === "number" ? station.lat : undefined;
    const lng =
      typeof station.lng === "number"
        ? station.lng
        : typeof station.lon === "number"
        ? station.lon
        : undefined;

    return {
      id,
      type: "station",
      attributes: station,
      location:
        typeof lat === "number" && typeof lng === "number"
          ? { lat, lng }
          : undefined,
    };
  });
}

function buildEdgesFromStations(nodes: GraphNode[]): GraphEdge[] {
  if (nodes.length < 2) return [];
  const edges: GraphEdge[] = [];

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const fromNode = nodes[i];
    const toNode = nodes[i + 1];

    edges.push({
      id: `edge-${fromNode.id}-${toNode.id}`,
      from: fromNode.id,
      to: toNode.id,
      type: "physical",
      ownership: "internal",
      attributes: { index: i },
    });
  }

  return edges;
}

function stationKeyList(stations: StationLike[]): string[] {
  return stations.map((s, i) => getStationKey(s, i));
}

function edgeIdForStationTarget(
  stationId: string,
  edgeIds: string[],
  stationIds: string[]
): string | null {
  const idx = stationIds.indexOf(stationId);
  if (idx < 0) return null;

  if (idx < edgeIds.length) {
    return edgeIds[idx];
  }

  if (idx - 1 >= 0 && idx - 1 < edgeIds.length) {
    return edgeIds[idx - 1];
  }

  return null;
}

function mapCloseEventToGraphEvent(
  close: CloseRecord,
  index: number,
  selectedScopeVersionId: string,
  edges: GraphEdge[],
  stations: StationLike[]
): GraphEvent | null {
  const closeType = normalizeId(close.close_type || close.closeType);
  const payload = safeJsonParse(close.payload) || {};
  const stationId = normalizeId(close.station_id || close.stationId);
  const stationIds = stationKeyList(stations);
  const edgeIds = edges.map((e) => e.id);
  const payloadTargetId = normalizeId(payload?.targetId);
  const created =
    close.created_at || close.createdAt || new Date().toISOString();
  const timestamp = Number(new Date(created)) || Date.now();

  if (!closeType) return null;

  let targetId: string = "";

  if (closeType === "block_edge") {
    targetId =
      payloadTargetId ||
      edgeIdForStationTarget(stationId, edgeIds, stationIds) ||
      edgeIds[0] ||
      "";
  } else if (
    closeType === "work.activated" ||
    closeType === "engineering_complete" ||
    closeType === "permit_approved" ||
    closeType === "construction_complete" ||
    closeType === "asbuilt_verified"
  ) {
    targetId = stationId || stationIds[0] || "";
  } else {
    targetId = payloadTargetId || stationId || "";
  }

  if (!targetId) return null;

  return {
    id: normalizeId(close.id) || `event-${index}`,
    scopeVersionId: selectedScopeVersionId,
    type: closeType === "block_edge" ? "block_edge" : "activate_node",
    targetId,
    timestamp,
    payload: close.payload,
  };
}

export function buildGraphScope(
  rawScope: LoadedScope | null,
  closes: CloseRecord[],
  selectedScopeVersionId: string,
  corridorId: string,
  segmentId: string | undefined
): GraphScopeVersion {
  const stations = extractStations(rawScope || {});
  const nodes = buildNodes(stations);
  const edges = buildEdgesFromStations(nodes);

  const graphEvents = closes
    .map((close, index) =>
      mapCloseEventToGraphEvent(close, index, selectedScopeVersionId, edges, stations)
    )
    .filter(Boolean) as GraphEvent[];

  return {
    id: selectedScopeVersionId || "control-derived",
    nodes,
    edges,
    events: graphEvents,
    metadata: {
      corridorId,
      segmentId: segmentId || null,
      source: "ControlPlane",
      routePointCount: extractRoute(rawScope || {}).length,
    },
  };
}

export { normalizeId, getStationKey, getStationLabel, extractStations, extractRoute };
export type {
  StationLike,
  CloseRecord,
  LoadedScope,
  GraphNode,
  GraphEdge,
  GraphEvent,
  GraphScopeVersion,
};
