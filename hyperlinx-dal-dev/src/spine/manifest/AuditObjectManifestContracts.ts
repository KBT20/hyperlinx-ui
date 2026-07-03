import type {
  SpineObjectAddressType,
  SpineObjectCatalog,
  SpineObjectCatalogEntry,
  SpineObjectClass,
  SpineObjectLifecycleParticipation,
  SpineObjectVisibility,
} from "../catalog/SpineObjectCatalogContracts";

export const AUDIT_OBJECT_MANIFEST_AUTHORITY = "AUDIT_OBJECT_MANIFEST_AUTHORITY" as const;
export const AUDIT_OBJECT_MANIFEST_VERSION = "24B.1";

export type AuditObjectManifestReviewType =
  | "UNKNOWN_COMMERCIAL_QUANTITY"
  | "UNKNOWN_CONSTRAINT"
  | "LOW_CONFIDENCE_AUDIT_ITEM"
  | "ADDRESSING_REVIEW_REQUIRED"
  | "HIERARCHY_REVIEW_REQUIRED"
  | "GENERAL_ENGINEERING_REVIEW";

export interface ManifestExpectedHierarchy {
  parentObjectClasses: SpineObjectClass[];
  childObjectClasses: SpineObjectClass[];
  expectedParentObjectType?: string;
  expectedChildObjectTypes: string[];
  hierarchyStatus: "CATALOG_VALIDATED" | "REVIEW_REQUIRED";
}

export interface ManifestPlacementStrategy {
  addressType: SpineObjectAddressType;
  placementMethod: string;
  engineeringReview: string;
  stationingRequired: boolean;
  instantiationDeferred: true;
}

export interface ManifestVisibility {
  commercial: SpineObjectVisibility;
  engineering: SpineObjectVisibility;
  marketplace: SpineObjectVisibility;
  control: SpineObjectVisibility;
  field: SpineObjectVisibility;
  operationalTwin: SpineObjectVisibility;
  twin: SpineObjectVisibility;
  lifecycleParticipation: SpineObjectLifecycleParticipation;
}

export interface AuditObjectManifestEntry {
  manifestEntryId: string;
  packageId: string;
  catalogEntryId: string;
  objectClass: SpineObjectClass;
  objectType: string;
  catalogEntry: Pick<SpineObjectCatalogEntry, "catalogEntryId" | "objectType" | "displayName" | "objectClass" | "addressType">;
  constitutionalRole: SpineObjectCatalogEntry["constitutionalRole"];
  catalogProfile: SpineObjectCatalogEntry["profile"];
  sourceAuditEntryIds: string[];
  sourceDoctrines: string[];
  sourceQuantities: string[];
  expectedQuantity: number;
  expectedQuantityUnit: string;
  expectedHierarchy: ManifestExpectedHierarchy;
  placementStrategy: ManifestPlacementStrategy;
  constructionMethods: string[];
  constructionMethodTemplates: SpineObjectCatalogEntry["constructionMethods"];
  placementStrategies: SpineObjectCatalogEntry["placementStrategies"];
  requiredEvidence: string[];
  defaultDependencies: SpineObjectCatalogEntry["defaultDependencies"];
  defaultExecutionSequence: SpineObjectCatalogEntry["defaultExecutionSequence"];
  dependencyTemplates: SpineObjectCatalogEntry["dependencyTemplates"];
  sequenceTemplates: SpineObjectCatalogEntry["sequenceTemplates"];
  evidenceTemplates: SpineObjectCatalogEntry["evidenceTemplates"];
  recommendationTemplates: SpineObjectCatalogEntry["recommendationTemplates"];
  paymentBehavior: SpineObjectCatalogEntry["defaultPaymentBehavior"];
  visibility: ManifestVisibility;
  commercialReviewStatus: "VISIBLE" | "SUMMARY_ONLY";
  engineeringReviewStatus: "REQUIRED" | "OPTIONAL";
  instantiationStatus: "NOT_INSTANTIATED_YET";
  createsObject: false;
  noScopeVersionCreation: true;
}

export interface AuditManifestReviewObject {
  reviewObjectId: string;
  packageId: string;
  reviewType: AuditObjectManifestReviewType;
  label: string;
  catalogEntryId?: string;
  objectType?: string;
  blocking: boolean;
  confidence: number;
  commercialReason: string;
  engineeringDispositionRequired: boolean;
  sourceAuditEntryId?: string;
  instantiationStatus: "NOT_INSTANTIATED_YET";
  createsObject: false;
  noScopeVersionCreation: true;
}

export interface AuditObjectManifestValidationIssue {
  issueId: string;
  manifestEntryId?: string;
  reviewObjectId?: string;
  severity: "FAIL" | "WARNING";
  reason: string;
}

export interface AuditObjectManifestValidation {
  validationId: string;
  packageId: string;
  status: "PASS" | "WARNING" | "FAIL";
  checkedManifestEntryCount: number;
  checkedReviewObjectCount: number;
  invalidCatalogReferenceCount: number;
  illegalHierarchyCount: number;
  missingPaymentRelationshipCount: number;
  blockingReviewObjectCount: number;
  warnings: AuditObjectManifestValidationIssue[];
  failures: AuditObjectManifestValidationIssue[];
  authority: typeof AUDIT_OBJECT_MANIFEST_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface AuditObjectManifestSummary {
  summaryId: string;
  packageId: string;
  catalogId: string;
  catalogVersion: string;
  manifestEntryCount: number;
  reviewObjectCount: number;
  blockingReviewObjectCount: number;
  expectedPhysicalObjectTypeCount: number;
  expectedRangeObjectTypeCount: number;
  expectedPointObjectTypeCount: number;
  totalExpectedQuantity: number;
  status: "PASS" | "WARNING" | "FAIL";
  instantiationStatus: "NOT_INSTANTIATED_YET";
  createsObjects: false;
  noScopeVersionCreation: true;
}

export interface AuditObjectManifest {
  manifestId: string;
  packageId: string;
  catalogId: string;
  catalogVersion: string;
  manifestVersion: typeof AUDIT_OBJECT_MANIFEST_VERSION;
  authority: typeof AUDIT_OBJECT_MANIFEST_AUTHORITY;
  source: "COMMERCIAL_AUDIT";
  sourceDoctrines: string[];
  catalog: Pick<SpineObjectCatalog, "catalogId" | "catalogVersion" | "authority" | "summary">;
  requiredCatalogEntryIds: string[];
  entries: AuditObjectManifestEntry[];
  reviewObjects: AuditManifestReviewObject[];
  validation: AuditObjectManifestValidation;
  summary: AuditObjectManifestSummary;
  instantiationDeferredUntil: "SPRINT_24C";
  instantiationStatus: "NOT_INSTANTIATED_YET";
  createsObjects: false;
  noScopeVersionCreation: true;
}

export interface CreateAuditObjectManifestInput {
  packageId: string;
  catalog: SpineObjectCatalog;
  commercialAuditEntries?: unknown[];
  quantitySummary?: unknown;
  productConfiguration?: unknown;
  productDoctrineAssembly?: unknown;
  objectAddressing?: unknown;
  generatedAt?: string;
}
