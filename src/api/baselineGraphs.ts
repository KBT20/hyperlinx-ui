import { CHICAGO_API } from "../config/api";
import type {
  BaselineGraph,
  BaselineGraphDetail,
  BaselineGraphEdge,
  BaselineGraphMetadata,
  BaselineGraphNode,
  CreateBaselineGraphPayload,
  GraphStation,
  InventoryScopeVersion,
  LonLat,
} from "../types/fiberlightBeta";

const LOCAL_GRAPH_METADATA_KEY = "hyperlinx.baselineGraphs";
const GRAPH_CHUNK_RECORD_LIMIT = 5000;

type GraphChunkType = "nodes" | "edges" | "stations" | "routes";

type GraphChunkUploadPayload = {
  inventoryId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkType: GraphChunkType;
  data: unknown[];
};

type GraphDetailParts = {
  metadata: BaselineGraphMetadata;
  inventoryScopeVersion?: InventoryScopeVersion;
  nodes: BaselineGraphNode[];
  edges: BaselineGraphEdge[];
  stations: GraphStation[];
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

function unwrapList(data: any) {
  const list = data?.baselineGraphs ?? data?.graphs ?? data?.items ?? data?.data ?? data;
  return Array.isArray(list) ? list : [];
}

function unwrapDetail(data: any) {
  return data?.baselineGraph ?? data?.graphDetail ?? data?.item ?? data?.data ?? data ?? {};
}

function normalizeNumber(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeBbox(value: any): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const bbox = value.slice(0, 4).map(Number);
  return bbox.every(Number.isFinite) ? (bbox as [number, number, number, number]) : null;
}

function normalizeChunkCounts(raw: any) {
  const value = raw?.chunkCounts ?? raw?.chunk_counts ?? raw?.metadata?.chunkCounts ?? raw?.metadata?.chunk_counts;
  if (!value || typeof value !== "object") return undefined;
  return {
    nodes: normalizeNumber(value.nodes, value.nodeChunks, value.node_chunks),
    edges: normalizeNumber(value.edges, value.edgeChunks, value.edge_chunks),
    stations: normalizeNumber(value.stations, value.stationChunks, value.station_chunks),
    routes: normalizeNumber(value.routes, value.routeChunks, value.route_chunks),
  };
}

function chunkCountForRecords(records: unknown[]) {
  return Math.max(1, Math.ceil(records.length / GRAPH_CHUNK_RECORD_LIMIT));
}

function normalizeMetadata(raw: any): BaselineGraphMetadata {
  const graphSummary = raw.graphSummary ?? raw.graph_summary ?? raw.metadata?.graphSummary ?? raw.metadata?.graph_summary;
  const inventoryId = String(raw.inventoryId ?? raw.inventory_id ?? raw.id ?? raw.baselineGraphId ?? raw.baseline_graph_id ?? "");
  const nameValue =
    raw.name ??
    raw.inventoryName ??
    raw.inventory_name ??
    graphSummary?.name ??
    (inventoryId ? inventoryId : "Carrier network inventory");
  const bbox =
    normalizeBbox(raw.bbox) ??
    normalizeBbox(raw.bounds) ??
    normalizeBbox(graphSummary?.bbox) ??
    normalizeBbox(graphSummary?.bounds);

  return {
    inventoryId,
    name: String(nameValue),
    nodeCount: normalizeNumber(raw.nodeCount, raw.node_count, graphSummary?.nodeCount, graphSummary?.node_count),
    edgeCount: normalizeNumber(raw.edgeCount, raw.edge_count, graphSummary?.edgeCount, graphSummary?.edge_count),
    stationCount: normalizeNumber(raw.stationCount, raw.station_count, graphSummary?.stationCount, graphSummary?.station_count),
    routeMiles: normalizeNumber(raw.routeMiles, raw.route_miles, graphSummary?.routeMiles, graphSummary?.totalLengthMiles),
    bbox,
    connectedComponents:
      raw.connectedComponents !== undefined || graphSummary?.connectedComponents !== undefined
        ? normalizeNumber(raw.connectedComponents, raw.connected_components, graphSummary?.connectedComponents)
        : undefined,
    longestSegment:
      raw.longestSegment !== undefined || graphSummary?.longestSegment !== undefined
        ? normalizeNumber(raw.longestSegment, raw.longest_segment, graphSummary?.longestSegment)
        : undefined,
    chunkCounts: normalizeChunkCounts(raw),
    importedAt: String(raw.importedAt ?? raw.imported_at ?? raw.createdAt ?? raw.created_at ?? ""),
    baselineGraphId: raw.baselineGraphId ?? raw.baseline_graph_id ?? graphSummary?.baselineId,
    inventoryScopeVersionId: raw.inventoryScopeVersionId ?? raw.inventory_scope_version_id ?? raw.scopeVersionId ?? raw.scope_version_id,
    sourceFile: raw.sourceFile ?? raw.source_file ?? raw.sourceFilename ?? raw.source_filename,
    graphSummary,
  };
}

function normalizeNode(raw: any, index: number): BaselineGraphNode {
  const nodeId = String(raw.nodeId ?? raw.node_id ?? raw.id ?? `N-${index + 1}`);
  const lon = Number(raw.lon ?? raw.lng);
  const lat = Number(raw.lat);
  return {
    ...raw,
    id: String(raw.id ?? nodeId),
    nodeId,
    lat,
    lon,
    lng: Number.isFinite(Number(raw.lng)) ? Number(raw.lng) : lon,
  };
}

function normalizeLine(coords: any): LonLat[] {
  if (!Array.isArray(coords)) return [];
  return coords
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      return Number.isFinite(lon) && Number.isFinite(lat) ? ([lon, lat] as LonLat) : null;
    })
    .filter(Boolean) as LonLat[];
}

function normalizeEdge(raw: any, index: number): BaselineGraphEdge {
  const edgeId = String(raw.edgeId ?? raw.edge_id ?? raw.id ?? `E-${index + 1}`);
  const startNodeId = String(raw.startNodeId ?? raw.start_node_id ?? raw.fromNodeId ?? raw.from_node_id ?? "");
  const endNodeId = String(raw.endNodeId ?? raw.end_node_id ?? raw.toNodeId ?? raw.to_node_id ?? "");
  return {
    ...raw,
    id: String(raw.id ?? edgeId),
    edgeId,
    startNodeId,
    endNodeId,
    fromNodeId: String(raw.fromNodeId ?? raw.from_node_id ?? startNodeId),
    toNodeId: String(raw.toNodeId ?? raw.to_node_id ?? endNodeId),
    geometry: normalizeLine(raw.geometry ?? raw.coordinates),
    lengthFt: normalizeNumber(raw.lengthFt, raw.length_ft),
    startFeet: normalizeNumber(raw.startFeet, raw.start_feet),
    endFeet: normalizeNumber(raw.endFeet, raw.end_feet),
    routeId: raw.routeId ?? raw.route_id,
    routeName: raw.routeName ?? raw.route_name,
  };
}

function normalizeStation(raw: any, index: number): GraphStation {
  const stationId = String(raw.stationId ?? raw.station_id ?? raw.id ?? `STA-${index + 1}`);
  const lon = Number(raw.lon ?? raw.lng);
  const lat = Number(raw.lat);
  return {
    ...raw,
    stationId,
    edgeId: String(raw.edgeId ?? raw.edge_id ?? ""),
    stationFeet: normalizeNumber(raw.stationFeet, raw.station_feet),
    lat,
    lon,
    lng: Number.isFinite(Number(raw.lng)) ? Number(raw.lng) : lon,
    intervalFt: normalizeNumber(raw.intervalFt, raw.interval_ft),
  };
}

function inventoryScopeVersionFromMetadata(metadata: BaselineGraphMetadata): InventoryScopeVersion {
  return {
    scopeVersionId: metadata.inventoryScopeVersionId ?? `inventory-scope-${metadata.inventoryId}`,
    type: "INVENTORY_SCOPEVERSION",
    inventoryId: metadata.inventoryId,
    baselineGraphId: metadata.baselineGraphId ?? metadata.inventoryId,
    sourceFile: metadata.sourceFile,
    importedAt: metadata.importedAt,
    nodeCount: metadata.nodeCount,
    edgeCount: metadata.edgeCount,
    stationCount: metadata.stationCount,
    status: "ACTIVE",
  };
}

function graphFromParts(parts: GraphDetailParts): BaselineGraph {
  return {
    baselineId: parts.metadata.baselineGraphId ?? parts.metadata.inventoryId,
    name: parts.metadata.name,
    datasetType: "BASELINE_GRAPH",
    geometry: [],
    fullGeometry: parts.edges.map((edge) => edge.geometry).filter((line) => line.length >= 2),
    nodes: parts.nodes,
    edges: parts.edges,
    stations: parts.stations,
    metadata: {
      inventoryId: parts.metadata.inventoryId,
      graphSummary: parts.metadata.graphSummary,
    },
  };
}

function detailFromParts(parts: GraphDetailParts): BaselineGraphDetail {
  const graph = graphFromParts(parts);
  return {
    graph,
    stations: parts.stations,
    metadata: parts.metadata,
    inventoryScopeVersion: parts.inventoryScopeVersion ?? inventoryScopeVersionFromMetadata(parts.metadata),
  };
}

function metadataFromPayload(payload: CreateBaselineGraphPayload): BaselineGraphMetadata {
  return {
    inventoryId: payload.inventoryId,
    name: payload.name,
    nodeCount: payload.nodes.length,
    edgeCount: payload.edges.length,
    stationCount: payload.stations.length,
    routeMiles: payload.graphSummary.routeMiles ?? payload.graphSummary.totalLengthMiles,
    bbox: payload.graphSummary.bbox ?? payload.graphSummary.bounds ?? null,
    connectedComponents: payload.graphSummary.connectedComponents,
    longestSegment: payload.graphSummary.longestSegment,
    chunkCounts: {
      nodes: chunkCountForRecords(payload.nodes),
      edges: chunkCountForRecords(payload.edges),
      stations: chunkCountForRecords(payload.stations),
      routes: payload.routes?.length ? chunkCountForRecords(payload.routes) : 0,
    },
    importedAt: payload.importedAt,
    baselineGraphId: payload.graphSummary.baselineId,
    inventoryScopeVersionId: `inventory-scope-${payload.inventoryId}`,
    sourceFile: payload.sourceFile,
    graphSummary: payload.graphSummary,
  };
}

function readLocalMetadata(): BaselineGraphMetadata[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_GRAPH_METADATA_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeMetadata).filter((item) => item.inventoryId) : [];
  } catch {
    return [];
  }
}

function writeLocalMetadata(records: BaselineGraphMetadata[]) {
  if (typeof localStorage === "undefined") return;
  const metadataOnly = records.map((record) => ({
    inventoryId: record.inventoryId,
    name: record.name,
    importedAt: record.importedAt,
    nodeCount: record.nodeCount,
    edgeCount: record.edgeCount,
    stationCount: record.stationCount,
    routeMiles: record.routeMiles,
    bbox: record.bbox,
    connectedComponents: record.connectedComponents,
    longestSegment: record.longestSegment,
    chunkCounts: record.chunkCounts,
    baselineGraphId: record.baselineGraphId,
    inventoryScopeVersionId: record.inventoryScopeVersionId,
    sourceFile: record.sourceFile,
  }));
  localStorage.setItem(LOCAL_GRAPH_METADATA_KEY, JSON.stringify(metadataOnly));
  console.log("BASELINE GRAPH LOCAL STORAGE DISABLED");
  console.log("METADATA ONLY STORED", {
    count: metadataOnly.length,
    bytes: new Blob([JSON.stringify(metadataOnly)]).size,
  });
}

function upsertLocalMetadata(metadata: BaselineGraphMetadata) {
  const records = readLocalMetadata();
  writeLocalMetadata([metadata, ...records.filter((item) => item.inventoryId !== metadata.inventoryId)]);
}

function mergeMetadata(primary: BaselineGraphMetadata[], fallback: BaselineGraphMetadata[]) {
  const byId = new Map<string, BaselineGraphMetadata>();
  [...fallback, ...primary].forEach((item) => {
    if (item.inventoryId) byId.set(item.inventoryId, item);
  });
  return Array.from(byId.values());
}

function estimateRecordsBytes(records: unknown[]) {
  if (!records.length) return 2;
  const sample = records.slice(0, Math.min(records.length, 100));
  const sampleBytes = new Blob([JSON.stringify(sample)]).size;
  return Math.ceil((sampleBytes / sample.length) * records.length);
}

function estimateGraphPayloadBytes(payload: CreateBaselineGraphPayload) {
  return (
    new Blob([
      JSON.stringify({
        inventoryId: payload.inventoryId,
        name: payload.name,
        graphSummary: payload.graphSummary,
        sourceFile: payload.sourceFile,
        importedAt: payload.importedAt,
        metadata: payload.metadata,
      }),
    ]).size +
    estimateRecordsBytes(payload.nodes) +
    estimateRecordsBytes(payload.edges) +
    estimateRecordsBytes(payload.stations) +
    estimateRecordsBytes(payload.routes ?? [])
  );
}

function chunkRecords<T>(records: T[], size = GRAPH_CHUNK_RECORD_LIMIT) {
  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += size) {
    chunks.push(records.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

async function uploadChunk(payload: GraphChunkUploadPayload) {
  console.log("GRAPH CHUNK UPLOAD START", {
    inventoryId: payload.inventoryId,
    chunkType: payload.chunkType,
    chunkIndex: payload.chunkIndex,
    totalChunks: payload.totalChunks,
    recordCount: payload.data.length,
  });
  console.log("BASELINE GRAPH CHUNK UPLOAD", {
    inventoryId: payload.inventoryId,
    chunkType: payload.chunkType,
    chunkIndex: payload.chunkIndex,
    totalChunks: payload.totalChunks,
    recordCount: payload.data.length,
  });
  console.log("CHUNK TYPE", payload.chunkType);
  console.log("CHUNK INDEX", payload.chunkIndex);
  console.log("CHUNK RECORD COUNT", payload.data.length);
  const data = await requestJson<any>(`${CHICAGO_API}/api/baseline-graphs/${encodeURIComponent(payload.inventoryId)}/chunks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log("GRAPH CHUNK UPLOAD COMPLETE", {
    inventoryId: payload.inventoryId,
    chunkType: payload.chunkType,
    chunkIndex: payload.chunkIndex,
  });
  return data;
}

async function uploadChunks<T>(inventoryId: string, chunkType: GraphChunkType, records: T[]) {
  const chunks = chunkRecords(records);
  let lastResponse: any = null;
  for (let index = 0; index < chunks.length; index++) {
    lastResponse = await uploadChunk({
      inventoryId,
      chunkIndex: index,
      totalChunks: chunks.length,
      chunkType,
      data: chunks[index] as unknown[],
    });
  }
  return lastResponse;
}

function normalizeDetail(raw: any): BaselineGraphDetail {
  const metadata = normalizeMetadata(raw.metadata ?? raw);
  const rawGraph = raw.graph ?? raw.baselineGraph ?? raw.baseline_graph ?? {};
  const nodes = Array.isArray(raw.nodes ?? rawGraph.nodes) ? (raw.nodes ?? rawGraph.nodes).map(normalizeNode) : [];
  const edges = Array.isArray(raw.edges ?? rawGraph.edges) ? (raw.edges ?? rawGraph.edges).map(normalizeEdge) : [];
  const stations = Array.isArray(raw.stations ?? rawGraph.stations) ? (raw.stations ?? rawGraph.stations).map(normalizeStation) : [];
  return detailFromParts({
    metadata,
    inventoryScopeVersion: raw.inventoryScopeVersion ?? raw.inventory_scope_version,
    nodes,
    edges,
    stations,
  });
}

function normalizeGraphPartRecords(chunkType: GraphChunkType, records: any[]) {
  if (chunkType === "nodes") return records.map(normalizeNode);
  if (chunkType === "edges") return records.map(normalizeEdge);
  if (chunkType === "stations") return records.map(normalizeStation);
  return records;
}

async function loadGraphPart(inventoryId: string, chunkType: GraphChunkType, totalChunks?: number) {
  const expectedChunks = Number(totalChunks);
  if (Number.isFinite(expectedChunks) && expectedChunks > 0) {
    const records: any[] = [];
    for (let chunkIndex = 0; chunkIndex < expectedChunks; chunkIndex++) {
      const data = await requestJson<any>(
        `${CHICAGO_API}/api/baseline-graphs/${encodeURIComponent(inventoryId)}/chunks/${chunkIndex}?chunkType=${encodeURIComponent(
          chunkType
        )}`
      );
      const detail = unwrapDetail(data);
      const rawRecords = detail.data ?? data.data ?? detail[chunkType] ?? data[chunkType] ?? [];
      const chunkRecords = Array.isArray(rawRecords) ? rawRecords : [];
      console.log("GRAPH DETAIL CHUNK", { inventoryId, chunkType, chunkIndex, totalChunks: expectedChunks, recordCount: chunkRecords.length });
      records.push(...chunkRecords);
    }
    return normalizeGraphPartRecords(chunkType, records);
  }

  const data = await requestJson<any>(
    `${CHICAGO_API}/api/baseline-graphs/${encodeURIComponent(inventoryId)}?chunkType=${encodeURIComponent(chunkType)}`
  );
  const detail = unwrapDetail(data);
  const rawRecords = detail[chunkType] ?? data[chunkType] ?? detail.data ?? data.data ?? [];
  const records = Array.isArray(rawRecords) ? rawRecords : [];
  console.log("GRAPH DETAIL CHUNK", { inventoryId, chunkType, recordCount: records.length });
  return normalizeGraphPartRecords(chunkType, records);
}

export async function createBaselineGraph(payload: CreateBaselineGraphPayload): Promise<BaselineGraphDetail> {
  const metadata = metadataFromPayload(payload);
  const estimatedBytes = estimateGraphPayloadBytes(payload);
  console.log("BASELINE GRAPH SAVE START", {
    inventoryId: payload.inventoryId,
    nodes: payload.nodes.length,
    edges: payload.edges.length,
    stations: payload.stations.length,
    routes: payload.routes?.length ?? payload.graphSummary.routeCount ?? 0,
  });
  console.log("GRAPH PAYLOAD SIZE", estimatedBytes);
  console.log("GRAPH PAYLOAD MB", Number((estimatedBytes / 1024 / 1024).toFixed(2)));

  const initPayload = {
    inventoryId: payload.inventoryId,
    name: payload.name,
    graphSummary: payload.graphSummary,
    sourceFile: payload.sourceFile,
    importedAt: payload.importedAt,
    metadata: payload.metadata,
    chunkCounts: metadata.chunkCounts,
  };

  try {
    const initResponse = await requestJson<any>(`${CHICAGO_API}/api/baseline-graphs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initPayload),
    });
    const initMetadata = normalizeMetadata(unwrapDetail(initResponse).metadata ?? unwrapDetail(initResponse) ?? metadata);
    await uploadChunks(payload.inventoryId, "nodes", payload.nodes);
    await uploadChunks(payload.inventoryId, "edges", payload.edges);
    const stationResponse = await uploadChunks(payload.inventoryId, "stations", payload.stations);
    const finalResponse = payload.routes?.length
      ? await uploadChunks(payload.inventoryId, "routes", payload.routes)
      : stationResponse;
    const savedMetadata = normalizeMetadata(unwrapDetail(finalResponse).metadata ?? finalResponse.metadata ?? initMetadata);
    const inventoryScopeVersion =
      unwrapDetail(finalResponse).inventoryScopeVersion ?? finalResponse.inventoryScopeVersion ?? inventoryScopeVersionFromMetadata(savedMetadata);
    upsertLocalMetadata(savedMetadata);
    console.log("BASELINE GRAPH SAVE COMPLETE", {
      inventoryId: savedMetadata.inventoryId,
      nodeCount: savedMetadata.nodeCount,
      edgeCount: savedMetadata.edgeCount,
      stationCount: savedMetadata.stationCount,
    });
    console.log("INVENTORY SCOPEVERSION CREATED", inventoryScopeVersion);
    return detailFromParts({
      metadata: savedMetadata,
      inventoryScopeVersion,
      nodes: payload.nodes,
      edges: payload.edges,
      stations: payload.stations,
    });
  } catch (err) {
    upsertLocalMetadata(metadata);
    console.error("BASELINE GRAPH SAVE ERROR", err);
    throw err;
  }
}

export async function listBaselineGraphs(): Promise<BaselineGraphMetadata[]> {
  const local = readLocalMetadata();
  try {
    const data = await requestJson<any>(`${CHICAGO_API}/api/baseline-graphs`);
    const remote = unwrapList(data).map(normalizeMetadata).filter((item) => item.inventoryId);
    const merged = mergeMetadata(remote, local);
    console.log("BASELINE GRAPH LIST LOADED", { count: merged.length });
    return merged;
  } catch (err) {
    console.warn("BASELINE GRAPH LIST API FALLBACK", err);
    console.log("BASELINE GRAPH LIST LOADED", { count: local.length, storage: "metadata-local" });
    return local;
  }
}

export async function loadBaselineGraph(inventoryId: string): Promise<BaselineGraphDetail> {
  console.log("GRAPH DETAIL LOAD START", { inventoryId });
  const data = await requestJson<any>(`${CHICAGO_API}/api/baseline-graphs/${encodeURIComponent(inventoryId)}`);
  const base = unwrapDetail(data);
  const metadata = normalizeMetadata(base.metadata ?? base);
  const inventoryScopeVersion = base.inventoryScopeVersion ?? base.inventory_scope_version ?? inventoryScopeVersionFromMetadata(metadata);
  const hasInlineGraph =
    Array.isArray(base.nodes ?? base.graph?.nodes) ||
    Array.isArray(base.edges ?? base.graph?.edges) ||
    Array.isArray(base.stations ?? base.graph?.stations);

  const detail = hasInlineGraph
    ? normalizeDetail(base)
    : detailFromParts({
        metadata,
        inventoryScopeVersion,
        nodes: (await loadGraphPart(inventoryId, "nodes", metadata.chunkCounts?.nodes)) as BaselineGraphNode[],
        edges: (await loadGraphPart(inventoryId, "edges", metadata.chunkCounts?.edges)) as BaselineGraphEdge[],
        stations: (await loadGraphPart(inventoryId, "stations", metadata.chunkCounts?.stations)) as GraphStation[],
      });

  console.log("GRAPH DETAIL COMPLETE", {
    inventoryId,
    nodes: detail.graph.nodes.length,
    edges: detail.graph.edges.length,
    stations: detail.stations.length,
  });
  console.log("BASELINE GRAPH DETAIL LOADED", {
    inventoryId: detail.metadata.inventoryId,
    nodes: detail.graph.nodes.length,
    edges: detail.graph.edges.length,
    stations: detail.stations.length,
  });
  return detail;
}
