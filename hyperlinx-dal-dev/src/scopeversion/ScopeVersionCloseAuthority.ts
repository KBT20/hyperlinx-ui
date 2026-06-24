export type ScopeVersionCloseType =
  | "INTENT_CLOSE"
  | "DESIGN_CLOSE"
  | "ENGINEERING_CLOSE"
  | "COMMERCIAL_CLOSE"
  | "BUDGET_CLOSE"
  | "VENDOR_RESPONSE_CLOSE"
  | "VENDOR_ACCEPTANCE_CLOSE"
  | "CUSTOMER_ACCEPTANCE_CLOSE"
  | "CONTRACT_CLOSE"
  | "MARKETPLACE_CLOSE"
  | "CONTROL_CLOSE"
  | "FIELD_CLOSE"
  | "COMPLETION_CLOSE"
  | "OPERATIONS_CLOSE"
  | "FINANCIAL_COMMITMENT_CLOSE"
  | "PAYMENT_CLOSE";

export type ScopeVersionCloseActorRole =
  | "CUSTOMER"
  | "TERALINX_SALES"
  | "TERALINX_ENGINEERING"
  | "TERALINX_MARKETPLACE"
  | "TERALINX_OPERATIONS"
  | "VENDOR"
  | "LEGAL"
  | "FINANCE"
  | "FIELD_OPERATOR"
  | "SYSTEM"
  | "AI_ASSISTANT_ADVISORY";

export type ScopeVersionCloseValidationStatus =
  | "DRAFT"
  | "VALIDATED"
  | "REJECTED"
  | "WARNING";

export type ScopeVersionCloseOutcomeStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "SUPERSEDED"
  | "NO_STATE_CHANGE";

export type ScopeVersionCloseDiagnosticCode =
  | "SCOPEVERSION_CLOSE_DRAFT_CREATED"
  | "SCOPEVERSION_CLOSE_VALIDATION_STARTED"
  | "SCOPEVERSION_CLOSE_AUTHORITY_CHECKED"
  | "SCOPEVERSION_CLOSE_VALIDATED"
  | "SCOPEVERSION_CLOSE_REJECTED"
  | "SCOPEVERSION_CLOSE_AUDIT_RECORD_CREATED"
  | "SCOPEVERSION_CLOSE_WARNING";

export interface ScopeVersionCloseReference {
  referenceId: string;
  referenceType: string;
  source: string;
  immutable?: boolean;
  notes?: string;
}

export interface ScopeVersionCloseAuthority {
  authorityId: string;
  closeType: ScopeVersionCloseType;
  authorizedRoles: ScopeVersionCloseActorRole[];
  requiredEvidence: boolean;
  requiredTraceability: Array<"scopeVersionId" | "customerId" | "opportunityId" | "corridorId">;
  allowedStateTransitions?: Array<{ from: string; to: string }>;
  notes?: string;
}

export interface ScopeVersionCloseOutcome {
  status: ScopeVersionCloseOutcomeStatus;
  previousState?: string;
  resultingState?: string;
  supersedesCloseId?: string;
  notes?: string;
}

export interface ScopeVersionCloseDiagnostic {
  code: ScopeVersionCloseDiagnosticCode;
  closeId: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface ScopeVersionCloseValidation {
  closeId: string;
  scopeVersionId?: string;
  status: ScopeVersionCloseValidationStatus;
  valid: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: ScopeVersionCloseDiagnostic[];
  validatedAt?: string;
}

export interface ScopeVersionCloseEvent {
  closeId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  closeType: ScopeVersionCloseType;
  authority: ScopeVersionCloseAuthority;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  evidenceIds: string[];
  inputReferences: ScopeVersionCloseReference[];
  constraintReferences: ScopeVersionCloseReference[];
  outcome: ScopeVersionCloseOutcome;
  createdAt: string;
  validatedAt: string | undefined;
  immutable: boolean;
}

export interface ScopeVersionCloseAuditRecord {
  auditId: string;
  closeId: string;
  scopeVersionId: string;
  inputs: ScopeVersionCloseReference[];
  evidence: string[];
  constraints: ScopeVersionCloseReference[];
  actor: {
    actorId: string;
    actorRole: ScopeVersionCloseActorRole;
  };
  authority: ScopeVersionCloseAuthority;
  timestamp: string;
  outcome: ScopeVersionCloseOutcome;
  previousState?: string;
  resultingState?: string;
  replayReferences: ScopeVersionCloseReference[];
  diagnostics: ScopeVersionCloseDiagnostic[];
}

export interface ScopeVersionCloseDraftInput {
  closeId: string;
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  closeType: ScopeVersionCloseType;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  evidenceIds?: string[];
  inputReferences?: ScopeVersionCloseReference[];
  constraintReferences?: ScopeVersionCloseReference[];
  outcome?: Partial<ScopeVersionCloseOutcome>;
  createdAt?: string;
  supersedesCloseId?: string;
}

export const SCOPEVERSION_CLOSE_TYPE_REGISTRY: readonly ScopeVersionCloseAuthority[] = Object.freeze([
  {
    authorityId: "AUTH-INTENT-CLOSE",
    closeType: "INTENT_CLOSE",
    authorizedRoles: ["CUSTOMER", "TERALINX_SALES"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-DESIGN-CLOSE",
    closeType: "DESIGN_CLOSE",
    authorizedRoles: ["TERALINX_ENGINEERING"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-ENGINEERING-CLOSE",
    closeType: "ENGINEERING_CLOSE",
    authorizedRoles: ["TERALINX_ENGINEERING"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-COMMERCIAL-CLOSE",
    closeType: "COMMERCIAL_CLOSE",
    authorizedRoles: ["TERALINX_SALES", "TERALINX_MARKETPLACE", "FINANCE"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-BUDGET-CLOSE",
    closeType: "BUDGET_CLOSE",
    authorizedRoles: ["TERALINX_MARKETPLACE", "FINANCE"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-VENDOR-RESPONSE-CLOSE",
    closeType: "VENDOR_RESPONSE_CLOSE",
    authorizedRoles: ["VENDOR", "TERALINX_MARKETPLACE"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-VENDOR-ACCEPTANCE-CLOSE",
    closeType: "VENDOR_ACCEPTANCE_CLOSE",
    authorizedRoles: ["VENDOR", "TERALINX_MARKETPLACE"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-CUSTOMER-ACCEPTANCE-CLOSE",
    closeType: "CUSTOMER_ACCEPTANCE_CLOSE",
    authorizedRoles: ["CUSTOMER", "TERALINX_SALES"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-CONTRACT-CLOSE",
    closeType: "CONTRACT_CLOSE",
    authorizedRoles: ["LEGAL", "CUSTOMER", "VENDOR"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-MARKETPLACE-CLOSE",
    closeType: "MARKETPLACE_CLOSE",
    authorizedRoles: ["TERALINX_MARKETPLACE"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-CONTROL-CLOSE",
    closeType: "CONTROL_CLOSE",
    authorizedRoles: ["TERALINX_OPERATIONS", "SYSTEM"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-FIELD-CLOSE",
    closeType: "FIELD_CLOSE",
    authorizedRoles: ["FIELD_OPERATOR", "TERALINX_OPERATIONS", "SYSTEM"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-COMPLETION-CLOSE",
    closeType: "COMPLETION_CLOSE",
    authorizedRoles: ["TERALINX_OPERATIONS", "FIELD_OPERATOR", "SYSTEM"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-OPERATIONS-CLOSE",
    closeType: "OPERATIONS_CLOSE",
    authorizedRoles: ["TERALINX_OPERATIONS", "SYSTEM"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-FINANCIAL-COMMITMENT-CLOSE",
    closeType: "FINANCIAL_COMMITMENT_CLOSE",
    authorizedRoles: ["FINANCE", "CUSTOMER"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
  {
    authorityId: "AUTH-PAYMENT-CLOSE",
    closeType: "PAYMENT_CLOSE",
    authorizedRoles: ["FINANCE", "CUSTOMER"],
    requiredEvidence: true,
    requiredTraceability: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
  },
]);
