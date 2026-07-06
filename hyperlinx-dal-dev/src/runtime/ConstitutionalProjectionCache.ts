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
  create: () => T;
};

const records = new Map<string, ConstitutionalArtifactRecord<unknown>>();

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
  if (existing?.inputHash === inputHash) {
    markRuntimeDiagnostic("cacheHits");
    return {
      ...existing,
      cacheStatus: "HIT",
    };
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
  };
  records.set(key, record as ConstitutionalArtifactRecord<unknown>);
  recordRuntimeDuration(`${request.artifactType}:${request.producer}`, generationDurationMs);
  recordRuntimeArtifactRevision(request.artifactId, revision);
  recordArtifactRevision(record);
  registerRuntimeArtifact(record);
  registerArtifactDependencies(record);
  recordArtifactLineage(record);
  recordRuntimeCacheEntries(records.size);
  return record;
}

export function invalidateConstitutionalArtifact(artifactType: ConstitutionalArtifactType, artifactId: string) {
  const deleted = records.delete(cacheKey(artifactType, artifactId));
  recordRuntimeCacheEntries(records.size);
  return deleted;
}

export function invalidateConstitutionalArtifactGraph(artifactType: ConstitutionalArtifactType, artifactId: string) {
  const order = resolveDependencyInvalidationOrder(artifactType, artifactId);
  order.forEach((key) => {
    records.delete(key);
  });
  recordRuntimeCacheEntries(records.size);
  return order;
}

export function listConstitutionalArtifacts() {
  return Array.from(records.values());
}

export function resetConstitutionalProjectionCache() {
  records.clear();
  resetArtifactRegistry();
  resetArtifactDependencyGraph();
  resetArtifactLineage();
  resetArtifactRevisionManager();
  recordRuntimeCacheEntries(0);
}
