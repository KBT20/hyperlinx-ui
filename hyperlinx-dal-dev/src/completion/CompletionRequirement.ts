import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";

export type CompletionStatus =
  | "NOT_READY"
  | "REVIEW_REQUIRED"
  | "READY_FOR_COMPLETION"
  | "COMPLETE";

export type CompletionRequirementType =
  | "TRACEABILITY"
  | "LIFECYCLE_STATE"
  | "FIELD_CLOSE_EVIDENCE"
  | "WORK_PACKAGE_CLOSURE"
  | "OBJECT_CLOSURE"
  | "STATION_CLOSURE"
  | "SEGMENT_CLOSURE"
  | "DELIVERABLE_CLOSURE"
  | "ACCEPTANCE_CRITERIA"
  | "BLOCKER_REVIEW";

export type CompletionAcceptanceType =
  | "OBJECT_ACCEPTANCE"
  | "STATION_ACCEPTANCE"
  | "SEGMENT_ACCEPTANCE"
  | "WORK_PACKAGE_ACCEPTANCE"
  | "FACILITY_ACCEPTANCE"
  | "POWER_ACCEPTANCE"
  | "TRANSPORT_ACCEPTANCE"
  | "CUSTOMER_ACCEPTANCE"
  | "COMPOSITE_ACCEPTANCE";

export type CompletionBlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CompletionBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "FIELD_ACTIVE_REQUIRED"
  | "MISSING_FIELD_CLOSE"
  | "MISSING_WORK_PACKAGE_CLOSE"
  | "MISSING_OBJECT_CLOSE"
  | "MISSING_STATION_CLOSE"
  | "MISSING_SEGMENT_CLOSE"
  | "MISSING_DELIVERABLE_CLOSE"
  | "MISSING_ACCEPTANCE_CRITERIA"
  | "UNRESOLVED_CRITICAL_BLOCKER"
  | "AI_ADVISORY_RECOMMENDATION"
  | "COMPLETION_CLOSE_REJECTED"
  | "LIFECYCLE_AUTHORITY_REJECTED";

export type CompletionDiagnosticCode =
  | "COMPLETION_EVALUATION_STARTED"
  | "COMPLETION_REQUIREMENT_VALIDATED"
  | "COMPLETION_BLOCKER_IDENTIFIED"
  | "COMPLETION_READY"
  | "COMPLETION_APPROVED"
  | "COMPLETION_REJECTED"
  | "COMPLETION_CLOSE_CREATED"
  | "COMPLETION_AUDIT_CREATED";

export interface CompletionRequirement {
  requirementId: string;
  requirementType: CompletionRequirementType;
  label: string;
  description: string;
  blockerCode: CompletionBlockerCode;
  severity: CompletionBlockerSeverity;
}

export interface CompletionAcceptance {
  acceptanceId: string;
  acceptanceType: CompletionAcceptanceType;
  accepted: boolean;
  referenceIds: string[];
  evidenceIds: string[];
  acceptedBy: string;
  acceptedAt: string;
  notes?: string;
}

export interface CompletionBlocker {
  blockerId: string;
  code: CompletionBlockerCode;
  severity: CompletionBlockerSeverity;
  message: string;
  referenceId?: string;
  resolved: boolean;
}

export interface CompletionDiagnostic {
  code: CompletionDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface CompletionReadinessInput {
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  fieldCloses: readonly ScopeVersionCloseEvent[];
  requiredWorkPackageIds?: readonly string[];
  requiredObjectIds?: readonly string[];
  requiredStationIds?: readonly string[];
  requiredSegmentIds?: readonly string[];
  requiredDeliverableIds?: readonly string[];
  acceptances?: readonly CompletionAcceptance[];
  unresolvedCriticalBlockers?: readonly string[];
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  notes?: string;
}

export const COMPLETION_REQUIREMENTS: readonly CompletionRequirement[] = Object.freeze([
  {
    requirementId: "COMP-REQ-TRACEABILITY",
    requirementType: "TRACEABILITY",
    label: "ScopeVersion traceability",
    description: "Completion must preserve scopeVersionId, customerId, opportunityId, and corridorId.",
    blockerCode: "MISSING_SCOPEVERSION_ID",
    severity: "CRITICAL",
  },
  {
    requirementId: "COMP-REQ-FIELD-ACTIVE",
    requirementType: "LIFECYCLE_STATE",
    label: "Field active lifecycle",
    description: "Completion review may only evaluate ScopeVersions currently in FIELD_ACTIVE.",
    blockerCode: "FIELD_ACTIVE_REQUIRED",
    severity: "CRITICAL",
  },
  {
    requirementId: "COMP-REQ-FIELD-CLOSE",
    requirementType: "FIELD_CLOSE_EVIDENCE",
    label: "Validated Field closes",
    description: "Completion requires at least one validated FIELD_CLOSE event for the ScopeVersion.",
    blockerCode: "MISSING_FIELD_CLOSE",
    severity: "CRITICAL",
  },
  {
    requirementId: "COMP-REQ-WORK-PACKAGE",
    requirementType: "WORK_PACKAGE_CLOSURE",
    label: "Required Work Packages closed",
    description: "Every required Work Package must be referenced by validated Field closure evidence.",
    blockerCode: "MISSING_WORK_PACKAGE_CLOSE",
    severity: "CRITICAL",
  },
  {
    requirementId: "COMP-REQ-OBJECT",
    requirementType: "OBJECT_CLOSURE",
    label: "Required Objects closed",
    description: "Every required Object must be referenced by validated Field closure evidence.",
    blockerCode: "MISSING_OBJECT_CLOSE",
    severity: "HIGH",
  },
  {
    requirementId: "COMP-REQ-STATION",
    requirementType: "STATION_CLOSURE",
    label: "Required Stations closed",
    description: "Every required Station must be referenced by validated Field closure evidence.",
    blockerCode: "MISSING_STATION_CLOSE",
    severity: "HIGH",
  },
  {
    requirementId: "COMP-REQ-SEGMENT",
    requirementType: "SEGMENT_CLOSURE",
    label: "Required Segments closed",
    description: "Every required Segment must be referenced by validated Field closure evidence.",
    blockerCode: "MISSING_SEGMENT_CLOSE",
    severity: "HIGH",
  },
  {
    requirementId: "COMP-REQ-DELIVERABLE",
    requirementType: "DELIVERABLE_CLOSURE",
    label: "Required Deliverables closed",
    description: "Every required Deliverable must be supported by closure evidence or acceptance evidence.",
    blockerCode: "MISSING_DELIVERABLE_CLOSE",
    severity: "HIGH",
  },
  {
    requirementId: "COMP-REQ-ACCEPTANCE",
    requirementType: "ACCEPTANCE_CRITERIA",
    label: "Acceptance criteria satisfied",
    description: "Completion requires accepted Object, Station, Segment, Work Package, or Composite acceptance evidence.",
    blockerCode: "MISSING_ACCEPTANCE_CRITERIA",
    severity: "CRITICAL",
  },
  {
    requirementId: "COMP-REQ-BLOCKERS",
    requirementType: "BLOCKER_REVIEW",
    label: "No unresolved critical blockers",
    description: "Completion cannot proceed while critical blockers remain unresolved.",
    blockerCode: "UNRESOLVED_CRITICAL_BLOCKER",
    severity: "CRITICAL",
  },
]);
