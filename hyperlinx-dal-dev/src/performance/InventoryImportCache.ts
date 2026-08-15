import type { CustomerInventoryLoadResult } from "../customerInventory/CustomerNetworkInventory";
import type { CustomerTwinRenderableState } from "../customerTwin/CustomerTwin";
import type { CustomerDesignImport } from "../translate/CustomerDesignImport";
import type { DALCoordinate } from "../types/dal";

export type InventoryCacheKeyInput = {
  customerTwinId?: string | null;
  customerId?: string | null;
  inventorySourceId?: string | null;
  importHash?: string | null;
  routeCount?: number | null;
  lastModified?: string | number | null;
};

export type InventoryProjectionCacheRecord = {
  cacheKey: string;
  customerTwinId: string;
  customerId: string;
  inventorySourceId: string;
  importHash: string;
  routeCount: number;
  lastModified: string;
  storedAt: string;
  createdAt: string;
  lastAccessedAt: string;
  hitCount: number;
  inputFingerprint: string;
  artifactType: "CUSTOMER_TWIN_INVENTORY_PROJECTION";
  artifactId: string;
  revision: number;
  dependencyClass: "QUANTITY";
  loadResult: CustomerInventoryLoadResult;
  renderableTwin?: CustomerTwinRenderableState | null;
  projectionSummary: {
    routeCount: number;
    objectCount: number;
    stationCount: number;
  };
};

const inventoryProjectionCache = new Map<string, InventoryProjectionCacheRecord>();
const importDeduplicationIndex = new Map<string, CustomerDesignImport>();
const MAX_INVENTORY_PROJECTIONS = 16;
const MAX_IMPORT_DEDUPE_RECORDS = 64;
let inventoryEvictions = 0;

function enforceBounds<T>(cache: Map<string, T>, maximum: number) {
  while (cache.size > maximum) {
    const first = cache.keys().next().value as string | undefined;
    if (!first) break;
    cache.delete(first);
    inventoryEvictions += 1;
  }
}

function stableText(value: unknown) {
  return String(value ?? "").trim();
}

export function coordinateHash(coordinates: DALCoordinate[] = []) {
  const source = coordinates
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]))
    .map((coordinate) => `${Number(coordinate[0]).toFixed(7)},${Number(coordinate[1]).toFixed(7)}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `coord-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildInventoryImportHash(record: CustomerDesignImport | null | undefined) {
  if (!record) return "import-missing";
  const routeHashes = (record.routes ?? []).map((route) => [
    stableText(route.routeId),
    stableText(route.folderPath?.join("/")),
    stableText(route.provenance?.placemarkName),
    coordinateHash(route.dalGeometry ?? []),
  ].join(":"));
  const source = [
    stableText(record.sourceFileName),
    stableText(record.sourceType),
    stableText(record.uploadedAt),
    routeHashes.join("|"),
  ].join("::");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `import-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildInventoryCacheKey(input: InventoryCacheKeyInput) {
  return [
    stableText(input.customerTwinId) || "NO_TWIN",
    stableText(input.customerId) || "NO_CUSTOMER",
    stableText(input.inventorySourceId) || "NO_SOURCE",
    stableText(input.importHash) || "NO_IMPORT_HASH",
    Number(input.routeCount ?? 0),
    stableText(input.lastModified) || "NO_LAST_MODIFIED",
  ].join("::");
}

export function cacheInventoryProjection(input: {
  key: InventoryCacheKeyInput;
  loadResult: CustomerInventoryLoadResult;
  renderableTwin?: CustomerTwinRenderableState | null;
}) {
  const graph = input.loadResult.graph;
  const customerTwinId = stableText(input.key.customerTwinId) || graph.graphId || `CUSTOMER-TWIN-${stableText(input.key.customerId) || "UNKNOWN"}`;
  const routeCount = Number(input.key.routeCount ?? graph.summary.routeCount ?? 0);
  const cacheKey = buildInventoryCacheKey({
    customerTwinId,
    customerId: input.key.customerId,
    inventorySourceId: input.key.inventorySourceId ?? graph.inventorySessionVersion,
    importHash: input.key.importHash ?? graph.graphId,
    routeCount,
    lastModified: input.key.lastModified ?? graph.synchronizedAt,
  });
  const record: InventoryProjectionCacheRecord = {
    cacheKey,
    customerTwinId,
    customerId: stableText(input.key.customerId) || graph.accountId,
    inventorySourceId: stableText(input.key.inventorySourceId) || graph.inventorySessionVersion,
    importHash: stableText(input.key.importHash) || graph.graphId,
    routeCount,
    lastModified: stableText(input.key.lastModified) || graph.synchronizedAt,
    storedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    hitCount: 0,
    inputFingerprint: cacheKey,
    artifactType: "CUSTOMER_TWIN_INVENTORY_PROJECTION",
    artifactId: customerTwinId,
    revision: (inventoryProjectionCache.get(cacheKey)?.revision ?? 0) + 1,
    dependencyClass: "QUANTITY",
    loadResult: input.loadResult,
    renderableTwin: input.renderableTwin,
    projectionSummary: {
      routeCount: graph.summary.routeCount,
      objectCount: graph.summary.objectCount,
      stationCount: graph.summary.stationCount,
    },
  };
  inventoryProjectionCache.set(cacheKey, record);
  enforceBounds(inventoryProjectionCache, MAX_INVENTORY_PROJECTIONS);
  return record;
}

export function getCachedInventoryProjection(key: InventoryCacheKeyInput) {
  const cacheKey = buildInventoryCacheKey(key);
  const record = inventoryProjectionCache.get(cacheKey);
  if (!record) return null;
  const accessed = { ...record, lastAccessedAt: new Date().toISOString(), hitCount: record.hitCount + 1 };
  inventoryProjectionCache.delete(cacheKey);
  inventoryProjectionCache.set(cacheKey, accessed);
  return accessed;
}

export function findCachedInventoryProjectionForCustomer(customerId: string) {
  return [...inventoryProjectionCache.values()]
    .filter((record) => record.customerId === customerId)
    .sort((a, b) => b.storedAt.localeCompare(a.storedAt))[0] ?? null;
}

export function dedupeCustomerDesignImport(record: CustomerDesignImport) {
  const importHash = buildInventoryImportHash(record);
  const duplicate = importDeduplicationIndex.get(importHash);
  if (duplicate) {
    const updated: CustomerDesignImport = {
      ...duplicate,
      uploadedAt: record.uploadedAt,
      uploadedBy: record.uploadedBy,
      diagnostics: [...(duplicate.diagnostics ?? []), ...(record.diagnostics ?? [])],
      auditEvents: [...(duplicate.auditEvents ?? []), ...(record.auditEvents ?? [])],
    };
    importDeduplicationIndex.set(importHash, updated);
    enforceBounds(importDeduplicationIndex, MAX_IMPORT_DEDUPE_RECORDS);
    return { record: updated, importHash, duplicate: true };
  }
  importDeduplicationIndex.set(importHash, record);
  enforceBounds(importDeduplicationIndex, MAX_IMPORT_DEDUPE_RECORDS);
  return { record, importHash, duplicate: false };
}

export function inventoryCacheStats() {
  return {
    projectionRecords: inventoryProjectionCache.size,
    dedupeRecords: importDeduplicationIndex.size,
    maximumProjectionRecords: MAX_INVENTORY_PROJECTIONS,
    maximumDedupeRecords: MAX_IMPORT_DEDUPE_RECORDS,
    evictions: inventoryEvictions,
  };
}
