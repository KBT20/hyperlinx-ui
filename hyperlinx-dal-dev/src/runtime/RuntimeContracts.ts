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

export type RuntimeArtifactType = ConstitutionalArtifactType | string;
export type RuntimeCacheStatus = "HIT" | "MISS" | "INVALIDATED";
export type RuntimeValidationStatus = "PASS" | "WARNING" | "FAIL" | "NOT_VALIDATED";

export type RuntimeArtifactReference = {
  artifactId: string;
  artifactType: RuntimeArtifactType;
  revision?: number;
  inputHash?: string;
};

export type RuntimeArtifactRecord<T = unknown> = {
  artifactId: string;
  artifactType: RuntimeArtifactType;
  revision: number;
  inputHash: string;
  timestamp: string;
  producer: string;
  dependencies: string[];
  producedFrom: RuntimeArtifactReference[];
  doctrineVersions: string[];
  sourceDoctrineVersions: string[];
  generationDurationMs: number;
  cacheStatus: RuntimeCacheStatus;
  validationStatus: RuntimeValidationStatus;
  value: T;
};

export type RuntimeArtifactRequest<T> = {
  artifactId: string;
  artifactType: RuntimeArtifactType;
  input: unknown;
  doctrineVersions?: string[];
  sourceDoctrineVersions?: string[];
  dependencies?: string[];
  producedFrom?: RuntimeArtifactReference[];
  validationStatus?: RuntimeValidationStatus;
  producer: string;
  create: () => T;
};

export function runtimeArtifactKey(artifactType: RuntimeArtifactType, artifactId: string) {
  return `${artifactType}:${artifactId}`;
}

export function runtimeArtifactReferenceKey(reference: RuntimeArtifactReference) {
  return runtimeArtifactKey(reference.artifactType, reference.artifactId);
}

