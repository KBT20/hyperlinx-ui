import {
  markRuntimeDiagnostic,
  recordRuntimeArtifactRevision,
  recordRuntimeCacheEntries,
  recordRuntimeDuration,
} from "./RuntimeDiagnostics";
import { registerArtifactDependencies, resetArtifactDependencyGraph, resolveDependencyInvalidationOrder } from "./ArtifactDependencyGraph";
import { recordArtifactLineage, resetArtifactLineage } from "./ArtifactLineageEngine";
import { nextArtifactRevision, recordArtifactRevision, resetArtifactRevisionManager } from "./ArtifactRevisionManager";
import { registerRuntimeArtifact, resetArtifactRegistry } from "./ArtifactRegistry";
import type { RuntimeArtifactReference, RuntimeValidationStatus } from "./RuntimeContracts";

export type ConstitutionalArtifactType =
  | "ProductDoctrine"
  | "CommercialAuditProjection"
  | "AuditObjectManifest"
  | "ConstitutionalAssembly"
  | "DraftIofPackage"
  | "DraftIofStructuralProjection"
  | "CommercialFinancialProjection"
  | "PD002AAddressProjection"
  | "SpineObjectCatalogProjection"
  | "PD003ProductionProjection"
  | "SpineObjectInstantiation"
  | "KernelExecutionGraph"
  | "EngineeringProjection"
  | "RevenueProjection"
  | "MarketplaceProjection"
  | "OperationalIntelligenceProjection"
  | "MapLayerProjection"
  | "MapProjection";

export type ConstitutionalCacheStatus = "HIT" | "MISS" | "INVALIDATED";

export type ConstitutionalArtifactRecord<T> = {
  artifactId: string;
  artifactType: ConstitutionalArtifactType;
  inputHash: string;
  revision: number;
  timestamp: string;
  sourceDoctrineVersions: string[];
  doctrineVersions: string[];
  dependencies: string[];
  producedFrom: RuntimeArtifactReference[];
  generationDurationMs: number;
  cacheStatus: ConstitutionalCacheStatus;
  validationStatus: RuntimeValidationStatus;
  producer: string;
  value: T;
  createdAt: string;
  lastAccessedAt: string;
  hitCount: number;
  dependencyClass: string;
  ttlMs: number | null;
};

export type ConstitutionalCacheRequest<T> = {
  artifactId: string;
  artifactType: ConstitutionalArtifactType;
  input: unknown;
  doctrineVersions?: string[];
  sourceDoctrineVersions?: string[];
  dependencies?: string[];
  producedFrom?: RuntimeArtifactReference[];
  validationStatus?: RuntimeValidationStatus;
  producer: string;
  dependencyClass?: string;
  ttlMs?: number | null;
  create: () => T;
};

const records = new Map<string, ConstitutionalArtifactRecord<unknown>>();
const invalidations: Array<{ key: string; reason: string; invalidatedAt: string }> = [];
const MAX_CACHE_ENTRIES = 128;
const DEFAULT_DERIVED_TTL_MS = 30 * 60 * 1000;
let evictionCount = 0;

function stableJson(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (seen.has(value)) return '"[Circular]"';
  seen.add(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item, seen)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key], seen)}`)
    .join(",")}}`;
}

export function constitutionalInputHash(input: unknown) {
  const text = stableJson(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cacheKey(artifactType: ConstitutionalArtifactType, artifactId: string) {
  return `${artifactType}:${artifactId}`;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function readConstitutionalArtifact<T>(artifactType: ConstitutionalArtifactType, artifactId: string) {
  return records.get(cacheKey(artifactType, artifactId)) as ConstitutionalArtifactRecord<T> | undefined;
}

function evictExpiredAndOverflow(now = Date.now()) {
  for (const [key, record] of records) {
    if (record.ttlMs !== null && now - Date.parse(record.lastAccessedAt) > record.ttlMs) {
      records.delete(key);
      evictionCount += 1;
    }
  }
  while (records.size > MAX_CACHE_ENTRIES) {
    const oldest = [...records.entries()].sort((a, b) => a[1].lastAccessedAt.localeCompare(b[1].lastAccessedAt))[0];
    if (!oldest) break;
    records.delete(oldest[0]);
    evictionCount += 1;
  }
}

export function getOrCreateConstitutionalArtifact<T>(request: ConstitutionalCacheRequest<T>): ConstitutionalArtifactRecord<T> {
  const key = cacheKey(request.artifactType, request.artifactId);
  const doctrineVersions = request.doctrineVersions ?? request.sourceDoctrineVersions ?? [];
  const producedFrom = request.producedFrom ?? [];
  const dependencies = request.dependencies ?? producedFrom.map((reference) => cacheKey(reference.artifactType as ConstitutionalArtifactType, reference.artifactId));
  const inputHash = constitutionalInputHash({
    input: request.input,
    doctrineVersions,
    dependencies,
    producedFrom,
  });
  const existing = records.get(key) as ConstitutionalArtifactRecord<T> | undefined;
  const now = new Date().toISOString();
  const existingExpired = Boolean(existing?.ttlMs !== null && existing?.ttlMs !== undefined && Date.now() - Date.parse(existing.lastAccessedAt) > existing.ttlMs);
  if (existing?.inputHash === inputHash && !existingExpired) {
    markRuntimeDiagnostic("cacheHits");
    const hit = {
      ...existing,
      cacheStatus: "HIT" as const,
      lastAccessedAt: now,
      hitCount: existing.hitCount + 1,
    };
    records.set(key, hit as ConstitutionalArtifactRecord<unknown>);
    return hit;
  }

  markRuntimeDiagnostic("cacheMisses");
  const start = nowMs();
  const value = request.create();
  const generationDurationMs = nowMs() - start;
  const revision = nextArtifactRevision(request.artifactType, request.artifactId, existing);
  const record: ConstitutionalArtifactRecord<T> = {
    artifactId: request.artifactId,
    artifactType: request.artifactType,
    inputHash,
    revision,
    timestamp: new Date().toISOString(),
    sourceDoctrineVersions: doctrineVersions,
    doctrineVersions,
    dependencies,
    producedFrom,
    generationDurationMs,
    cacheStatus: "MISS",
    validationStatus: request.validationStatus ?? "PASS",
    producer: request.producer,
    value,
    createdAt: existing?.createdAt ?? now,
    lastAccessedAt: now,
    hitCount: 0,
    dependencyClass: request.dependencyClass ?? request.artifactType,
    ttlMs: request.ttlMs === undefined ? DEFAULT_DERIVED_TTL_MS : request.ttlMs,
  };
  records.set(key, record as ConstitutionalArtifactRecord<unknown>);
  evictExpiredAndOverflow();
  recordRuntimeDuration(`${request.artifactType}:${request.producer}`, generationDurationMs);
  recordRuntimeArtifactRevision(request.artifactId, revision);
  recordArtifactRevision(record);
  registerRuntimeArtifact(record);
  registerArtifactDependencies(record);
  recordArtifactLineage(record);
  recordRuntimeCacheEntries(records.size);
  return record;
}

export function invalidateConstitutionalArtifact(artifactType: ConstitutionalArtifactType, artifactId: string, reason = "Explicit artifact invalidation") {
  const key = cacheKey(artifactType, artifactId);
  const deleted = records.delete(key);
  if (deleted) invalidations.push({ key, reason, invalidatedAt: new Date().toISOString() });
  recordRuntimeCacheEntries(records.size);
  return deleted;
}

export function invalidateConstitutionalArtifactGraph(artifactType: ConstitutionalArtifactType, artifactId: string, reason = "Dependency graph invalidation") {
  const order = resolveDependencyInvalidationOrder(artifactType, artifactId);
  order.forEach((key) => {
    if (records.delete(key)) invalidations.push({ key, reason, invalidatedAt: new Date().toISOString() });
  });
  recordRuntimeCacheEntries(records.size);
  return order;
}

export function invalidateConstitutionalArtifactsByDependencyClass(dependencyClass: string, reason: string) {
  const keys = [...records.entries()].filter(([, record]) => record.dependencyClass === dependencyClass).map(([key]) => key);
  keys.forEach((key) => {
    records.delete(key);
    invalidations.push({ key, reason, invalidatedAt: new Date().toISOString() });
  });
  recordRuntimeCacheEntries(records.size);
  return keys;
}

export function constitutionalProjectionCacheTelemetry() {
  const hits = [...records.values()].reduce((total, record) => total + record.hitCount, 0);
  return {
    maximumEntries: MAX_CACHE_ENTRIES,
    entries: records.size,
    hits,
    misses: [...records.values()].filter((record) => record.hitCount === 0).length,
    evictions: evictionCount,
    invalidations: invalidations.length,
    lastInvalidation: invalidations.at(-1) ?? null,
    bounded: records.size <= MAX_CACHE_ENTRIES,
  };
}

export function listConstitutionalArtifacts() {
  return Array.from(records.values());
}

export function resetConstitutionalProjectionCache() {
  records.clear();
  invalidations.splice(0, invalidations.length);
  evictionCount = 0;
  resetArtifactRegistry();
  resetArtifactDependencyGraph();
  resetArtifactLineage();
  resetArtifactRevisionManager();
  recordRuntimeCacheEntries(0);
}
