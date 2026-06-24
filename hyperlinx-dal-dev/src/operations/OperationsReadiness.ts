import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";

export type OperationsStatus =
  | "NOT_READY"
  | "REVIEW_REQUIRED"
  | "READY_FOR_OPERATIONS"
  | "OPERATIONS_ACTIVE";

export type OperationsRequirementType =
  | "TRACEABILITY"
  | "LIFECYCLE_STATE"
  | "COMPLETION_CLOSE_EVIDENCE"
  | "OWNER_READINESS"
  | "INVENTORY_READINESS"
  | "SERVICE_READINESS"
  | "DOCUMENTATION_READINESS"
  | "TURNOVER_PACKAGE"
  | "ACCEPTANCE_CRITERIA"
  | "BLOCKER_REVIEW";

export type OperationsAcceptanceType =
  | "ASSET_ACCEPTANCE"
  | "FACILITY_ACCEPTANCE"
  | "POWER_ACCEPTANCE"
  | "TRANSPORT_ACCEPTANCE"
  | "NETWORK_ACCEPTANCE"
  | "GPU_ACCEPTANCE"
  | "DATA_CENTER_ACCEPTANCE"
  | "CUSTOMER_ACCEPTANCE"
  | "OPERATIONAL_ACCEPTANCE"
  | "COMPOSITE_ACCEPTANCE";

export type OperationsBlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OperationsBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "COMPLETE_REQUIRED"
  | "MISSING_COMPLETION_CLOSE"
  | "MISSING_OPERATIONAL_OWNER"
  | "MISSING_SUPPORT_OWNER"
  | "MISSING_MAINTENANCE_OWNER"
  | "MISSING_ASSET_INVENTORY_REFERENCE"
  | "MISSING_SERVICE_INVENTORY_REFERENCE"
  | "MISSING_DOCUMENTATION"
  | "MISSING_TURNOVER_PACKAGE"
  | "MISSING_ACCEPTANCE_CRITERIA"
  | "UNRESOLVED_CRITICAL_BLOCKER"
  | "AI_ADVISORY_RECOMMENDATION"
  | "OPERATIONS_CLOSE_REJECTED"
  | "LIFECYCLE_AUTHORITY_REJECTED";

export type OperationsDiagnosticCode =
  | "OPERATIONS_EVALUATION_STARTED"
  | "OPERATIONS_REQUIREMENT_VALIDATED"
  | "OPERATIONS_BLOCKER_IDENTIFIED"
  | "OPERATIONS_READY"
  | "OPERATIONS_APPROVED"
  | "OPERATIONS_REJECTED"
  | "OPERATIONS_CLOSE_CREATED"
  | "OPERATIONS_AUDIT_CREATED";

export interface OperationsRequirement {
  requirementId: string;
  requirementType: OperationsRequirementType;
  label: string;
  description: string;
  blockerCode: OperationsBlockerCode;
  severity: OperationsBlockerSeverity;
}

export interface OperationsAcceptance {
  acceptanceId: string;
  acceptanceType: OperationsAcceptanceType;
  accepted: boolean;
  referenceIds: string[];
  evidenceIds: string[];
  acceptedBy: string;
  acceptedAt: string;
  notes?: string;
}

export interface OperationsBlocker {
  blockerId: string;
  code: OperationsBlockerCode;
  severity: OperationsBlockerSeverity;
  message: string;
  referenceId?: string;
  resolved: boolean;
}

export interface OperationsDiagnostic {
  code: OperationsDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface OperationsReadinessInput {
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  completionCloses: readonly ScopeVersionCloseEvent[];
  operationalOwnerId?: string;
  supportOwnerId?: string;
  maintenanceOwnerId?: string;
  assetInventoryReference?: string;
  serviceInventoryReference?: string;
  requiredDocumentationIds?: readonly string[];
  turnoverPackageIds?: readonly string[];
  acceptances?: readonly OperationsAcceptance[];
  unresolvedCriticalBlockers?: readonly string[];
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  notes?: string;
}

export interface OperationsReadiness {
  scopeVersionId?: string;
  valid: boolean;
  status: OperationsStatus;
  blockers: OperationsBlocker[];
  validatedCompletionCloseIds: string[];
  acceptedReferenceIds: string[];
  documentationIds: string[];
  turnoverPackageIds: string[];
  diagnostics: OperationsDiagnostic[];
}

export const OPERATIONS_REQUIREMENTS: readonly OperationsRequirement[] = Object.freeze([
  {
    requirementId: "OPS-REQ-TRACEABILITY",
    requirementType: "TRACEABILITY",
    label: "ScopeVersion traceability",
    description: "Operations must preserve scopeVersionId, customerId, opportunityId, and corridorId.",
    blockerCode: "MISSING_SCOPEVERSION_ID",
    severity: "CRITICAL",
  },
  {
    requirementId: "OPS-REQ-COMPLETE",
    requirementType: "LIFECYCLE_STATE",
    label: "Complete lifecycle",
    description: "Operations Authority may only evaluate ScopeVersions currently in COMPLETE.",
    blockerCode: "COMPLETE_REQUIRED",
    severity: "CRITICAL",
  },
  {
    requirementId: "OPS-REQ-COMPLETION-CLOSE",
    requirementType: "COMPLETION_CLOSE_EVIDENCE",
    label: "Validated Completion close",
    description: "Operations Authority requires a validated COMPLETION_CLOSE for the ScopeVersion.",
    blockerCode: "MISSING_COMPLETION_CLOSE",
    severity: "CRITICAL",
  },
  {
    requirementId: "OPS-REQ-OWNERS",
    requirementType: "OWNER_READINESS",
    label: "Operational ownership",
    description: "Operations requires operational, support, and maintenance owners.",
    blockerCode: "MISSING_OPERATIONAL_OWNER",
    severity: "CRITICAL",
  },
  {
    requirementId: "OPS-REQ-ASSET-INVENTORY",
    requirementType: "INVENTORY_READINESS",
    label: "Asset inventory reference",
    description: "Operations requires an asset inventory reference.",
    blockerCode: "MISSING_ASSET_INVENTORY_REFERENCE",
    severity: "HIGH",
  },
  {
    requirementId: "OPS-REQ-SERVICE-INVENTORY",
    requirementType: "SERVICE_READINESS",
    label: "Service inventory reference",
    description: "Operations requires a service inventory reference.",
    blockerCode: "MISSING_SERVICE_INVENTORY_REFERENCE",
    severity: "HIGH",
  },
  {
    requirementId: "OPS-REQ-DOCUMENTATION",
    requirementType: "DOCUMENTATION_READINESS",
    label: "Required documentation",
    description: "Operations requires required documentation references.",
    blockerCode: "MISSING_DOCUMENTATION",
    severity: "HIGH",
  },
  {
    requirementId: "OPS-REQ-TURNOVER",
    requirementType: "TURNOVER_PACKAGE",
    label: "Turnover package",
    description: "Operations requires required turnover package references.",
    blockerCode: "MISSING_TURNOVER_PACKAGE",
    severity: "CRITICAL",
  },
  {
    requirementId: "OPS-REQ-ACCEPTANCE",
    requirementType: "ACCEPTANCE_CRITERIA",
    label: "Operational acceptance",
    description: "Operations requires accepted operational readiness criteria.",
    blockerCode: "MISSING_ACCEPTANCE_CRITERIA",
    severity: "CRITICAL",
  },
  {
    requirementId: "OPS-REQ-BLOCKERS",
    requirementType: "BLOCKER_REVIEW",
    label: "No unresolved critical blockers",
    description: "Operations cannot proceed while critical blockers remain unresolved.",
    blockerCode: "UNRESOLVED_CRITICAL_BLOCKER",
    severity: "CRITICAL",
  },
]);
