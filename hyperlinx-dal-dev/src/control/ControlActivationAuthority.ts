import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState, ScopeVersionTransitionResult } from "../scopeversion/ScopeVersionLifecycle";

export type ControlActivationStatus = "NOT_READY" | "REVIEW_REQUIRED" | "CONTROL_READY" | "CONTROL_ACTIVE";

export type ControlActivationBlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ControlActivationBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "MISSING_CONTRACT_CLOSE"
  | "MISSING_ENGINEERING_PACKAGE"
  | "MISSING_BUDGET"
  | "MISSING_VENDOR_ACCEPTANCE"
  | "MISSING_OBJECT_PACKAGE"
  | "MISSING_EXECUTION_STRATEGY"
  | "MISSING_DESIGN_STANDARD_APPROVAL"
  | "MISSING_REFERENCE_ARCHITECTURE"
  | "MISSING_CLOSE_CHAIN_VALIDATION"
  | "INVALID_LIFECYCLE_STATE"
  | "UNRESOLVED_CRITICAL_RISK"
  | "AI_ADVISORY_ONLY_RECOMMENDATION"
  | "LIFECYCLE_AUTHORITY_REJECTED"
  | "CONTROL_CLOSE_REJECTED";

export type ControlActivationDiagnosticCode =
  | "CONTROL_READINESS_STARTED"
  | "CONTROL_REQUIREMENTS_VALIDATED"
  | "CONTROL_BLOCKER_IDENTIFIED"
  | "CONTROL_READY"
  | "CONTROL_ACTIVATION_APPROVED"
  | "CONTROL_ACTIVATION_REJECTED"
  | "CONTROL_AUDIT_CREATED";

export interface ControlActivationRequirement {
  requirementId: string;
  label: string;
  blockerCode: ControlActivationBlockerCode;
  severity: ControlActivationBlockerSeverity;
  description: string;
}

export interface ControlActivationBlocker {
  blockerId: string;
  code: ControlActivationBlockerCode;
  severity: ControlActivationBlockerSeverity;
  message: string;
  requirementId?: string;
  resolved: boolean;
}

export interface ControlActivationDiagnostic {
  code: ControlActivationDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface ControlActivationAudit {
  auditId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  lifecycleState: ScopeVersionState;
  status: ControlActivationStatus;
  blockerIds: string[];
  closeIds: string[];
  actor: {
    actorId: string;
    actorRole: ScopeVersionCloseActorRole;
  };
  transitionResults: ScopeVersionTransitionResult[];
  createdAt: string;
  diagnostics: ControlActivationDiagnostic[];
}

export interface ControlActivationAuthority {
  authorityId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  controlClose?: ScopeVersionCloseEvent;
  transitionResults: ScopeVersionTransitionResult[];
  audit: ControlActivationAudit;
}

export const CONTROL_ACTIVATION_REQUIREMENTS: readonly ControlActivationRequirement[] = Object.freeze([
  {
    requirementId: "REQ-CONTROL-SCOPEVERSION",
    label: "ScopeVersion ID",
    blockerCode: "MISSING_SCOPEVERSION_ID",
    severity: "CRITICAL",
    description: "Control activation must trace to a ScopeVersion.",
  },
  {
    requirementId: "REQ-CONTROL-CUSTOMER",
    label: "Customer ID",
    blockerCode: "MISSING_CUSTOMER_ID",
    severity: "CRITICAL",
    description: "Control activation must preserve customer traceability.",
  },
  {
    requirementId: "REQ-CONTROL-OPPORTUNITY",
    label: "Opportunity ID",
    blockerCode: "MISSING_OPPORTUNITY_ID",
    severity: "CRITICAL",
    description: "Control activation must preserve opportunity traceability.",
  },
  {
    requirementId: "REQ-CONTROL-CORRIDOR",
    label: "Corridor ID",
    blockerCode: "MISSING_CORRIDOR_ID",
    severity: "CRITICAL",
    description: "Control activation must preserve corridor traceability.",
  },
  {
    requirementId: "REQ-CONTROL-CONTRACT-CLOSE",
    label: "Contract Close",
    blockerCode: "MISSING_CONTRACT_CLOSE",
    severity: "CRITICAL",
    description: "Control activation requires validated CONTRACT_CLOSE.",
  },
  {
    requirementId: "REQ-CONTROL-LIFECYCLE",
    label: "Lifecycle State",
    blockerCode: "INVALID_LIFECYCLE_STATE",
    severity: "CRITICAL",
    description: "Control activation starts only from CONTRACT_EXECUTED.",
  },
  {
    requirementId: "REQ-CONTROL-ENGINEERING-PACKAGE",
    label: "Approved Engineering Package",
    blockerCode: "MISSING_ENGINEERING_PACKAGE",
    severity: "HIGH",
    description: "Control activation requires approved engineering package.",
  },
  {
    requirementId: "REQ-CONTROL-BUDGET",
    label: "Approved Budget",
    blockerCode: "MISSING_BUDGET",
    severity: "HIGH",
    description: "Control activation requires approved budget.",
  },
  {
    requirementId: "REQ-CONTROL-VENDOR-ACCEPTANCE",
    label: "Approved Vendor Selections",
    blockerCode: "MISSING_VENDOR_ACCEPTANCE",
    severity: "HIGH",
    description: "Control activation requires approved vendor selections where applicable.",
  },
  {
    requirementId: "REQ-CONTROL-OBJECT-PACKAGE",
    label: "Approved Object Package",
    blockerCode: "MISSING_OBJECT_PACKAGE",
    severity: "HIGH",
    description: "Control activation requires approved object package.",
  },
  {
    requirementId: "REQ-CONTROL-EXECUTION-STRATEGY",
    label: "Execution Strategy",
    blockerCode: "MISSING_EXECUTION_STRATEGY",
    severity: "HIGH",
    description: "Control activation requires approved execution strategy.",
  },
  {
    requirementId: "REQ-CONTROL-DESIGN-STANDARDS",
    label: "Design Standards Satisfied",
    blockerCode: "MISSING_DESIGN_STANDARD_APPROVAL",
    severity: "HIGH",
    description: "Control activation requires required design standards to be satisfied.",
  },
  {
    requirementId: "REQ-CONTROL-REFERENCE-ARCHITECTURE",
    label: "Reference Architecture",
    blockerCode: "MISSING_REFERENCE_ARCHITECTURE",
    severity: "HIGH",
    description: "Control activation requires selected reference architecture.",
  },
  {
    requirementId: "REQ-CONTROL-CLOSE-CHAIN",
    label: "Close Chain Validated",
    blockerCode: "MISSING_CLOSE_CHAIN_VALIDATION",
    severity: "HIGH",
    description: "Control activation requires validated close chain.",
  },
]);
