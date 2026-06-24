import type { WorkPackage } from "../control/WorkPackage";
import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState, ScopeVersionTransitionResult } from "../scopeversion/ScopeVersionLifecycle";

export type FieldActivationStatus = "NOT_READY" | "REVIEW_REQUIRED" | "FIELD_READY" | "FIELD_ACTIVE";

export type FieldActivationBlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FieldActivationBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "MISSING_CONTROL_ACTIVE"
  | "MISSING_WORK_PACKAGES"
  | "MISSING_STATION_ALLOCATIONS"
  | "MISSING_SEGMENT_ALLOCATIONS"
  | "MISSING_OBJECT_ALLOCATIONS"
  | "MISSING_VENDOR_ALLOCATIONS"
  | "MISSING_EXECUTION_PACKAGE"
  | "MISSING_DEPENDENCY"
  | "MISSING_DESIGN_STANDARDS"
  | "INVALID_LIFECYCLE_STATE"
  | "UNRESOLVED_CRITICAL_RISK"
  | "AI_ADVISORY_RECOMMENDATION"
  | "LIFECYCLE_AUTHORITY_REJECTED"
  | "FIELD_CLOSE_REJECTED";

export type FieldActivationDiagnosticCode =
  | "FIELD_READINESS_STARTED"
  | "FIELD_REQUIREMENTS_VALIDATED"
  | "FIELD_BLOCKER_IDENTIFIED"
  | "FIELD_READY"
  | "FIELD_ACTIVATION_APPROVED"
  | "FIELD_ACTIVATION_REJECTED"
  | "FIELD_AUDIT_CREATED";

export interface FieldActivationRequirement {
  requirementId: string;
  label: string;
  blockerCode: FieldActivationBlockerCode;
  severity: FieldActivationBlockerSeverity;
  description: string;
}

export interface FieldActivationBlocker {
  blockerId: string;
  code: FieldActivationBlockerCode;
  severity: FieldActivationBlockerSeverity;
  message: string;
  requirementId?: string;
  resolved: boolean;
}

export interface FieldActivationDiagnostic {
  code: FieldActivationDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface FieldActivationAudit {
  auditId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  lifecycleState: ScopeVersionState;
  status: FieldActivationStatus;
  workPackageIds: string[];
  blockerIds: string[];
  closeIds: string[];
  actor: {
    actorId: string;
    actorRole: ScopeVersionCloseActorRole;
  };
  transitionResults: ScopeVersionTransitionResult[];
  createdAt: string;
  diagnostics: FieldActivationDiagnostic[];
}

export interface FieldActivationAuthority {
  authorityId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  workPackages: WorkPackage[];
  fieldClose?: ScopeVersionCloseEvent;
  transitionResults: ScopeVersionTransitionResult[];
  audit: FieldActivationAudit;
}

export interface FieldActivationResult {
  scopeVersionId: string;
  status: FieldActivationStatus;
  readiness: {
    status: FieldActivationStatus;
    blockers: FieldActivationBlocker[];
    satisfiedRequirementIds: string[];
    missingRequirementIds: string[];
  };
  fieldCloseDraft?: ScopeVersionCloseEvent;
  fieldClose?: ScopeVersionCloseEvent;
  transitionResults: ScopeVersionTransitionResult[];
  blockers: FieldActivationBlocker[];
  audit: FieldActivationAudit;
  diagnostics: FieldActivationDiagnostic[];
}

export const FIELD_ACTIVATION_REQUIREMENTS: readonly FieldActivationRequirement[] = Object.freeze([
  {
    requirementId: "REQ-FIELD-SCOPEVERSION",
    label: "ScopeVersion ID",
    blockerCode: "MISSING_SCOPEVERSION_ID",
    severity: "CRITICAL",
    description: "Field activation must trace to a ScopeVersion.",
  },
  {
    requirementId: "REQ-FIELD-CUSTOMER",
    label: "Customer ID",
    blockerCode: "MISSING_CUSTOMER_ID",
    severity: "CRITICAL",
    description: "Field activation must preserve customer traceability.",
  },
  {
    requirementId: "REQ-FIELD-OPPORTUNITY",
    label: "Opportunity ID",
    blockerCode: "MISSING_OPPORTUNITY_ID",
    severity: "CRITICAL",
    description: "Field activation must preserve opportunity traceability.",
  },
  {
    requirementId: "REQ-FIELD-CORRIDOR",
    label: "Corridor ID",
    blockerCode: "MISSING_CORRIDOR_ID",
    severity: "CRITICAL",
    description: "Field activation must preserve corridor traceability.",
  },
  {
    requirementId: "REQ-FIELD-CONTROL-ACTIVE",
    label: "CONTROL_ACTIVE",
    blockerCode: "MISSING_CONTROL_ACTIVE",
    severity: "CRITICAL",
    description: "Field activation requires CONTROL_ACTIVE.",
  },
  {
    requirementId: "REQ-FIELD-WORK-PACKAGES",
    label: "Approved Work Packages",
    blockerCode: "MISSING_WORK_PACKAGES",
    severity: "CRITICAL",
    description: "Field activation requires approved Work Packages.",
  },
  {
    requirementId: "REQ-FIELD-STATIONS",
    label: "Station Allocations",
    blockerCode: "MISSING_STATION_ALLOCATIONS",
    severity: "HIGH",
    description: "Field activation requires station allocations.",
  },
  {
    requirementId: "REQ-FIELD-SEGMENTS",
    label: "Segment Allocations",
    blockerCode: "MISSING_SEGMENT_ALLOCATIONS",
    severity: "HIGH",
    description: "Field activation requires segment allocations.",
  },
  {
    requirementId: "REQ-FIELD-OBJECTS",
    label: "Object Allocations",
    blockerCode: "MISSING_OBJECT_ALLOCATIONS",
    severity: "HIGH",
    description: "Field activation requires object allocations.",
  },
  {
    requirementId: "REQ-FIELD-VENDORS",
    label: "Vendor Allocations",
    blockerCode: "MISSING_VENDOR_ALLOCATIONS",
    severity: "HIGH",
    description: "Field activation requires vendor allocations.",
  },
  {
    requirementId: "REQ-FIELD-EXECUTION-PACKAGE",
    label: "Execution Package",
    blockerCode: "MISSING_EXECUTION_PACKAGE",
    severity: "HIGH",
    description: "Field activation requires approved execution package.",
  },
  {
    requirementId: "REQ-FIELD-DEPENDENCIES",
    label: "Dependencies Satisfied",
    blockerCode: "MISSING_DEPENDENCY",
    severity: "HIGH",
    description: "Field activation requires dependencies to be satisfied.",
  },
  {
    requirementId: "REQ-FIELD-DESIGN-STANDARDS",
    label: "Design Standards",
    blockerCode: "MISSING_DESIGN_STANDARDS",
    severity: "HIGH",
    description: "Field activation requires required design standards.",
  },
]);
