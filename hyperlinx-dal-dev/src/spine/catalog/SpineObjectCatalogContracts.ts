export const SPINE_OBJECT_CATALOG_AUTHORITY = "SPINE_OBJECT_CATALOG_AUTHORITY" as const;
export const SPINE_OBJECT_CATALOG_ID = "IOF-SPINE-OBJECT-CATALOG";
export const SPINE_OBJECT_CATALOG_VERSION = "24B.1";

export type SpineObjectClass =
  | "PRIMARY_STRUCTURE"
  | "LINEAR_INFRASTRUCTURE"
  | "LINEAR_CONSTRUCTION"
  | "CONTAINED_CONNECTION"
  | "CONSTRAINT"
  | "AUTHORITY";

export type SpineObjectAddressType =
  | "POINT"
  | "RANGE"
  | "PACKAGE"
  | "INHERITED"
  | "UNASSIGNED_REVIEW";

export type SpineObjectVisibility = "VISIBLE" | "SUMMARY" | "HIDDEN";
export type SpineObjectLifecycleParticipation = "EXECUTABLE" | "REVIEW_ONLY" | "AUTHORITY_ONLY" | "REFERENCE_ONLY";
export type SpineObjectReviewClassification = "STANDARD" | "ENGINEERING_REVIEW" | "COMMERCIAL_REVIEW" | "BLOCKING_REVIEW" | "NON_BLOCKING_REVIEW";
export type SpineObjectDefaultStatus = "MANIFESTED" | "PENDING_REVIEW" | "AUTHORITY_REQUIRED" | "NOT_INSTANTIATED_YET";
export type SpineObjectConstitutionalRole =
  | "EXECUTION_OBJECT"
  | "LINEAR_ASSET"
  | "CONSTRUCTION_METHOD"
  | "CONSTRAINT"
  | "CONTAINED_OBJECT"
  | "AUTHORITY"
  | "VALIDATION_OBJECT"
  | "PAYMENT_OBJECT"
  | "LIFECYCLE_OBJECT"
  | "REVIEW_OBJECT";

export type SpineObjectParticipation = "PARTICIPATES" | "REVIEW_ONLY" | "REFERENCE_ONLY" | "NOT_APPLICABLE";
export type SpineObjectAuthorityOwner = "COMMERCIAL" | "ENGINEERING" | "FIELD" | "CONTROL" | "OPERATIONAL_TWIN" | "SYSTEM";

export interface SpineObjectPaymentBehavior {
  paymentEligible: boolean;
  validationRelationship: "OBJECT_CLOSE_REQUIRED" | "SEGMENT_ACCEPTANCE_REQUIRED" | "REVIEW_DISPOSITION_REQUIRED" | "NO_PAYMENT_RELATIONSHIP";
  revenueRelationship: "REVENUE_ELIGIBLE_AFTER_VALIDATED_CLOSE" | "REFERENCE_ONLY" | "NOT_REVENUE_BEARING";
}

export interface SpineObjectDependencyTemplate {
  dependencyType: "PARENT_REQUIRED" | "ADDRESS_REQUIRED" | "DOCTRINE_REQUIRED" | "EVIDENCE_REQUIRED" | "REVIEW_REQUIRED" | "SEQUENCE_REQUIRED";
  description: string;
  required: boolean;
}

export interface SpineObjectExecutionStep {
  sequence: number;
  closeType: string;
  label: string;
  requiredEvidence: string[];
  legalAfter: string[];
}

export interface SpineObjectProfile {
  identity: string;
  displayName: string;
  description: string;
  constitutionalRole: SpineObjectConstitutionalRole;
  constitutionalRoles: SpineObjectConstitutionalRole[];
  objectClass: SpineObjectClass;
  objectType: string;
  defaultStatus: SpineObjectDefaultStatus;
  addressType: SpineObjectAddressType;
  commercialVisibility: SpineObjectVisibility;
  engineeringVisibility: SpineObjectVisibility;
  marketplaceVisibility: SpineObjectVisibility;
  controlVisibility: SpineObjectVisibility;
  fieldVisibility: SpineObjectVisibility;
  operationalTwinVisibility: SpineObjectVisibility;
  paymentParticipation: SpineObjectParticipation;
  reviewParticipation: SpineObjectParticipation;
  lifecycleParticipation: SpineObjectLifecycleParticipation;
  constructionParticipation: SpineObjectParticipation;
  engineeringReviewRequired: boolean;
  fieldReviewRequired: boolean;
  authorityOwner: SpineObjectAuthorityOwner;
  primaryProductionProfileId?: string;
  productionProfileIds: string[];
  materialProfileIds: string[];
}

export interface SpineObjectDoctrine {
  doctrineId: string;
  requiredDoctrine: string[];
  constitutionalRole: SpineObjectConstitutionalRole;
  behaviorSource: "SPINE_OBJECT_CATALOG";
  workspaceDuplicationProhibited: true;
}

export interface SpineObjectConstructionMethod {
  method: string;
  preference: "PREFERRED" | "FALLBACK" | "REQUIRED" | "ENGINEERING_REVIEW_REQUIRED" | "NOT_APPLICABLE";
  conditions: string[];
}

export interface SpineObjectPlacementStrategy {
  strategyId: string;
  label: string;
  behavior: string;
  engineeringRefinementPermitted: boolean;
  commercialBaselineMutable: false;
}

export interface SpineObjectHierarchy {
  legalParents: SpineObjectClass[];
  legalChildren: SpineObjectClass[];
  inheritanceRules: string[];
  illegalHierarchyFailsValidation: true;
  defaultPath: readonly [
    "MEASURED_SPINE",
    "EXECUTION_ZONE",
    "PAYMENT_SEGMENT",
    "CONSTRUCTION_SEGMENT",
    "STATION_ADDRESS",
    "PRIMARY_SPINE_OBJECT",
    "CONTAINED_OBJECTS",
  ];
}

export interface SpineObjectDependencyTemplates {
  templates: SpineObjectDependencyTemplate[];
  examples: string[];
}

export interface SpineObjectSequenceTemplates {
  templates: SpineObjectExecutionStep[];
  executionOutsideSprint24B: true;
}

export interface SpineObjectEvidenceTemplates {
  requiredEvidence: string[];
  evidenceByCloseType: Record<string, string[]>;
}

export interface SpineObjectVisibilityProfile {
  commercial: SpineObjectVisibility;
  engineering: SpineObjectVisibility;
  marketplace: SpineObjectVisibility;
  control: SpineObjectVisibility;
  field: SpineObjectVisibility;
  operationalTwin: SpineObjectVisibility;
}

export interface SpineObjectRecommendationTemplate {
  recommendationId: string;
  recommendation: string;
  deterministic: true;
  noAiReasoning: true;
}

export interface SpineObjectCatalogEntry {
  catalogEntryId: string;
  profile: SpineObjectProfile;
  constitutionalRole: SpineObjectConstitutionalRole;
  constitutionalRoles: SpineObjectConstitutionalRole[];
  objectClass: SpineObjectClass;
  objectType: string;
  displayName: string;
  description: string;
  addressType: SpineObjectAddressType;
  parentClasses: SpineObjectClass[];
  childClasses: SpineObjectClass[];
  requiredDoctrine: string[];
  defaultPlacementMethod: string;
  defaultEngineeringReview: string;
  requiredEvidence: string[];
  defaultDependencies: SpineObjectDependencyTemplate[];
  defaultExecutionSequence: SpineObjectExecutionStep[];
  defaultPaymentBehavior: SpineObjectPaymentBehavior;
  commercialVisibility: SpineObjectVisibility;
  engineeringVisibility: SpineObjectVisibility;
  marketplaceVisibility: SpineObjectVisibility;
  controlVisibility: SpineObjectVisibility;
  fieldVisibility: SpineObjectVisibility;
  operationalTwinVisibility: SpineObjectVisibility;
  twinVisibility: SpineObjectVisibility;
  paymentParticipation: SpineObjectParticipation;
  reviewParticipation: SpineObjectParticipation;
  lifecycleParticipation: SpineObjectLifecycleParticipation;
  constructionParticipation: SpineObjectParticipation;
  engineeringReviewRequired: boolean;
  fieldReviewRequired: boolean;
  authorityOwner: SpineObjectAuthorityOwner;
  primaryProductionProfileId?: string;
  productionProfileIds: string[];
  materialProfileIds: string[];
  reviewClassification: SpineObjectReviewClassification;
  defaultStatus: SpineObjectDefaultStatus;
  doctrine: SpineObjectDoctrine;
  constructionMethods: SpineObjectConstructionMethod[];
  placementStrategies: SpineObjectPlacementStrategy[];
  hierarchy: SpineObjectHierarchy;
  dependencyTemplates: SpineObjectDependencyTemplates;
  sequenceTemplates: SpineObjectSequenceTemplates;
  evidenceTemplates: SpineObjectEvidenceTemplates;
  visibilityProfile: SpineObjectVisibilityProfile;
  recommendationTemplates: SpineObjectRecommendationTemplate[];
  noScopeVersionCreation: true;
}

export interface SpineObjectCatalogValidationIssue {
  issueId: string;
  catalogEntryId?: string;
  objectType?: string;
  severity: "FAIL" | "WARNING";
  reason: string;
}

export interface SpineObjectCatalogValidation {
  validationId: string;
  catalogId: string;
  catalogVersion: string;
  status: "PASS" | "WARNING" | "FAIL";
  checkedEntryCount: number;
  checkedClassCount: number;
  illegalHierarchyCount: number;
  missingDoctrineCount: number;
  missingEvidenceCount: number;
  missingSequenceCount: number;
  warnings: SpineObjectCatalogValidationIssue[];
  failures: SpineObjectCatalogValidationIssue[];
  authority: typeof SPINE_OBJECT_CATALOG_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface SpineObjectCatalogSummary {
  catalogId: string;
  catalogVersion: string;
  catalogEntryCount: number;
  objectClasses: SpineObjectClass[];
  pointAddressCount: number;
  rangeAddressCount: number;
  inheritedAddressCount: number;
  reviewObjectCount: number;
  executableObjectCount: number;
  authorityObjectCount: number;
  profileCount: number;
  recommendationTemplateCount: number;
  productionProfileReferenceCount: number;
  instantiationStatus: "CATALOG_ONLY";
  noObjectsInstantiated: true;
  noScopeVersionCreation: true;
}

export interface SpineObjectCatalog {
  catalogId: string;
  catalogVersion: string;
  doctrineId: "PD-002B-PRECURSOR";
  authority: typeof SPINE_OBJECT_CATALOG_AUTHORITY;
  generatedAt: string;
  entries: SpineObjectCatalogEntry[];
  byObjectType: Record<string, SpineObjectCatalogEntry>;
  byClass: Record<SpineObjectClass, string[]>;
  validation: SpineObjectCatalogValidation;
  summary: SpineObjectCatalogSummary;
  instantiationStatus: "CATALOG_ONLY";
  createsObjects: false;
  noScopeVersionCreation: true;
}
