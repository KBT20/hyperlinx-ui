import type { DALCoordinate } from "../../types/dal";
import type { ExecutionNodeType } from "../ExecutionGraphContracts";

export const CONSTITUTIONAL_CLOSURE_AUTHORITY = "CONSTITUTIONAL_CLOSURE_AUTHORITY" as const;
export const CONSTITUTIONAL_ASSEMBLY_AUTHORITY = "CONSTITUTIONAL_ASSEMBLY_AUTHORITY" as const;
export const CONSTITUTIONAL_CLOSURE_VERSION = "CCE-1" as const;
export const DERIVED_STATE_RULE = "STATE_DERIVED_ONLY_FROM_VALIDATED_CLOSE_REPLAY" as const;
export const PAYMENT_ELIGIBILITY_RULE = "NO_CLOSE_NO_VALIDATION_NO_PAYMENT" as const;
export const STATION_IS_ADDRESS_RULE = "STATIONS_LOCATE_SPINE_OBJECTS_BUT_DO_NOT_REPLACE_THEM" as const;

export const SUPPORTED_CLOSE_TYPES = [
  "COMMERCIAL_CLOSE",
  "ENGINEERING_CLOSE",
  "MARKETPLACE_CLOSE",
  "FUNDING_CLOSE",
  "CONTROL_RELEASE_CLOSE",
  "CONSTRUCTION_CLOSE",
  "PLACEMENT_CLOSE",
  "FIBER_PLACEMENT_CLOSE",
  "SPLICE_CLOSE",
  "TESTING_CLOSE",
  "INSPECTION_CLOSE",
  "AS_BUILT_CLOSE",
  "ACCEPTANCE_CLOSE",
  "OPERATIONAL_CLOSE",
  "MAINTENANCE_CLOSE",
  "RETIREMENT_CLOSE",
  "FIELD_REDLINE_CLOSE",
  "ENGINEERING_ACCEPTANCE_CLOSE",
] as const;

export type ConstitutionalCloseType = typeof SUPPORTED_CLOSE_TYPES[number];

export type CloseWorkspace =
  | "COMMERCIAL"
  | "ENGINEERING"
  | "MARKETPLACE"
  | "CONTROL"
  | "FIELD"
  | "OPERATIONAL"
  | "SYSTEM";

export type CloseAuthority =
  | "COMMERCIAL_CLOSE_AUTHORITY"
  | "ENGINEERING_CLOSE_AUTHORITY"
  | "MARKETPLACE_CLOSE_AUTHORITY"
  | "FUNDING_CLOSE_AUTHORITY"
  | "CONTROL_RELEASE_CLOSE_AUTHORITY"
  | "FIELD_CLOSE_AUTHORITY"
  | "OPERATIONAL_CLOSE_AUTHORITY"
  | typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;

export type ClosureValidationStatus = "ACCEPTED" | "REJECTED";

export interface ExpectedQuantity {
  quantityId: string;
  label: string;
  value: number;
  unit: string;
  tolerancePercent?: number;
}

export interface ExpectedMeasurement {
  measurementId: string;
  label: string;
  unit: string;
  required: boolean;
  tolerance?: number;
}

export interface ExpectedDoctrine {
  doctrineId: string;
  authority: string;
  source: string;
}

export interface ExecutionExpectation {
  expectationId: string;
  executionObjectId: string;
  spineObjectId: string;
  spineObjectType: ExecutionNodeType;
  nodeId: string;
  nodeType: ExecutionNodeType;
  stationId?: string;
  stationLabel?: string;
  measureFeet?: number;
  coordinate?: DALCoordinate;
  expectedWork: string[];
  expectedMaterials: string[];
  expectedQuantities: ExpectedQuantity[];
  expectedEvidence: string[];
  expectedMeasurements: ExpectedMeasurement[];
  expectedTolerance: {
    stationFeet?: number;
    coordinateFeet?: number;
    quantityPercent?: number;
    measurementPercent?: number;
  };
  expectedDoctrine: ExpectedDoctrine[];
  expectedDependencies: string[];
  expectedAcceptanceCriteria: string[];
  expectedCloseSequence: ConstitutionalCloseType[];
  legalCloseSequence: ConstitutionalCloseType[];
  dependencyGraphNotSchedule: true;
  paymentEligibilityRule: typeof PAYMENT_ELIGIBILITY_RULE;
  immutable: true;
  authority: typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface CloseValidationResult {
  status: ClosureValidationStatus;
  accepted: boolean;
  blockers: string[];
  warnings: string[];
  validatedAt: string;
  authority: typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;
}

export interface ConstitutionalClose {
  closeId: string;
  executionObjectId: string;
  spineObjectId: string;
  spineObjectIds: string[];
  nodeId: string;
  stationId?: string;
  stationLabel?: string;
  measureFeet?: number;
  coordinate?: DALCoordinate;
  closeType: ConstitutionalCloseType;
  workspace: CloseWorkspace;
  authority: CloseAuthority;
  actor: string;
  timestamp: string;
  expectationReference: string;
  evidenceReference: string[];
  validationResult: CloseValidationResult;
  accepted: boolean;
  reason: string;
  attachments: string[];
  gpsEvidence: Array<{ lat: number; lng: number; accuracyFeet?: number; capturedAt?: string }>;
  photoEvidence: Array<{ photoId: string; uri?: string; capturedAt?: string }>;
  notes: string;
  previousCloseId?: string;
  ledgerHash: string;
  immutable: true;
  redline?: {
    offset?: number;
    depth?: number;
    placement?: string;
    materialSubstitution?: string;
    utilityConflict?: string;
    obstruction?: string;
    accessIssue?: string;
    quantityVariance?: number;
  };
  requiresScopeVersionDelta?: boolean;
  noScopeVersionCreation: true;
  noServiceOrderCreation: true;
  noMarketplaceCreation: true;
  noControlCreation: true;
}

export interface ClosureLedger {
  ledgerId: string;
  packageId: string;
  graphId: string;
  executionObjectId: string;
  spineObjectId: string;
  nodeId: string;
  expectationId?: string;
  closes: ConstitutionalClose[];
  validatedCloses: ConstitutionalClose[];
  rejectedCloses: ConstitutionalClose[];
  pendingCloses: ConstitutionalClose[];
  acceptedCloseCount: number;
  rejectedCloseCount: number;
  pendingCloseCount: number;
  ledgerHash: string;
  immutable: true;
  authority: typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DerivedCurrentTruth {
  executionObjectId: string;
  spineObjectId: string;
  nodeId: string;
  status: "NO_CLOSES" | "PARTIAL" | "PROVEN" | "REDLINED" | "OPERATIONAL" | "RETIRED";
  derivedFromCloseIds: string[];
  rejectedCloseIds: string[];
  lastCloseId?: string;
  lastCloseType?: ConstitutionalCloseType;
  nextExpectedClose?: ConstitutionalCloseType;
  acceptedCloseTypes: ConstitutionalCloseType[];
  evidenceIds: string[];
  redlineCount: number;
  requiresScopeVersionDelta: boolean;
  derivedAt: string;
  mutableStateStored: false;
  derivedStateRule: typeof DERIVED_STATE_RULE;
  paymentEligibility: "NOT_ELIGIBLE" | "ELIGIBLE_AFTER_SEGMENT_ACCEPTANCE";
  revenueRealization: "NOT_REALIZED" | "ELIGIBLE_AFTER_VALIDATED_PAYMENT";
  authority: typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;
}

export interface NextDeterministicClose {
  executionObjectId: string;
  spineObjectId: string;
  nodeId: string;
  expectedClose?: ConstitutionalCloseType;
  requiredAuthority?: CloseAuthority;
  requiredEvidence: string[];
  requiredDependencies: string[];
  requiredDoctrine: ExpectedDoctrine[];
  blockingIssues: string[];
  readiness: "READY" | "BLOCKED" | "COMPLETE";
  authority: typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface ClosureReplayResult {
  executionObjectId: string;
  spineObjectId: string;
  nodeId: string;
  expectation?: ExecutionExpectation;
  ledger: ClosureLedger;
  currentTruth: DerivedCurrentTruth;
  nextDeterministicClose: NextDeterministicClose;
}

export interface ClosureGraphEnrichmentSummary {
  graphId: string;
  packageId: string;
  expectationCount: number;
  ledgerCount: number;
  validatedCloseCount: number;
  rejectedCloseCount: number;
  pendingCloseCount: number;
  topologyNodeCountUnchanged: number;
  topologyEdgeCountUnchanged: number;
  authority: typeof CONSTITUTIONAL_CLOSURE_AUTHORITY;
  noScopeVersionCreation: true;
  noServiceOrderCreation: true;
  noMarketplaceCreation: true;
  noControlCreation: true;
}

export interface ConstitutionalAssemblyResult {
  assemblyId: string;
  packageId: string;
  graphId: string;
  status: "PASS" | "FAIL";
  spineObjectCount: number;
  doctrineCount: number;
  dependencyGraphCount: number;
  legalCloseSequenceCount: number;
  evidenceRequirementCount: number;
  paymentValidationRelationshipCount: number;
  blockingIssues: string[];
  validatedAt: string;
  authority: typeof CONSTITUTIONAL_ASSEMBLY_AUTHORITY;
  draftIofApprovalProhibitedUntilPass: true;
  noScopeVersionCreation: true;
  noServiceOrderCreation: true;
  noMarketplaceCreation: true;
  noControlCreation: true;
}

export const CLOSE_AUTHORITY_BY_TYPE: Record<ConstitutionalCloseType, CloseAuthority> = {
  COMMERCIAL_CLOSE: "COMMERCIAL_CLOSE_AUTHORITY",
  ENGINEERING_CLOSE: "ENGINEERING_CLOSE_AUTHORITY",
  MARKETPLACE_CLOSE: "MARKETPLACE_CLOSE_AUTHORITY",
  FUNDING_CLOSE: "FUNDING_CLOSE_AUTHORITY",
  CONTROL_RELEASE_CLOSE: "CONTROL_RELEASE_CLOSE_AUTHORITY",
  CONSTRUCTION_CLOSE: "FIELD_CLOSE_AUTHORITY",
  PLACEMENT_CLOSE: "FIELD_CLOSE_AUTHORITY",
  FIBER_PLACEMENT_CLOSE: "FIELD_CLOSE_AUTHORITY",
  SPLICE_CLOSE: "FIELD_CLOSE_AUTHORITY",
  TESTING_CLOSE: "FIELD_CLOSE_AUTHORITY",
  INSPECTION_CLOSE: "FIELD_CLOSE_AUTHORITY",
  AS_BUILT_CLOSE: "FIELD_CLOSE_AUTHORITY",
  ACCEPTANCE_CLOSE: "ENGINEERING_CLOSE_AUTHORITY",
  OPERATIONAL_CLOSE: "OPERATIONAL_CLOSE_AUTHORITY",
  MAINTENANCE_CLOSE: "OPERATIONAL_CLOSE_AUTHORITY",
  RETIREMENT_CLOSE: "OPERATIONAL_CLOSE_AUTHORITY",
  FIELD_REDLINE_CLOSE: "FIELD_CLOSE_AUTHORITY",
  ENGINEERING_ACCEPTANCE_CLOSE: "ENGINEERING_CLOSE_AUTHORITY",
};

export const CLOSE_WORKSPACE_BY_TYPE: Record<ConstitutionalCloseType, CloseWorkspace> = {
  COMMERCIAL_CLOSE: "COMMERCIAL",
  ENGINEERING_CLOSE: "ENGINEERING",
  MARKETPLACE_CLOSE: "MARKETPLACE",
  FUNDING_CLOSE: "MARKETPLACE",
  CONTROL_RELEASE_CLOSE: "CONTROL",
  CONSTRUCTION_CLOSE: "FIELD",
  PLACEMENT_CLOSE: "FIELD",
  FIBER_PLACEMENT_CLOSE: "FIELD",
  SPLICE_CLOSE: "FIELD",
  TESTING_CLOSE: "FIELD",
  INSPECTION_CLOSE: "FIELD",
  AS_BUILT_CLOSE: "FIELD",
  ACCEPTANCE_CLOSE: "ENGINEERING",
  OPERATIONAL_CLOSE: "OPERATIONAL",
  MAINTENANCE_CLOSE: "OPERATIONAL",
  RETIREMENT_CLOSE: "OPERATIONAL",
  FIELD_REDLINE_CLOSE: "FIELD",
  ENGINEERING_ACCEPTANCE_CLOSE: "ENGINEERING",
};
