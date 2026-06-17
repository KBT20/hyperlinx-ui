import { DAL_BASELINE_GRAPH_API } from "../config/dalApi";
import { findRecord, readCollection, serializedSizeBytes, writeRecord } from "./dalStorage";
import { ensureInventoryScopeVersion } from "./scopeVersionRepository";
import { validateInventoryGraph, type InventoryValidationReport } from "../validation/inventoryValidation";
import type {
  HyperlinxInventoryPackage,
  InventoryGraph,
  InventoryImportJob,
  InventoryImportJobStatus,
  InventorySourceFormat,
  InventoryUploadProgress,
  ValidationIssue,
  ValidationResult,
} from "../types/dal";

export const HYPERLINX_PACKAGE_VERSION = "1.0";
export const HYPERLINX_PACKAGE_EXTENSION = ".hyperlinx";
export const INVENTORY_IMPORT_JOBS_PATH = "/api/inventory-import-jobs";

export const INVENTORY_SOURCE_FORMATS: InventorySourceFormat[] = [
  "HYPERLINX",
  "SHAPEFILE",
  "GEOJSON",
  "KMZ",
  "KML",
  "3GIS",
  "IQGEO",
  "CONNECTBASE",
  "FIBER_ENGINEERING_RECORDS",
  "UNKNOWN",
];

const DEFAULT_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_RETRIES = 2;

type UploadOptions = {
  chunkSizeBytes?: number;
  startChunkIndex?: number;
  maxRetries?: number;
  sourceFormat?: InventorySourceFormat;
  onProgress?: (progress: InventoryUploadProgress) => void;
};

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function apiUrl(path: string) {
  return `${DAL_BASELINE_GRAPH_API}${path}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function tryRequestJson<T>(url: string, init?: RequestInit) {
  try {
    return await requestJson<T>(url, init);
  } catch (err) {
    console.warn("DAL INVENTORY IMPORT SERVER FALLBACK", url, err instanceof Error ? err.message : String(err));
    return null;
  }
}

function inferSourceFormat(fileName: string): InventorySourceFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".hyperlinx")) return "HYPERLINX";
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) return "GEOJSON";
  if (lower.endsWith(".kmz")) return "KMZ";
  if (lower.endsWith(".kml")) return "KML";
  if (lower.endsWith(".shp") || lower.endsWith(".zip")) return "SHAPEFILE";
  if (lower.includes("3gis")) return "3GIS";
  if (lower.includes("iqgeo")) return "IQGEO";
  if (lower.includes("connectbase")) return "CONNECTBASE";
  return "UNKNOWN";
}

function normalizePackage(raw: any): HyperlinxInventoryPackage {
  const metadata = raw?.inventoryMetadata ?? raw?.metadata ?? {};
  const inventoryId = String(metadata.inventoryId ?? raw?.inventoryId ?? createId("inventory"));
  const graphId = String(metadata.graphId ?? raw?.graphId ?? inventoryId);
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw?.edges) ? raw.edges : [];
  const stations = Array.isArray(raw?.stations) ? raw.stations : [];
  const routes = Array.isArray(raw?.routes) ? raw.routes : [];
  const packageShape: HyperlinxInventoryPackage = {
    packageVersion: String(raw?.packageVersion ?? HYPERLINX_PACKAGE_VERSION),
    exportedAt: String(raw?.exportedAt ?? now()),
    sourceFormat: raw?.sourceFormat ?? "HYPERLINX",
    inventoryMetadata: {
      name: String(metadata.name ?? inventoryId),
      sourceFile: metadata.sourceFile,
      sourceType: metadata.sourceType,
      createdDate: String(metadata.createdDate ?? raw?.createdAt ?? now()),
      validationStatus: metadata.validationStatus,
      nodeCount: Number(metadata.nodeCount ?? nodes.length),
      edgeCount: Number(metadata.edgeCount ?? edges.length),
      stationCount: Number(metadata.stationCount ?? stations.length),
      routeCount: Number(metadata.routeCount ?? routes.length),
      routeMiles: Number(metadata.routeMiles ?? 0),
      ...(metadata ?? {}),
      inventoryId,
      graphId,
    },
    nodes,
    edges,
    stations,
    routes,
    graphSummary: {
      inventoryId,
      graphId,
      nodeCount: Number(raw?.graphSummary?.nodeCount ?? nodes.length),
      edgeCount: Number(raw?.graphSummary?.edgeCount ?? edges.length),
      stationCount: Number(raw?.graphSummary?.stationCount ?? stations.length),
      routeCount: Number(raw?.graphSummary?.routeCount ?? routes.length),
      serializedSizeBytes: Number(raw?.graphSummary?.serializedSizeBytes ?? 0),
      serializedSizeMB: Number(raw?.graphSummary?.serializedSizeMB ?? 0),
    },
    validation: raw?.validation,
  };
  const serializedSize = serializedSizeBytes(packageShape);
  packageShape.graphSummary.serializedSizeBytes = serializedSize;
  packageShape.graphSummary.serializedSizeMB = Number((serializedSize / 1024 / 1024).toFixed(2));
  return packageShape;
}

function validationIssueCheck(check: string): ValidationIssue["check"] {
  if (check === "Duplicate IDs") return "Duplicate nodes";
  if (check === "Orphan nodes") return "Orphan nodes";
  if (check === "Missing nodes" || check === "Missing edges" || check === "Route references") return "Unconnected routes";
  return "Invalid geometry";
}

function validationResultFromReport(report: InventoryValidationReport): ValidationResult {
  return {
    status: report.status,
    issues: report.checks.map((check) => ({
      check: validationIssueCheck(check.check),
      status: check.status,
      count: check.count,
      message: check.message,
    })),
  };
}

function progressFor(job: InventoryImportJob, message?: string): InventoryUploadProgress {
  const percentComplete = job.totalBytes ? Math.round((job.uploadedBytes / job.totalBytes) * 1000) / 10 : 0;
  return {
    jobId: job.jobId,
    status: job.status,
    uploadedBytes: job.uploadedBytes,
    totalBytes: job.totalBytes,
    uploadedChunks: job.uploadedChunks,
    totalChunks: job.totalChunks,
    percentComplete,
    retryCount: job.retryCount,
    message,
  };
}

async function saveJob(job: InventoryImportJob) {
  await writeRecord("inventoryImportJobs", job);
  return job;
}

async function updateJob(job: InventoryImportJob, changes: Partial<InventoryImportJob>) {
  return saveJob({ ...job, ...changes, updatedAt: now() });
}

export function buildHyperlinxInventoryPackage(graph: InventoryGraph): HyperlinxInventoryPackage {
  const packageShape = normalizePackage({
    packageVersion: HYPERLINX_PACKAGE_VERSION,
    exportedAt: now(),
    sourceFormat: "HYPERLINX",
    inventoryMetadata: {
      ...graph.metadata,
      inventoryId: graph.inventoryId,
      graphId: graph.graphId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      stationCount: graph.stations.length,
      routeCount: graph.routes.length,
    },
    nodes: graph.nodes,
    edges: graph.edges,
    stations: graph.stations,
    routes: graph.routes,
    validation: graph.validation,
  });
  return packageShape;
}

export function hyperlinxPackageToGraph(packageShape: HyperlinxInventoryPackage): InventoryGraph {
  const report = validateInventoryGraph(packageShape);
  const metadata = {
    ...packageShape.inventoryMetadata,
    inventoryId: packageShape.graphSummary.inventoryId,
    graphId: packageShape.graphSummary.graphId,
    nodeCount: packageShape.nodes.length,
    edgeCount: packageShape.edges.length,
    stationCount: packageShape.stations.length,
    routeCount: packageShape.routes.length,
    serializedSizeBytes: packageShape.graphSummary.serializedSizeBytes,
    serializedSizeMB: packageShape.graphSummary.serializedSizeMB,
    validationStatus: report.status,
    sourceFormat: packageShape.sourceFormat,
    importedFromPackage: true,
  };
  return {
    inventoryId: metadata.inventoryId,
    graphId: metadata.graphId,
    scopeVersionId: metadata.scopeVersionId,
    metadata,
    nodes: packageShape.nodes,
    edges: packageShape.edges,
    stations: packageShape.stations,
    routes: packageShape.routes,
    validation: validationResultFromReport(report),
    createdAt: String(metadata.createdDate ?? packageShape.exportedAt),
    updatedAt: now(),
  };
}

export function packageFileName(graph: InventoryGraph | HyperlinxInventoryPackage) {
  const metadata = "inventoryMetadata" in graph ? graph.inventoryMetadata : graph.metadata;
  const name = String(metadata.name ?? metadata.inventoryId ?? "inventory")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return `${name || "inventory"}${HYPERLINX_PACKAGE_EXTENSION}`;
}

export function createHyperlinxPackageBlob(packageShape: HyperlinxInventoryPackage) {
  return new Blob([JSON.stringify(packageShape)], { type: "application/vnd.hyperlinx.inventory+json" });
}

export function downloadHyperlinxInventoryPackage(graph: InventoryGraph) {
  const packageShape = buildHyperlinxInventoryPackage(graph);
  const blob = createHyperlinxPackageBlob(packageShape);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = packageFileName(packageShape);
  anchor.click();
  URL.revokeObjectURL(url);
  return packageShape;
}

export async function readHyperlinxInventoryPackageFile(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return normalizePackage(parsed);
}

export async function createInventoryImportJob(input: {
  sourceFile: string;
  totalBytes: number;
  inventoryId?: string;
  graphId?: string;
  sourceFormat?: InventorySourceFormat;
  chunkSizeBytes?: number;
  validation?: InventoryValidationReport;
}) {
  const chunkSizeBytes = input.chunkSizeBytes ?? DEFAULT_CHUNK_BYTES;
  const job: InventoryImportJob = {
    jobId: createId("inventory-import"),
    inventoryId: input.inventoryId,
    graphId: input.graphId,
    sourceFile: input.sourceFile,
    sourceFormat: input.sourceFormat ?? inferSourceFormat(input.sourceFile),
    endpoint: apiUrl(INVENTORY_IMPORT_JOBS_PATH),
    status: "QUEUED",
    createdAt: now(),
    updatedAt: now(),
    totalBytes: input.totalBytes,
    uploadedBytes: 0,
    chunkSizeBytes,
    totalChunks: Math.max(1, Math.ceil(input.totalBytes / chunkSizeBytes)),
    uploadedChunks: 0,
    retryCount: 0,
    serverSupported: false,
    validationStatus: input.validation?.status,
    validationSummary: input.validation?.summary,
  };
  await saveJob(job);
  const remote = await tryRequestJson<any>(job.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });
  if (!remote) return job;
  const remoteJob = remote?.job ?? remote?.data ?? remote;
  return saveJob({
    ...job,
    ...remoteJob,
    jobId: String(remoteJob?.jobId ?? job.jobId),
    serverSupported: true,
    updatedAt: now(),
  });
}

export async function listInventoryImportJobs() {
  const localJobs = await readCollection<InventoryImportJob>("inventoryImportJobs");
  const remote = await tryRequestJson<any>(apiUrl(INVENTORY_IMPORT_JOBS_PATH));
  const remoteJobs = Array.isArray(remote?.jobs) ? remote.jobs : Array.isArray(remote?.items) ? remote.items : [];
  const byId = new Map<string, InventoryImportJob>();
  [...localJobs, ...remoteJobs].forEach((job: InventoryImportJob) => byId.set(job.jobId, job));
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function importHyperlinxPackageToBrowser(file: File) {
  const packageShape = await readHyperlinxInventoryPackageFile(file);
  const graph = hyperlinxPackageToGraph(packageShape);
  const report = validateInventoryGraph(graph);
  const job = await createInventoryImportJob({
    sourceFile: file.name,
    sourceFormat: "HYPERLINX",
    totalBytes: file.size,
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    validation: report,
  });
  const validatedJob = await updateJob(job, {
    status: "VALIDATING",
    validationStatus: report.status,
    validationSummary: report.summary,
  });
  await writeRecord("inventoryGraphs", {
    ...graph,
    metadata: {
      ...graph.metadata,
      localFallback: true,
      serverBacked: false,
      browserPackageImported: true,
    },
  });
  await ensureInventoryScopeVersion(graph).catch((err) => {
    console.warn("DAL INVENTORY SCOPEVERSION IMPORT WARNING", graph.inventoryId, err instanceof Error ? err.message : String(err));
  });
  await updateJob(validatedJob, {
    status: report.status === "FAIL" ? "FAILED" : "COMPLETE",
    uploadedBytes: file.size,
    uploadedChunks: validatedJob.totalChunks,
    validationStatus: report.status,
    validationSummary: report.summary,
    error: report.status === "FAIL" ? "Package imported to browser cache but failed validation." : undefined,
  });
  return { packageShape, graph, report };
}

async function uploadChunk(args: {
  job: InventoryImportJob;
  chunk: Blob;
  chunkIndex: number;
  totalChunks: number;
  maxRetries: number;
}) {
  let attempt = 0;
  const url = apiUrl(`${INVENTORY_IMPORT_JOBS_PATH}/${encodeURIComponent(args.job.jobId)}/chunks`);
  while (attempt <= args.maxRetries) {
    try {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      await requestJson<any>(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Hyperlinx-Chunk-Index": String(args.chunkIndex),
          "X-Hyperlinx-Total-Chunks": String(args.totalChunks),
          "X-Hyperlinx-Source-File": args.job.sourceFile,
          "X-Hyperlinx-Source-Format": args.job.sourceFormat,
        },
        body: args.chunk,
      });
      const end = typeof performance !== "undefined" ? performance.now() : Date.now();
      return { retryCount: attempt, responseTimeMs: Math.round(end - start) };
    } catch (err) {
      if (attempt >= args.maxRetries) throw err;
      attempt += 1;
    }
  }
  return { retryCount: attempt };
}

export async function uploadHyperlinxPackageFile(file: File, options: UploadOptions = {}) {
  const packageShape = await readHyperlinxInventoryPackageFile(file);
  const report = validateInventoryGraph(packageShape);
  const chunkSizeBytes = options.chunkSizeBytes ?? DEFAULT_CHUNK_BYTES;
  let job = await createInventoryImportJob({
    sourceFile: file.name,
    sourceFormat: options.sourceFormat ?? "HYPERLINX",
    totalBytes: file.size,
    inventoryId: packageShape.graphSummary.inventoryId,
    graphId: packageShape.graphSummary.graphId,
    chunkSizeBytes,
    validation: report,
  });

  if (report.status === "FAIL") {
    job = await updateJob(job, {
      status: "VALIDATING",
      validationStatus: report.status,
      validationSummary: report.summary,
    });
    job = await updateJob(job, {
      status: "FAILED",
      validationStatus: report.status,
      validationSummary: report.summary,
      error: "Package failed validation before upload.",
    });
    options.onProgress?.(progressFor(job, job.error));
    return job;
  }

  try {
    job = await updateJob(job, {
      status: "VALIDATING",
      validationStatus: report.status,
      validationSummary: report.summary,
    });
    job = await updateJob(job, { status: "UPLOADING" });
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSizeBytes));
    const startChunkIndex = options.startChunkIndex ?? 0;
    for (let chunkIndex = startChunkIndex; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSizeBytes;
      const end = Math.min(file.size, start + chunkSizeBytes);
      const result = await uploadChunk({
        job,
        chunk: file.slice(start, end),
        chunkIndex,
        totalChunks,
        maxRetries: options.maxRetries ?? MAX_RETRIES,
      });
      job = await updateJob(job, {
        status: "UPLOADING",
        uploadedBytes: end,
        uploadedChunks: chunkIndex + 1,
        retryCount: job.retryCount + Number(result.retryCount ?? 0),
        serverSupported: true,
      });
      options.onProgress?.({
        ...progressFor(job),
        responseTimeMs: result.responseTimeMs,
        currentChunkIndex: chunkIndex,
      });
    }
    job = await updateJob(job, {
      status: "CHUNKING",
      validationStatus: report.status,
      validationSummary: report.summary,
    });
    options.onProgress?.(progressFor(job, "All package chunks uploaded; waiting for server chunk assembly."));
    job = await updateJob(job, { status: "REGISTERING" });
    options.onProgress?.(progressFor(job, "Registering inventory package on DAL server."));
    return updateJob(job, { status: "COMPLETE", uploadedBytes: file.size, uploadedChunks: totalChunks });
  } catch (err) {
    const failed = await updateJob(job, {
      status: "FAILED",
      error: err instanceof Error ? err.message : String(err),
    });
    options.onProgress?.(progressFor(failed, failed.error));
    return failed;
  }
}

export async function getInventoryImportJob(jobId: string) {
  const local = await findRecord<InventoryImportJob>("inventoryImportJobs", jobId);
  const remote = await tryRequestJson<any>(apiUrl(`${INVENTORY_IMPORT_JOBS_PATH}/${encodeURIComponent(jobId)}`));
  return (remote?.job ?? remote?.data ?? remote ?? local) as InventoryImportJob | undefined;
}

export function describeImportStatus(status: InventoryImportJobStatus) {
  if (status === "QUEUED") return "Queued for DAL server import.";
  if (status === "UPLOADING") return "Uploading package chunks.";
  if (status === "IMPORTING") return "DAL server is importing source data.";
  if (status === "CHUNKING") return "DAL server is chunking inventory collections.";
  if (status === "VALIDATING") return "DAL server is validating inventory graph references.";
  if (status === "REGISTERING") return "DAL server is registering inventory metadata.";
  if (status === "COMPLETE") return "Inventory import complete.";
  return "Inventory import failed.";
}
