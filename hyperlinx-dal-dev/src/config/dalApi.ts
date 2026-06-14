const env = import.meta.env as Record<string, string | undefined>;

function cleanApiBase(value: string | undefined, fallback: string) {
  const resolved = value?.trim() || fallback;
  return resolved.replace(/\/+$/, "");
}

export const DAL_API = cleanApiBase(env.VITE_DAL_API, "http://127.0.0.1:3001");
export const DAL_BASELINE_GRAPH_API = cleanApiBase(env.VITE_DAL_BASELINE_GRAPH_API, DAL_API);
export const DAL_APP_NAME = env.VITE_DAL_APP_NAME?.trim() || "HYPERLINX DAL DEVELOPMENT";

console.log("DAL DEVELOPMENT MODE");
console.log("DAL API TARGET", DAL_API);
console.log("DAL BASELINE GRAPH API TARGET", DAL_BASELINE_GRAPH_API);

export type DALChunkType = "nodes" | "edges" | "stations" | "routes";

export type DALBaselineGraphMetadata = {
  inventoryId: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  stationCount: number;
  routeMiles?: number;
  importedAt: string;
  baselineGraphId?: string;
  sourceFile?: string;
  graphSummary?: Record<string, unknown>;
  chunkCounts?: Partial<Record<DALChunkType, number>>;
};

export type DALGraphBundle = {
  inventoryId?: string;
  name?: string;
  graphSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  stations?: unknown[];
  routes?: unknown[];
  sourceFile?: string;
  importedAt?: string;
};

const CHUNK_SIZE = 5000;

function dalUrl(base: string, path: string) {
  return `${base}${path}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function chunkRecords(records: unknown[]) {
  const chunks: unknown[][] = [];
  for (let index = 0; index < records.length; index += CHUNK_SIZE) chunks.push(records.slice(index, index + CHUNK_SIZE));
  return chunks.length ? chunks : [[]];
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function metadataFromBundle(bundle: DALGraphBundle) {
  const nodes = arrayValue(bundle.nodes);
  const edges = arrayValue(bundle.edges);
  const stations = arrayValue(bundle.stations);
  const routes = arrayValue(bundle.routes);
  const graphSummary = {
    baselineId: bundle.graphSummary?.baselineId ?? bundle.inventoryId ?? createLocalId("baseline"),
    name: bundle.name ?? bundle.graphSummary?.name ?? "DAL inventory graph",
    nodeCount: nodes.length,
    edgeCount: edges.length,
    stationCount: stations.length,
    routeCount: routes.length,
    ...(bundle.graphSummary ?? {}),
  };

  return {
    inventoryId: bundle.inventoryId ?? createLocalId("inventory"),
    name: String(bundle.name ?? graphSummary.name),
    graphSummary,
    sourceFile: bundle.sourceFile,
    importedAt: bundle.importedAt ?? new Date().toISOString(),
    metadata: bundle.metadata ?? {},
    chunkCounts: {
      nodes: Math.max(1, Math.ceil(nodes.length / CHUNK_SIZE)),
      edges: Math.max(1, Math.ceil(edges.length / CHUNK_SIZE)),
      stations: Math.max(1, Math.ceil(stations.length / CHUNK_SIZE)),
      routes: routes.length ? Math.max(1, Math.ceil(routes.length / CHUNK_SIZE)) : 0,
    },
  };
}

export async function listDALBaselineGraphs() {
  const url = dalUrl(DAL_BASELINE_GRAPH_API, "/api/baseline-graphs");
  const data = await requestJson<any>(url);
  const items = data?.items ?? data?.baselineGraphs ?? data?.data ?? data;
  return Array.isArray(items) ? (items as DALBaselineGraphMetadata[]) : [];
}

export async function loadDALBaselineGraphMetadata(inventoryId: string) {
  const url = dalUrl(DAL_BASELINE_GRAPH_API, `/api/baseline-graphs/${encodeURIComponent(inventoryId)}`);
  const data = await requestJson<any>(url);
  return (data?.metadata ?? data) as DALBaselineGraphMetadata;
}

export async function loadDALGraphChunk(inventoryId: string, chunkType: DALChunkType, chunkIndex: number) {
  const url = dalUrl(
    DAL_BASELINE_GRAPH_API,
    `/api/baseline-graphs/${encodeURIComponent(inventoryId)}/chunks/${chunkIndex}?chunkType=${encodeURIComponent(chunkType)}`
  );
  const data = await requestJson<any>(url);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function saveDALBaselineGraph(bundle: DALGraphBundle, onProgress?: (message: string) => void) {
  const metadataPayload = metadataFromBundle(bundle);
  const createUrl = dalUrl(DAL_BASELINE_GRAPH_API, "/api/baseline-graphs");
  onProgress?.(`Creating metadata at ${createUrl}`);
  const created = await requestJson<any>(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadataPayload),
  });

  const inventoryId = String(created?.metadata?.inventoryId ?? metadataPayload.inventoryId);
  const recordSets: Array<[DALChunkType, unknown[]]> = [
    ["nodes", arrayValue(bundle.nodes)],
    ["edges", arrayValue(bundle.edges)],
    ["stations", arrayValue(bundle.stations)],
    ["routes", arrayValue(bundle.routes)],
  ];

  for (const [chunkType, records] of recordSets) {
    if (chunkType === "routes" && records.length === 0) continue;
    const chunks = chunkRecords(records);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const url = dalUrl(DAL_BASELINE_GRAPH_API, `/api/baseline-graphs/${encodeURIComponent(inventoryId)}/chunks`);
      onProgress?.(`${chunkType} chunk ${chunkIndex + 1}/${chunks.length}`);
      await requestJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          chunkIndex,
          totalChunks: chunks.length,
          chunkType,
          data: chunks[chunkIndex],
        }),
      });
    }
  }

  return loadDALBaselineGraphMetadata(inventoryId);
}
