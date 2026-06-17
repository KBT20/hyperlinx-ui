import { DAL_BASELINE_GRAPH_API } from "../config/dalApi";
import { findRecord, graphStorageTelemetry, readCollection, serializedSizeBytes, writeRecord } from "./dalStorage";
import type { InventoryGraph, InventoryGraphMetadata, ValidationStatus } from "../types/dal";

export type InventoryStorageLocation = "Browser Only" | "Server Only" | "Synchronized";
export type InventorySyncStatus = "MISSING_ON_SERVER" | "MISSING_IN_BROWSER" | "PRESENT_IN_BOTH" | "METADATA_MISMATCH";
export type InventoryValidationCheck = {
  label: string;
  status: ValidationStatus;
  detail: string;
};

export type InventoryRecoveryRecord = {
  inventoryId: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  stationCount: number;
  routeCount: number;
  graphSizeMB: number;
  storageLocation: InventoryStorageLocation;
  syncStatus: InventorySyncStatus;
  lastUpdated: string;
  validationStatus: ValidationStatus;
  validationChecks: InventoryValidationCheck[];
  browserMetadata?: InventoryGraphMetadata & Record<string, unknown>;
  serverMetadata?: InventoryGraphMetadata & Record<string, unknown>;
};

export type InventoryRecoverySummary = {
  serverInventoryCount: number;
  browserInventoryCount: number;
  synchronizedInventoryCount: number;
  unsynchronizedInventoryCount: number;
  totalServerSizeMB: number;
  totalBrowserSizeMB: number;
  largestGraphs: InventoryRecoveryRecord[];
  syncFailures: InventoryRecoveryRecord[];
};

const BASELINE_GRAPHS_PATH = "/api/baseline-graphs";
const COLLECTIONS = ["nodes", "edges", "stations", "routes"] as const;
const MAX_CHUNK_BYTES = 800_000;
const MAX_CHUNK_RECORDS = 2500;

type ChunkCollection = (typeof COLLECTIONS)[number];
type InventoryGraphChunk = {
  chunkType: ChunkCollection;
  chunkIndex: number;
  totalChunks: number;
  records: unknown[];
};

function apiUrl(path: string) {
  return `${DAL_BASELINE_GRAPH_API}${path}`;
}

function formatErrorBody(text: string) {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text().catch(() => "");
  const parsed = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  })() : undefined;
  if (!response.ok) {
    const body = formatErrorBody(text);
    const errorText = parsed?.error ? `${body}` : body;
    throw new Error(`${response.status} ${response.statusText}${errorText ? `\n${errorText}` : ""}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function unwrapList<T>(data: any): T[] {
  const items = data?.baselineGraphs ?? data?.inventoryGraphs ?? data?.graphs ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

function asCount(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function graphSizeMB(raw: unknown, metadata?: Record<string, unknown>) {
  const explicit = Number(metadata?.serializedSizeMB ?? metadata?.graphSizeMB ?? metadata?.sizeMB);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const bytes = Number(metadata?.serializedSizeBytes ?? metadata?.graphSizeBytes ?? metadata?.sizeBytes);
  if (Number.isFinite(bytes) && bytes > 0) return Number((bytes / 1024 / 1024).toFixed(2));
  return Number((serializedSizeBytes(raw) / 1024 / 1024).toFixed(2));
}

function normalizeMetadata(raw: any, graph?: Partial<InventoryGraph>): InventoryGraphMetadata & Record<string, unknown> {
  const source = raw?.metadata ?? raw ?? {};
  const inventoryId = asText(raw?.inventoryId ?? source.inventoryId ?? graph?.inventoryId, "unknown-inventory");
  const graphId = asText(raw?.graphId ?? source.graphId ?? graph?.graphId, inventoryId);
  const createdAt = asText(raw?.createdAt ?? source.createdAt ?? source.createdDate ?? graph?.createdAt, new Date().toISOString());
  const updatedAt = asText(raw?.updatedAt ?? source.updatedAt ?? graph?.updatedAt, createdAt);
  const nodes = Array.isArray((raw ?? graph)?.nodes) ? (raw ?? graph).nodes : graph?.nodes ?? [];
  const edges = Array.isArray((raw ?? graph)?.edges) ? (raw ?? graph).edges : graph?.edges ?? [];
  const stations = Array.isArray((raw ?? graph)?.stations) ? (raw ?? graph).stations : graph?.stations ?? [];
  const routes = Array.isArray((raw ?? graph)?.routes) ? (raw ?? graph).routes : graph?.routes ?? [];
  const metadata = {
    inventoryId,
    graphId,
    scopeVersionId: raw?.scopeVersionId ?? source.scopeVersionId ?? graph?.scopeVersionId,
    name: asText(source.name ?? raw?.name, inventoryId),
    sourceFile: source.sourceFile ?? raw?.sourceFile,
    sourceType: source.sourceType ?? raw?.sourceType,
    createdDate: asText(source.createdDate ?? createdAt, createdAt),
    validationStatus: source.validationStatus ?? raw?.validation?.status,
    nodeCount: asCount(source.nodeCount ?? raw?.nodeCount, nodes.length),
    edgeCount: asCount(source.edgeCount ?? raw?.edgeCount, edges.length),
    stationCount: asCount(source.stationCount ?? raw?.stationCount, stations.length),
    routeCount: asCount(source.routeCount ?? raw?.routeCount, routes.length),
    routeMiles: asCount(source.routeMiles ?? raw?.routeMiles, routes.reduce((sum: number, route: any) => sum + Number(route.lengthFeet || 0), 0) / 5280),
    serializedSizeBytes: asCount(source.serializedSizeBytes ?? source.graphSizeBytes ?? source.sizeBytes),
    serializedSizeMB: graphSizeMB(raw ?? graph, source),
    updatedAt,
    ...(source ?? {}),
  };
  return metadata;
}

function normalizeGraph(raw: any): InventoryGraph {
  const graph = raw?.inventoryGraph ?? raw?.baselineGraph ?? raw?.graph ?? raw?.data ?? raw;
  const metadata = normalizeMetadata(graph);
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const stations = Array.isArray(graph?.stations) ? graph.stations : [];
  const routes = Array.isArray(graph?.routes) ? graph.routes : [];
  const normalized: InventoryGraph = {
    inventoryId: metadata.inventoryId,
    graphId: metadata.graphId,
    scopeVersionId: metadata.scopeVersionId,
    metadata: normalizeMetadata(
      {
        ...graph,
        metadata: {
          ...metadata,
          nodeCount: metadata.nodeCount || nodes.length,
          edgeCount: metadata.edgeCount || edges.length,
          stationCount: metadata.stationCount || stations.length,
          routeCount: metadata.routeCount || routes.length,
        },
      },
      { inventoryId: metadata.inventoryId, graphId: metadata.graphId, nodes, edges, stations, routes }
    ),
    nodes,
    edges,
    stations,
    routes,
    validation: graph?.validation ?? { status: metadata.validationStatus ?? "PASS", issues: [] },
    createdAt: asText(graph?.createdAt ?? metadata.createdDate, metadata.createdDate),
    updatedAt: asText(graph?.updatedAt ?? (metadata as any).updatedAt, metadata.createdDate),
  };
  return normalized;
}

function metadataMismatch(browser?: InventoryGraphMetadata, server?: InventoryGraphMetadata) {
  if (!browser || !server) return false;
  return (
    asCount(browser.nodeCount) !== asCount(server.nodeCount) ||
    asCount(browser.edgeCount) !== asCount(server.edgeCount) ||
    asCount(browser.stationCount) !== asCount(server.stationCount) ||
    asCount(browser.routeCount) !== asCount(server.routeCount)
  );
}

function totalGraphRecordCount(metadata?: InventoryGraphMetadata | Record<string, unknown>) {
  return (
    asCount(metadata?.nodeCount) +
    asCount(metadata?.edgeCount) +
    asCount(metadata?.stationCount) +
    asCount(metadata?.routeCount)
  );
}

function chunkCountsFromDetail(detail: any, server?: Record<string, unknown>) {
  const counts = detail?.metadata?.chunkCounts ?? detail?.chunkCounts ?? server?.chunkCounts ?? {};
  return COLLECTIONS.reduce<Record<ChunkCollection, number>>((acc, collection) => {
    acc[collection] = asCount(counts?.[collection]);
    return acc;
  }, { nodes: 0, edges: 0, stations: 0, routes: 0 });
}

function validationChecks(args: {
  browser?: InventoryGraphMetadata;
  server?: InventoryGraphMetadata;
  serverDetail?: any;
}): InventoryValidationCheck[] {
  const { browser, server, serverDetail } = args;
  const chunkCounts = chunkCountsFromDetail(serverDetail, server as any);
  const reportedChunkTotal = COLLECTIONS.reduce((sum, collection) => sum + chunkCounts[collection], 0);
  const chunkCount = Number(
    reportedChunkTotal ||
      (serverDetail?.chunkCount ??
      serverDetail?.metadata?.chunkCount ??
      serverDetail?.chunks?.length ??
      (server as any)?.chunkCount ??
      0)
  );
  const expectedChunkCount = Number(serverDetail?.metadata?.expectedChunkCount ?? (server as any)?.expectedChunkCount ?? chunkCount);
  const checks: InventoryValidationCheck[] = [
    {
      label: "Server Graph Exists",
      status: server ? "PASS" : "FAIL",
      detail: server ? "Server metadata discovered." : "No server record returned from /api/baseline-graphs.",
    },
    {
      label: "Metadata Exists",
      status: server || browser ? "PASS" : "FAIL",
      detail: server || browser ? "Inventory metadata is available." : "No inventory metadata available.",
    },
    {
      label: "Chunk Count Matches",
      status: !server || !expectedChunkCount || expectedChunkCount === chunkCount ? "PASS" : "FAIL",
      detail: expectedChunkCount
        ? `${chunkCount} of ${expectedChunkCount} chunks available. nodes=${chunkCounts.nodes}, edges=${chunkCounts.edges}, stations=${chunkCounts.stations}, routes=${chunkCounts.routes}.`
        : "Server did not report chunk count.",
    },
    {
      label: "Node Count Matches",
      status: !browser || !server || browser.nodeCount === server.nodeCount ? "PASS" : "FAIL",
      detail: `${browser?.nodeCount ?? "browser n/a"} browser / ${server?.nodeCount ?? "server n/a"} server.`,
    },
    {
      label: "Edge Count Matches",
      status: !browser || !server || browser.edgeCount === server.edgeCount ? "PASS" : "FAIL",
      detail: `${browser?.edgeCount ?? "browser n/a"} browser / ${server?.edgeCount ?? "server n/a"} server.`,
    },
    {
      label: "Station Count Matches",
      status: !browser || !server || browser.stationCount === server.stationCount ? "PASS" : "FAIL",
      detail: `${browser?.stationCount ?? "browser n/a"} browser / ${server?.stationCount ?? "server n/a"} server.`,
    },
  ];
  return checks;
}

function aggregateStatus(checks: InventoryValidationCheck[]) {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "WARNING")) return "WARNING";
  return "PASS";
}

function recoveryRecord(browser?: InventoryGraphMetadata & Record<string, unknown>, server?: InventoryGraphMetadata & Record<string, unknown>): InventoryRecoveryRecord {
  const source = server ?? browser;
  const storageLocation: InventoryStorageLocation = browser && server ? "Synchronized" : browser ? "Browser Only" : "Server Only";
  const syncStatus: InventorySyncStatus = browser && server ? (metadataMismatch(browser, server) ? "METADATA_MISMATCH" : "PRESENT_IN_BOTH") : browser ? "MISSING_ON_SERVER" : "MISSING_IN_BROWSER";
  const checks = validationChecks({ browser, server });
  return {
    inventoryId: source?.inventoryId ?? "unknown",
    name: source?.name ?? source?.inventoryId ?? "Unknown Inventory",
    nodeCount: asCount(source?.nodeCount),
    edgeCount: asCount(source?.edgeCount),
    stationCount: asCount(source?.stationCount),
    routeCount: asCount(source?.routeCount),
    graphSizeMB: Number(source?.serializedSizeMB ?? source?.graphSizeMB ?? 0),
    storageLocation,
    syncStatus,
    lastUpdated: asText((source as any)?.updatedAt ?? source?.createdDate, ""),
    validationStatus: aggregateStatus(checks),
    validationChecks: checks,
    browserMetadata: browser,
    serverMetadata: server,
  };
}

function chunkRecords(records: unknown[], collection: ChunkCollection) {
  const chunks: unknown[][] = [];
  let current: unknown[] = [];
  for (const record of records) {
    const candidate = [...current, record];
    const candidateSize = serializedSizeBytes({ collection, records: candidate });
    if (current.length && (candidate.length > MAX_CHUNK_RECORDS || candidateSize > MAX_CHUNK_BYTES)) {
      chunks.push(current);
      current = [record];
    } else {
      current = candidate;
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function chunksForGraph(graph: InventoryGraph) {
  const chunks: InventoryGraphChunk[] = [];
  COLLECTIONS.forEach((collection) => {
    const collectionChunks = chunkRecords((graph as any)[collection] ?? [], collection);
    collectionChunks.forEach((records, chunkIndex) => {
      chunks.push({
        chunkType: collection,
        chunkIndex,
        totalChunks: collectionChunks.length,
        records,
      });
    });
  });
  return chunks;
}

export async function listBrowserInventoryMetadata() {
  const graphs = await readCollection<InventoryGraph>("inventoryGraphs");
  return graphs.map((graph) => normalizeMetadata(graph, graph));
}

export async function listServerBaselineGraphMetadata() {
  const data = await requestJson<any>(apiUrl(BASELINE_GRAPHS_PATH));
  return unwrapList<any>(data).map((item) => normalizeMetadata(item));
}

export async function discoverInventoryRecovery(): Promise<InventoryRecoveryRecord[]> {
  const [browserItems, serverItems] = await Promise.allSettled([listBrowserInventoryMetadata(), listServerBaselineGraphMetadata()]);
  const browser = browserItems.status === "fulfilled" ? browserItems.value : [];
  const server = serverItems.status === "fulfilled" ? serverItems.value : [];
  const ids = new Set([...browser.map((item) => item.inventoryId), ...server.map((item) => item.inventoryId)].filter(Boolean));
  return Array.from(ids)
    .map((inventoryId) => recoveryRecord(browser.find((item) => item.inventoryId === inventoryId), server.find((item) => item.inventoryId === inventoryId)))
    .sort((a, b) => String(b.lastUpdated).localeCompare(String(a.lastUpdated)));
}

async function getServerGraphDetail(inventoryId: string) {
  return requestJson<any>(apiUrl(`${BASELINE_GRAPHS_PATH}/${encodeURIComponent(inventoryId)}`));
}

function chunkIndexesFromDetail(detail: any) {
  const chunks = detail?.chunks ?? detail?.metadata?.chunks ?? detail?.chunkInfo ?? [];
  if (Array.isArray(chunks) && chunks.length) {
    return chunks
      .map((chunk: any, index: number) => Number(chunk.chunkIndex ?? chunk.index ?? index))
      .filter((index: number) => Number.isFinite(index));
  }
  const chunkCount = Number(detail?.chunkCount ?? detail?.metadata?.chunkCount ?? detail?.metadata?.expectedChunkCount ?? 0);
  return chunkCount > 0 ? Array.from({ length: chunkCount }, (_, index) => index) : [];
}

function chunkIndexesByTypeFromDetail(detail: any) {
  const counts = chunkCountsFromDetail(detail, detail?.metadata);
  return COLLECTIONS.reduce<Record<ChunkCollection, number[]>>((acc, collection) => {
    acc[collection] = counts[collection] > 0 ? Array.from({ length: counts[collection] }, (_, index) => index) : [];
    return acc;
  }, { nodes: [], edges: [], stations: [], routes: [] });
}

function applyChunk(graph: InventoryGraph, rawChunk: any) {
  const appendRecords = (collection: ChunkCollection, records: unknown[]) => {
    (graph as any)[collection] = [...((graph as any)[collection] ?? []), ...records];
  };
  const aggregateData = rawChunk?.data;
  if (aggregateData && typeof aggregateData === "object" && !Array.isArray(aggregateData)) {
    COLLECTIONS.forEach((collection) => {
      const records = (aggregateData as any)[collection];
      if (Array.isArray(records)) appendRecords(collection, records);
    });
  }
  const chunk = rawChunk?.chunk ?? rawChunk;
  if (chunk && typeof chunk === "object" && !Array.isArray(chunk)) {
    COLLECTIONS.forEach((collection) => {
      const records = (chunk as any)[collection];
      if (Array.isArray(records)) appendRecords(collection, records);
    });
  }
  const collection = chunk?.chunkType ?? chunk?.collection ?? chunk?.type ?? chunk?.kind;
  const records = chunk?.records ?? chunk?.payload ?? chunk?.items ?? chunk?.data ?? [];
  if (!COLLECTIONS.includes(collection) || !Array.isArray(records)) return;
  appendRecords(collection, records);
}

export async function loadServerBaselineGraph(inventoryId: string): Promise<InventoryGraph> {
  const detail = await getServerGraphDetail(inventoryId);
  const graph = normalizeGraph(detail);
  if (graph.nodes.length || graph.edges.length || graph.stations.length || graph.routes.length) return graph;
  const indexesByType = chunkIndexesByTypeFromDetail(detail);
  for (const collection of COLLECTIONS) {
    for (const chunkIndex of indexesByType[collection]) {
      const chunk = await requestJson<any>(apiUrl(`${BASELINE_GRAPHS_PATH}/${encodeURIComponent(inventoryId)}/chunks/${chunkIndex}?chunkType=${collection}`));
      applyChunk(graph, chunk);
    }
  }
  if (graph.nodes.length || graph.edges.length || graph.stations.length || graph.routes.length) {
    graph.metadata = normalizeMetadata({ ...detail, nodes: graph.nodes, edges: graph.edges, stations: graph.stations, routes: graph.routes }, graph);
    return graph;
  }
  const indexes = chunkIndexesFromDetail(detail);
  for (const chunkIndex of indexes) {
    const chunk = await requestJson<any>(apiUrl(`${BASELINE_GRAPHS_PATH}/${encodeURIComponent(inventoryId)}/chunks/${chunkIndex}`));
    applyChunk(graph, chunk);
  }
  graph.metadata = normalizeMetadata({ ...detail, nodes: graph.nodes, edges: graph.edges, stations: graph.stations, routes: graph.routes }, graph);
  return graph;
}

export async function pushBrowserInventoryToServer(inventoryId: string) {
  const local = await findRecord<InventoryGraph>("inventoryGraphs", inventoryId);
  if (!local) throw new Error(`Browser inventory graph not found: ${inventoryId}`);
  const graph = normalizeGraph(local);
  const telemetry = graphStorageTelemetry(graph);
  const chunks = chunksForGraph(graph);
  const metadata = {
    ...graph.metadata,
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    scopeVersionId: graph.scopeVersionId ?? graph.metadata.scopeVersionId,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    stationCount: graph.stations.length,
    routeCount: graph.routes.length,
    serializedSizeBytes: telemetry.serializedSizeBytes,
    serializedSizeMB: telemetry.serializedSizeMB,
    chunkCount: chunks.length,
    expectedChunkCount: chunks.length,
    chunks: COLLECTIONS.reduce<Record<string, number>>((acc, collection) => {
      acc[collection] = chunks.filter((chunk) => chunk.chunkType === collection).length;
      return acc;
    }, {}),
    authority: "DAL_SERVER",
  };
  const createGraphUrl = apiUrl(BASELINE_GRAPHS_PATH);
  console.log("API TARGET", DAL_BASELINE_GRAPH_API);
  console.log("CREATE BASELINE GRAPH URL", createGraphUrl);
  await requestJson<any>(createGraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inventoryId: graph.inventoryId,
      graphId: graph.graphId,
      scopeVersionId: graph.scopeVersionId,
      metadata,
      validation: graph.validation,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    }),
  });
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const chunkUploadUrl = apiUrl(`${BASELINE_GRAPHS_PATH}/${encodeURIComponent(graph.inventoryId)}/chunks`);
    const chunkPayload = {
      chunkType: chunk.chunkType,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      data: chunk.records,
    };
    console.log("CHUNK UPLOAD URL", chunkUploadUrl, {
      chunkType: chunk.chunkType,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
    });
    console.log("GRAPH CHUNK PAYLOAD", {
      inventoryId: graph.inventoryId,
      chunkType: chunkPayload.chunkType,
      chunkIndex: chunkPayload.chunkIndex,
      totalChunks: chunkPayload.totalChunks,
      recordCount: chunkPayload.data.length,
    });
    const chunkResponse = await requestJson<any>(chunkUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunkPayload),
    });
    console.log("GRAPH CHUNK RESPONSE", chunkResponse);
  }
  return metadata;
}

export async function pullServerInventoryToBrowser(inventoryId: string) {
  const graph = await loadServerBaselineGraph(inventoryId);
  await writeRecord("inventoryGraphs", {
    ...graph,
    metadata: {
      ...graph.metadata,
      localFallback: false,
      serverBacked: true,
    },
  });
  return graph.metadata;
}

export async function synchronizeInventory(inventoryId: string) {
  const browser = await findRecord<InventoryGraph>("inventoryGraphs", inventoryId);
  let server: InventoryGraphMetadata | undefined;
  try {
    server = (await listServerBaselineGraphMetadata()).find((item) => item.inventoryId === inventoryId);
  } catch {
    server = undefined;
  }

  if (browser && !server) return pushBrowserInventoryToServer(inventoryId);
  if (!browser && server) return pullServerInventoryToBrowser(inventoryId);
  if (browser && server) {
    console.info("DAL SERVER AUTHORITY SELECTED", {
      inventoryId,
      browserRecordCount: totalGraphRecordCount(normalizeMetadata(browser, browser)),
      serverRecordCount: totalGraphRecordCount(server),
      rule: "Server-backed inventory wins unless user explicitly chooses Push Browser Truth.",
    });
    return pullServerInventoryToBrowser(inventoryId);
  }
  throw new Error(`Inventory not found in browser or server: ${inventoryId}`);
}

export async function validateServerInventory(inventoryId: string): Promise<InventoryValidationCheck[]> {
  const [browser, serverItems, detail] = await Promise.allSettled([
    findRecord<InventoryGraph>("inventoryGraphs", inventoryId),
    listServerBaselineGraphMetadata(),
    getServerGraphDetail(inventoryId),
  ]);
  const browserMetadata = browser.status === "fulfilled" && browser.value ? normalizeMetadata(browser.value, browser.value) : undefined;
  const serverMetadata = serverItems.status === "fulfilled" ? serverItems.value.find((item) => item.inventoryId === inventoryId) : undefined;
  return validationChecks({
    browser: browserMetadata,
    server: serverMetadata,
    serverDetail: detail.status === "fulfilled" ? detail.value : undefined,
  });
}

export function summarizeInventoryRecovery(records: InventoryRecoveryRecord[]): InventoryRecoverySummary {
  const serverInventoryCount = records.filter((record) => record.serverMetadata).length;
  const browserInventoryCount = records.filter((record) => record.browserMetadata).length;
  const synchronizedInventoryCount = records.filter((record) => record.storageLocation === "Synchronized" && record.syncStatus === "PRESENT_IN_BOTH").length;
  const unsynchronizedInventoryCount = records.length - synchronizedInventoryCount;
  return {
    serverInventoryCount,
    browserInventoryCount,
    synchronizedInventoryCount,
    unsynchronizedInventoryCount,
    totalServerSizeMB: Number(records.reduce((sum, record) => sum + Number(record.serverMetadata?.serializedSizeMB ?? 0), 0).toFixed(2)),
    totalBrowserSizeMB: Number(records.reduce((sum, record) => sum + Number(record.browserMetadata?.serializedSizeMB ?? 0), 0).toFixed(2)),
    largestGraphs: [...records].sort((a, b) => b.graphSizeMB - a.graphSizeMB).slice(0, 5),
    syncFailures: records.filter((record) => record.validationStatus === "FAIL" || record.syncStatus === "METADATA_MISMATCH"),
  };
}

export function classifyLegacyInventory(record: InventoryRecoveryRecord) {
  const text = `${record.name} ${record.inventoryId}`.toLowerCase();
  if (text.includes("fiberlight") && (text.includes("current") || text.includes("planned"))) return "FiberLight Current and Planned";
  if (text.includes("europe") || text.includes("10 node") || text.includes("10-node")) return "European 10 Node";
  return "Other legacy inventories";
}
