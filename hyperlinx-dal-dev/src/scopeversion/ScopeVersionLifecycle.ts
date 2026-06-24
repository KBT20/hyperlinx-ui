import type { ScopeVersionCloseActorRole, ScopeVersionCloseType } from "./ScopeVersionCloseAuthority";

export type ScopeVersionState =
  | "INTENT"
  | "DESIGN"
  | "ENGINEERING_REVIEW"
  | "ENGINEERING_APPROVED"
  | "COMMERCIAL_REVIEW"
  | "BUDGET_CANDIDATE"
  | "BUDGET_LOCKED"
  | "VENDOR_REVIEW"
  | "VENDOR_ACCEPTED"
  | "CUSTOMER_REVIEW"
  | "CUSTOMER_ACCEPTED"
  | "CONTRACT_REVIEW"
  | "CONTRACT_EXECUTED"
  | "CONTROL_READY"
  | "CONTROL_ACTIVE"
  | "FIELD_READY"
  | "FIELD_ACTIVE"
  | "COMPLETION_REVIEW"
  | "COMPLETE"
  | "OPERATIONS"
  | "SUPERSEDED"
  | "CANCELLED";

export type ScopeVersionLifecycleDiagnosticCode =
  | "LIFECYCLE_TRANSITION_EVALUATED"
  | "LIFECYCLE_TRANSITION_APPROVED"
  | "LIFECYCLE_TRANSITION_REJECTED"
  | "LIFECYCLE_REQUIREMENT_MISSING"
  | "LIFECYCLE_AUDIT_CREATED";

export interface ScopeVersionLifecycleDiagnostic {
  code: ScopeVersionLifecycleDiagnosticCode;
  transitionId: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface ScopeVersionTransition {
  transitionId: string;
  from: ScopeVersionState;
  to: ScopeVersionState;
  governedException?: boolean;
  description: string;
}

export interface ScopeVersionTransitionRequirement {
  requirementId: string;
  targetState: ScopeVersionState;
  requiredCloseTypes: ScopeVersionCloseType[];
  requiredEvidence: boolean;
  requiredAuthorityRoles: ScopeVersionCloseActorRole[];
  notes?: string;
}

export interface ScopeVersionTransitionAuthority {
  authorityId: string;
  transition: ScopeVersionTransition;
  authorizedRoles: ScopeVersionCloseActorRole[];
  requiredCloseTypes: ScopeVersionCloseType[];
  notes?: string;
}

export interface ScopeVersionTransitionResult {
  transitionId: string;
  scopeVersionId: string;
  previousState: ScopeVersionState;
  requestedState: ScopeVersionState;
  approved: boolean;
  missingCloseTypes: ScopeVersionCloseType[];
  validatedCloseIds: string[];
  authority?: ScopeVersionTransitionAuthority;
  actor: {
    actorId: string;
    actorRole: ScopeVersionCloseActorRole;
  };
  evaluatedAt: string;
  diagnostics: ScopeVersionLifecycleDiagnostic[];
}

export interface ScopeVersionLifecycleAudit {
  auditId: string;
  scopeVersionId: string;
  previousState: ScopeVersionState;
  requestedState: ScopeVersionState;
  requiredCloses: ScopeVersionCloseType[];
  validatedCloses: string[];
  authority?: ScopeVersionTransitionAuthority;
  actor: {
    actorId: string;
    actorRole: ScopeVersionCloseActorRole;
  };
  timestamp: string;
  result: "APPROVED" | "REJECTED";
  diagnostics: ScopeVersionLifecycleDiagnostic[];
}

export const SCOPEVERSION_STATE_REGISTRY: readonly ScopeVersionState[] = Object.freeze([
  "INTENT",
  "DESIGN",
  "ENGINEERING_REVIEW",
  "ENGINEERING_APPROVED",
  "COMMERCIAL_REVIEW",
  "BUDGET_CANDIDATE",
  "BUDGET_LOCKED",
  "VENDOR_REVIEW",
  "VENDOR_ACCEPTED",
  "CUSTOMER_REVIEW",
  "CUSTOMER_ACCEPTED",
  "CONTRACT_REVIEW",
  "CONTRACT_EXECUTED",
  "CONTROL_READY",
  "CONTROL_ACTIVE",
  "FIELD_READY",
  "FIELD_ACTIVE",
  "COMPLETION_REVIEW",
  "COMPLETE",
  "OPERATIONS",
  "SUPERSEDED",
  "CANCELLED",
]);

export const SCOPEVERSION_TRANSITION_REGISTRY: readonly ScopeVersionTransition[] = Object.freeze([
  { transitionId: "SVT-INTENT-DESIGN", from: "INTENT", to: "DESIGN", description: "Intent advances to design." },
  { transitionId: "SVT-DESIGN-ENGINEERING-REVIEW", from: "DESIGN", to: "ENGINEERING_REVIEW", description: "Design enters engineering review." },
  { transitionId: "SVT-ENGINEERING-REVIEW-APPROVED", from: "ENGINEERING_REVIEW", to: "ENGINEERING_APPROVED", description: "Engineering review approves the ScopeVersion." },
  { transitionId: "SVT-ENGINEERING-APPROVED-COMMERCIAL-REVIEW", from: "ENGINEERING_APPROVED", to: "COMMERCIAL_REVIEW", description: "Approved engineering enters commercial review." },
  { transitionId: "SVT-COMMERCIAL-REVIEW-BUDGET-CANDIDATE", from: "COMMERCIAL_REVIEW", to: "BUDGET_CANDIDATE", description: "Commercial review creates budget candidates." },
  { transitionId: "SVT-BUDGET-CANDIDATE-LOCKED", from: "BUDGET_CANDIDATE", to: "BUDGET_LOCKED", description: "Budget candidate becomes locked commercial truth." },
  { transitionId: "SVT-BUDGET-LOCKED-VENDOR-REVIEW", from: "BUDGET_LOCKED", to: "VENDOR_REVIEW", description: "Locked budget enters vendor review." },
  { transitionId: "SVT-VENDOR-REVIEW-ACCEPTED", from: "VENDOR_REVIEW", to: "VENDOR_ACCEPTED", description: "Vendor acceptance is recorded." },
  { transitionId: "SVT-VENDOR-ACCEPTED-CUSTOMER-REVIEW", from: "VENDOR_ACCEPTED", to: "CUSTOMER_REVIEW", description: "Vendor accepted scope enters customer review." },
  { transitionId: "SVT-CUSTOMER-REVIEW-ACCEPTED", from: "CUSTOMER_REVIEW", to: "CUSTOMER_ACCEPTED", description: "Customer acceptance is recorded." },
  { transitionId: "SVT-CUSTOMER-ACCEPTED-CONTRACT-REVIEW", from: "CUSTOMER_ACCEPTED", to: "CONTRACT_REVIEW", description: "Customer accepted scope enters contract review." },
  { transitionId: "SVT-CONTRACT-REVIEW-EXECUTED", from: "CONTRACT_REVIEW", to: "CONTRACT_EXECUTED", description: "Contract execution is recorded." },
  { transitionId: "SVT-CONTRACT-EXECUTED-CONTROL-READY", from: "CONTRACT_EXECUTED", to: "CONTROL_READY", description: "Contract executed scope becomes ready for Control." },
  { transitionId: "SVT-CONTROL-READY-ACTIVE", from: "CONTROL_READY", to: "CONTROL_ACTIVE", description: "Control activates work authority." },
  { transitionId: "SVT-CONTROL-ACTIVE-FIELD-READY", from: "CONTROL_ACTIVE", to: "FIELD_READY", description: "Control active work becomes ready for Field." },
  { transitionId: "SVT-FIELD-READY-ACTIVE", from: "FIELD_READY", to: "FIELD_ACTIVE", description: "Field execution authority begins." },
  { transitionId: "SVT-FIELD-ACTIVE-COMPLETION-REVIEW", from: "FIELD_ACTIVE", to: "COMPLETION_REVIEW", description: "Field active work enters completion review." },
  { transitionId: "SVT-COMPLETION-REVIEW-COMPLETE", from: "COMPLETION_REVIEW", to: "COMPLETE", description: "Completion is recorded." },
  { transitionId: "SVT-COMPLETE-OPERATIONS", from: "COMPLETE", to: "OPERATIONS", description: "Complete scope enters operations." },
  { transitionId: "SVT-SUPERSEDED", from: "ENGINEERING_APPROVED", to: "SUPERSEDED", governedException: true, description: "Governed supersede path." },
  { transitionId: "SVT-CANCELLED", from: "INTENT", to: "CANCELLED", governedException: true, description: "Governed cancel path." },
]);

export const SCOPEVERSION_TRANSITION_REQUIREMENTS: readonly ScopeVersionTransitionRequirement[] = Object.freeze([
  { requirementId: "REQ-ENGINEERING-APPROVED", targetState: "ENGINEERING_APPROVED", requiredCloseTypes: ["ENGINEERING_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_ENGINEERING"] },
  { requirementId: "REQ-BUDGET-LOCKED", targetState: "BUDGET_LOCKED", requiredCloseTypes: ["COMMERCIAL_CLOSE", "BUDGET_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_MARKETPLACE", "FINANCE"] },
  { requirementId: "REQ-VENDOR-ACCEPTED", targetState: "VENDOR_ACCEPTED", requiredCloseTypes: ["VENDOR_ACCEPTANCE_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["VENDOR", "TERALINX_MARKETPLACE"] },
  { requirementId: "REQ-CUSTOMER-ACCEPTED", targetState: "CUSTOMER_ACCEPTED", requiredCloseTypes: ["CUSTOMER_ACCEPTANCE_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["CUSTOMER", "TERALINX_SALES"] },
  { requirementId: "REQ-CONTRACT-EXECUTED", targetState: "CONTRACT_EXECUTED", requiredCloseTypes: ["CONTRACT_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["LEGAL"] },
  { requirementId: "REQ-CONTROL-ACTIVE", targetState: "CONTROL_ACTIVE", requiredCloseTypes: ["CONTROL_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_OPERATIONS", "SYSTEM"] },
  { requirementId: "REQ-FIELD-ACTIVE", targetState: "FIELD_ACTIVE", requiredCloseTypes: ["FIELD_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["FIELD_OPERATOR", "TERALINX_OPERATIONS", "SYSTEM"] },
  { requirementId: "REQ-COMPLETE", targetState: "COMPLETE", requiredCloseTypes: ["COMPLETION_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_OPERATIONS", "FIELD_OPERATOR", "SYSTEM"] },
  { requirementId: "REQ-OPERATIONS", targetState: "OPERATIONS", requiredCloseTypes: ["OPERATIONS_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_OPERATIONS", "SYSTEM"] },
  { requirementId: "REQ-SUPERSEDED", targetState: "SUPERSEDED", requiredCloseTypes: ["DESIGN_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_ENGINEERING"] },
  { requirementId: "REQ-CANCELLED", targetState: "CANCELLED", requiredCloseTypes: ["COMMERCIAL_CLOSE"], requiredEvidence: true, requiredAuthorityRoles: ["TERALINX_SALES", "CUSTOMER"] },
]);

