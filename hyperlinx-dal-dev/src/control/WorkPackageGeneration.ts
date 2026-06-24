import type { ScopeVersionCloseActorRole } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";
import type {
  WorkPackage,
  WorkPackageAudit,
  WorkPackageDiagnostic,
  WorkPackageType,
} from "./WorkPackage";

export type WorkPackageGenerationStatus = "REJECTED" | "GENERATED";

export type WorkPackageBlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkPackageBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "CONTROL_ACTIVE_REQUIRED"
  | "MISSING_OBJECT_PACKAGE"
  | "MISSING_STATION_PACKAGE"
  | "MISSING_SEGMENT_PACKAGE"
  | "MISSING_BUDGET"
  | "MISSING_EXECUTION_STRATEGY"
  | "MISSING_DESIGN_STANDARDS"
  | "MISSING_REFERENCE_ARCHITECTURE"
  | "MISSING_VENDOR_ALLOCATIONS"
  | "UNRESOLVED_AUTHORITY_RISK"
  | "AI_ADVISORY_ONLY_RECOMMENDATION";

export interface WorkPackageGenerationRequirement {
  requirementId: string;
  label: string;
  blockerCode: WorkPackageBlockerCode;
  severity: WorkPackageBlockerSeverity;
  description: string;
}

export interface WorkPackageGenerationBlocker {
  blockerId: string;
  code: WorkPackageBlockerCode;
  severity: WorkPackageBlockerSeverity;
  message: string;
  requirementId?: string;
  resolved: boolean;
}

export interface WorkPackageGenerationApprovedPackages {
  objectPackageReference?: string;
  stationPackageReference?: string;
  segmentPackageReference?: string;
  budgetReference?: string;
  executionStrategyReference?: string;
  designStandardsReference?: string;
  referenceArchitecture?: string;
  vendorAllocationReferences?: string[];
}

export interface WorkPackageGenerationSource {
  stationIds: string[];
  segmentIds: string[];
  objectIds: string[];
  vendorIds: string[];
  productIds: string[];
  disciplines: string[];
  quantityReferences: string[];
}

export interface WorkPackageGenerationRiskContext {
  unresolvedAuthorityRisks?: string[];
  aiAdvisoryOnlyRecommendation?: boolean;
}

export interface WorkPackageGenerationInput {
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  controlActivationId?: string;
  controlCloseId?: string;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  approvedPackages: WorkPackageGenerationApprovedPackages;
  source: WorkPackageGenerationSource;
  requestedPackageTypes?: WorkPackageType[];
  riskContext?: WorkPackageGenerationRiskContext;
}

export interface WorkPackageAuthorityValidation {
  valid: boolean;
  blockers: WorkPackageGenerationBlocker[];
  satisfiedRequirementIds: string[];
  missingRequirementIds: string[];
  diagnostics: WorkPackageDiagnostic[];
}

export interface WorkPackageGenerationResult {
  scopeVersionId: string;
  status: WorkPackageGenerationStatus;
  workPackages: WorkPackage[];
  blockers: WorkPackageGenerationBlocker[];
  audit: WorkPackageAudit;
  diagnostics: WorkPackageDiagnostic[];
}

export const WORK_PACKAGE_GENERATION_REQUIREMENTS: readonly WorkPackageGenerationRequirement[] = Object.freeze([
  {
    requirementId: "REQ-WP-SCOPEVERSION",
    label: "ScopeVersion ID",
    blockerCode: "MISSING_SCOPEVERSION_ID",
    severity: "CRITICAL",
    description: "Work Packages must trace to a ScopeVersion.",
  },
  {
    requirementId: "REQ-WP-CUSTOMER",
    label: "Customer ID",
    blockerCode: "MISSING_CUSTOMER_ID",
    severity: "CRITICAL",
    description: "Work Packages must preserve customer traceability.",
  },
  {
    requirementId: "REQ-WP-OPPORTUNITY",
    label: "Opportunity ID",
    blockerCode: "MISSING_OPPORTUNITY_ID",
    severity: "CRITICAL",
    description: "Work Packages must preserve opportunity traceability.",
  },
  {
    requirementId: "REQ-WP-CORRIDOR",
    label: "Corridor ID",
    blockerCode: "MISSING_CORRIDOR_ID",
    severity: "CRITICAL",
    description: "Work Packages must preserve corridor traceability.",
  },
  {
    requirementId: "REQ-WP-CONTROL-ACTIVE",
    label: "CONTROL_ACTIVE",
    blockerCode: "CONTROL_ACTIVE_REQUIRED",
    severity: "CRITICAL",
    description: "Work Package generation requires CONTROL_ACTIVE.",
  },
  {
    requirementId: "REQ-WP-OBJECT-PACKAGE",
    label: "Approved Object Package",
    blockerCode: "MISSING_OBJECT_PACKAGE",
    severity: "HIGH",
    description: "Work Package generation requires approved object package.",
  },
  {
    requirementId: "REQ-WP-STATION-PACKAGE",
    label: "Approved Station Package",
    blockerCode: "MISSING_STATION_PACKAGE",
    severity: "HIGH",
    description: "Work Package generation requires approved station package.",
  },
  {
    requirementId: "REQ-WP-SEGMENT-PACKAGE",
    label: "Approved Segment Package",
    blockerCode: "MISSING_SEGMENT_PACKAGE",
    severity: "HIGH",
    description: "Work Package generation requires approved segment package.",
  },
  {
    requirementId: "REQ-WP-BUDGET",
    label: "Approved Budget",
    blockerCode: "MISSING_BUDGET",
    severity: "HIGH",
    description: "Work Package generation requires approved budget.",
  },
  {
    requirementId: "REQ-WP-EXECUTION-STRATEGY",
    label: "Execution Strategy",
    blockerCode: "MISSING_EXECUTION_STRATEGY",
    severity: "HIGH",
    description: "Work Package generation requires approved execution strategy.",
  },
  {
    requirementId: "REQ-WP-DESIGN-STANDARDS",
    label: "Design Standards",
    blockerCode: "MISSING_DESIGN_STANDARDS",
    severity: "HIGH",
    description: "Work Package generation requires approved design standards.",
  },
  {
    requirementId: "REQ-WP-REFERENCE-ARCHITECTURE",
    label: "Reference Architecture",
    blockerCode: "MISSING_REFERENCE_ARCHITECTURE",
    severity: "HIGH",
    description: "Work Package generation requires approved reference architecture.",
  },
  {
    requirementId: "REQ-WP-VENDOR-ALLOCATIONS",
    label: "Vendor Allocations",
    blockerCode: "MISSING_VENDOR_ALLOCATIONS",
    severity: "HIGH",
    description: "Work Package generation requires approved vendor allocations.",
  },
]);
