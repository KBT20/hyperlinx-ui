export type QuantityTruthState = "OBSERVED" | "DERIVED" | "PROPOSED" | "APPROVED" | "EXCEPTED";

export type QuantityReconciliationStatus =
  | "MATCH"
  | "SOURCE_OVERRIDE_REQUIRES_AUTHORITY"
  | "DOCTRINE_EXCEPTION_REQUIRED"
  | "MISSING_SOURCE"
  | "MISSING_DOCTRINE"
  | "ENGINEERING_REVIEW_REQUIRED"
  | "RESOLVED"
  | "SUPERSEDED";

export type QuantityDispositionType =
  | "ACCEPT_SOURCE"
  | "ACCEPT_DERIVED"
  | "CORRECT_SOURCE"
  | "APPROVE_DOCTRINE_EXCEPTION"
  | "REQUEST_COMMERCIAL_REVISION"
  | "REQUIRE_ADDITIONAL_EVIDENCE"
  | "DEFINE_SPLICE_ARCHITECTURE"
  | "BIND_OPTICAL_DESIGN";

export type QuantityAuthorityLevel =
  | "CERTIFIED_ENGINEERING"
  | "APPROVED_PROJECT_EXCEPTION"
  | "APPROVED_SOURCE_EVIDENCE"
  | "MEASURED_GEOMETRY"
  | "PRODUCT_DOCTRINE_DERIVATION"
  | "COMMERCIAL_ASSUMPTION"
  | "UNKNOWN";

export type QuantityArtifactScope = {
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  packageId: string;
  productId: string;
  productVersion: string;
  doctrineId: string;
  doctrineVersion: string;
};

export type QuantityEvidenceReference = {
  evidenceRef: string;
  sourceFile?: string;
  worksheet?: string;
  sourceLocation?: string;
  sourceHash: string;
  sourceAuthority: string;
  authorityMode: string;
};

export type QuantityCandidate = {
  candidateId: string;
  truthState: QuantityTruthState;
  quantity?: number;
  unit: string;
  authority: QuantityAuthorityLevel;
  method: string;
  formula?: string;
  doctrineRule?: string;
  geometryAuthority?: string;
  evidenceRefs: QuantityEvidenceReference[];
};

export type QuantityDisposition = {
  dispositionId: string;
  type: QuantityDispositionType;
  approvedQuantity?: number;
  approvedAuthority?: QuantityAuthorityLevel;
  reason: string;
  notes?: string;
  evidenceRefs: QuantityEvidenceReference[];
  engineeringAuthority: "ENGINEERING";
  engineeringReviewer: string;
  reviewedAt: string;
  decisionHash: string;
  engineeringDesignBinding?: {
    station?: string;
    milepost?: number;
    spanLength?: number;
    opticalLoss?: number;
    facilityClass?: string;
    powerRequirement?: string;
    powerEvidenceRef?: string;
    designEvidenceRef?: string;
    engineeringAuthority: "ENGINEERING";
  };
};

export type QuantityReconciliationItem = QuantityArtifactScope & {
  reconciliationItemId: string;
  objectClass: string;
  quantityType: string;
  unit: string;
  required: boolean;
  sourceCandidate: QuantityCandidate | null;
  derivedCandidate: QuantityCandidate | null;
  sourceQuantity?: number;
  sourceAuthority: string;
  sourceEvidenceRef?: string;
  derivedQuantity?: number;
  derivationMethod: string;
  derivationAuthority: QuantityAuthorityLevel;
  deltaAbsolute?: number;
  deltaPercent?: number;
  status: QuantityReconciliationStatus;
  disposition: QuantityDisposition | null;
  dispositionReason?: string;
  approvedQuantity?: number;
  engineeringAuthority?: "ENGINEERING";
  engineeringReviewer?: string;
  reviewedAt?: string;
  revisionId: string;
  sourceHash: string;
  decisionHash?: string;
  auditState: "OPEN" | "BLOCKED" | "RESOLVED" | "SUPERSEDED";
};

export type QuantityReconciliation = QuantityArtifactScope & {
  reconciliationId: string;
  revisionId: string;
  sourceHash: string;
  items: QuantityReconciliationItem[];
  status: "PASS" | "FAIL";
  resolvedCount: number;
  requiredCount: number;
  exceptionIds: string[];
  auditEventIds: string[];
  commercialImpactEventIds: string[];
  calculatedAt: string;
  calculationHash: string;
  noScopeVersionCreation: true;
  noExecutionAuthorization: true;
};

export type DoctrineException = QuantityArtifactScope & {
  exceptionId: string;
  doctrineRule: string;
  objectClass: string;
  stationRange?: string;
  expectedCondition: string;
  actualCondition: string;
  reason: string;
  impactSummary: string;
  evidenceRefs: QuantityEvidenceReference[];
  reviewer: string;
  authority: "CERTIFIED_ENGINEERING";
  createdAt: string;
  exceptionHash: string;
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "INCORPORATED_IN_FUTURE_DOCTRINE";
  globalDoctrineMutation: false;
};

export type SourceCorrectionRecord = QuantityArtifactScope & {
  correctionId: string;
  reconciliationItemId: string;
  originalSourceQuantity?: number;
  proposedCorrectedQuantity?: number;
  originalSourceHash: string;
  reason: string;
  evidenceRefs: QuantityEvidenceReference[];
  reviewer: string;
  createdAt: string;
  correctionHash: string;
  sourceMutation: false;
};

export type QuantityDispositionAuditEvent = QuantityArtifactScope & {
  auditEventId: string;
  reconciliationItemId: string;
  actor: string;
  action: QuantityDispositionType;
  occurredAt: string;
  previousState: QuantityReconciliationStatus;
  newState: QuantityReconciliationStatus;
  sourceValue?: number;
  derivedValue?: number;
  approvedValue?: number;
  selectedAuthority?: QuantityAuthorityLevel;
  reason: string;
  evidenceRefs: QuantityEvidenceReference[];
  packageRevision: string;
  previousDecisionHash?: string;
  eventHash: string;
};

export type EngineeringQuantityImpactEvent = QuantityArtifactScope & {
  impactEventId: string;
  eventType: "ENGINEERING_QUANTITY_IMPACT";
  reconciliationItemId: string;
  objectClass: string;
  previousQuantity?: number;
  approvedQuantity?: number;
  delta?: number;
  unit: string;
  potentialCostImpact: "UNKNOWN_REQUIRES_COMMERCIAL_AUTHORITY";
  commercialReviewRequired: boolean;
  reason: string;
  createdAt: string;
  impactHash: string;
  pricingMutation: false;
  requestCommercialRevision: boolean;
};

export type CommercialSourceWarning = QuantityArtifactScope & {
  warningId: string;
  warningType: "COMMERCIAL_SOURCE_WARNING";
  sourceField: string;
  difference: number;
  message: string;
  sourceHash: string;
  engineeringDispositionRequired: false;
  commercialRecalculationRequired: boolean;
};

export type QuantityDispositionResult = {
  reconciliation: QuantityReconciliation;
  item: QuantityReconciliationItem;
  auditEvent: QuantityDispositionAuditEvent;
  doctrineException?: DoctrineException;
  sourceCorrection?: SourceCorrectionRecord;
  commercialImpact?: EngineeringQuantityImpactEvent;
  commercialRevisionRequested: boolean;
};
