import type { ScopeVersionCloseEvent, ScopeVersionCloseType } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";

export type ContractReadinessStatus = "NOT_READY" | "REVIEW_REQUIRED" | "READY";

export type SofReadinessStatus = "NOT_READY" | "REVIEW_REQUIRED" | "READY";

export type ContractSofReadinessStatus = "NOT_READY" | "REVIEW_REQUIRED" | "READY";

export type ContractSofGate = "SOF" | "CONTRACT" | "BOTH";

export type ContractSofBlockerSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ContractSofBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "LIFECYCLE_STATE_TOO_EARLY"
  | "MISSING_ENGINEERING_CLOSE"
  | "MISSING_BUDGET_CLOSE"
  | "MISSING_VENDOR_ACCEPTANCE_CLOSE"
  | "MISSING_CUSTOMER_ACCEPTANCE_CLOSE"
  | "MISSING_LOCKED_BUDGET"
  | "MISSING_CUSTOMER_LEGAL_PROFILE"
  | "MISSING_BILLING_PROFILE"
  | "MISSING_PRODUCT_PLAN"
  | "MISSING_SERVICE_DESCRIPTION"
  | "MISSING_SERVICE_LOCATIONS"
  | "MISSING_APPROVED_CAPACITY"
  | "MISSING_TERM_ASSUMPTIONS"
  | "MISSING_PRICING_REFERENCE"
  | "MISSING_APPROVED_SCOPE"
  | "MISSING_APPROVED_VENDOR_SELECTION"
  | "MISSING_APPROVED_COMMERCIAL_TERMS"
  | "MISSING_RISK_NOTES"
  | "MISSING_REQUIRED_EXHIBITS"
  | "MISSING_ENGINEERING_PACKAGE"
  | "MISSING_CONTRACT_REVIEWER_ROLE"
  | "MISSING_APPROVED_OBJECT_PACKAGE"
  | "UNRESOLVED_HIGH_SEVERITY_RISK"
  | "UNRESOLVED_DESIGN_STANDARD_EXCEPTION"
  | "REJECTED_LIFECYCLE_TRANSITION"
  | "AI_ADVISORY_ONLY_RECOMMENDATION";

export type ContractSofDiagnosticCode =
  | "CONTRACT_SOF_READINESS_STARTED"
  | "SOF_READINESS_EVALUATED"
  | "CONTRACT_READINESS_EVALUATED"
  | "CONTRACT_SOF_BLOCKER_IDENTIFIED"
  | "CONTRACT_SOF_READY"
  | "CONTRACT_SOF_REVIEW_REQUIRED"
  | "CONTRACT_SOF_NOT_READY"
  | "CONTRACT_SOF_AUDIT_CREATED";

export interface ContractSofRequirement {
  requirementId: string;
  gate: ContractSofGate;
  label: string;
  blockerCode: ContractSofBlockerCode;
  severity: ContractSofBlockerSeverity;
  requiredCloseType?: ScopeVersionCloseType;
  description: string;
}

export interface ContractSofBlocker {
  blockerId: string;
  code: ContractSofBlockerCode;
  gate: ContractSofGate;
  severity: ContractSofBlockerSeverity;
  message: string;
  requirementId?: string;
  resolved: boolean;
}

export interface ContractSofDiagnostic {
  code: ContractSofDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface ContractSofReadinessReferences {
  lockedBudgetReference?: string;
  approvedVendorScopeReference?: string;
  approvedProductPlan?: string;
  approvedObjectPackage?: string;
  serviceDescription?: string;
  serviceLocations?: string[];
  approvedCapacity?: string;
  termAssumptions?: string;
  pricingReference?: string;
  customerLegalProfile?: string;
  billingProfile?: string;
  approvedScope?: string;
  approvedVendorSelections?: string[];
  approvedCommercialTerms?: string;
  riskNotes?: string[];
  requiredExhibits?: string[];
  engineeringPackageReference?: string;
  contractReviewerRole?: string;
}

export interface ContractSofRiskContext {
  unresolvedHighSeverityBlockers?: string[];
  unresolvedDesignStandardExceptions?: string[];
  rejectedLifecycleTransitions?: string[];
  aiAdvisoryOnlyRecommendation?: boolean;
  vendorAcceptanceRequired?: boolean;
}

export interface ContractSofReadinessInput {
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  closes: readonly ScopeVersionCloseEvent[];
  references: ContractSofReadinessReferences;
  riskContext?: ContractSofRiskContext;
  evaluatedBy?: string;
}

export interface ContractSofGateEvaluation {
  gate: ContractSofGate;
  status: ContractReadinessStatus | SofReadinessStatus;
  blockers: ContractSofBlocker[];
  satisfiedRequirementIds: string[];
  missingRequirementIds: string[];
  diagnostics: ContractSofDiagnostic[];
}

export interface ContractSofReadinessAudit {
  auditId: string;
  scopeVersionId: string;
  lifecycleState: ScopeVersionState;
  sofStatus: SofReadinessStatus;
  contractStatus: ContractReadinessStatus;
  overallStatus: ContractSofReadinessStatus;
  blockerIds: string[];
  closeIds: string[];
  evaluatedBy?: string;
  evaluatedAt: string;
  diagnostics: ContractSofDiagnostic[];
}

export interface ContractSofReadinessResult {
  scopeVersionId: string;
  lifecycleState: ScopeVersionState;
  sofStatus: SofReadinessStatus;
  contractStatus: ContractReadinessStatus;
  overallStatus: ContractSofReadinessStatus;
  sof: ContractSofGateEvaluation;
  contract: ContractSofGateEvaluation;
  blockers: ContractSofBlocker[];
  audit: ContractSofReadinessAudit;
  diagnostics: ContractSofDiagnostic[];
}

export const CONTRACT_SOF_REQUIRED_CLOSES: readonly ScopeVersionCloseType[] = Object.freeze([
  "ENGINEERING_CLOSE",
  "BUDGET_CLOSE",
  "VENDOR_ACCEPTANCE_CLOSE",
  "CUSTOMER_ACCEPTANCE_CLOSE",
]);

export const CONTRACT_SOF_REQUIREMENTS: readonly ContractSofRequirement[] = Object.freeze([
  {
    requirementId: "REQ-TRACE-SCOPEVERSION",
    gate: "BOTH",
    label: "ScopeVersion ID",
    blockerCode: "MISSING_SCOPEVERSION_ID",
    severity: "HIGH",
    description: "Readiness must evaluate a valid ScopeVersion.",
  },
  {
    requirementId: "REQ-TRACE-CUSTOMER",
    gate: "BOTH",
    label: "Customer ID",
    blockerCode: "MISSING_CUSTOMER_ID",
    severity: "HIGH",
    description: "Readiness must trace to customer.",
  },
  {
    requirementId: "REQ-TRACE-OPPORTUNITY",
    gate: "BOTH",
    label: "Opportunity ID",
    blockerCode: "MISSING_OPPORTUNITY_ID",
    severity: "HIGH",
    description: "Readiness must trace to opportunity.",
  },
  {
    requirementId: "REQ-TRACE-CORRIDOR",
    gate: "BOTH",
    label: "Corridor ID",
    blockerCode: "MISSING_CORRIDOR_ID",
    severity: "HIGH",
    description: "Readiness must trace to corridor.",
  },
  {
    requirementId: "REQ-LIFECYCLE-CUSTOMER-ACCEPTED",
    gate: "BOTH",
    label: "Lifecycle Customer Accepted",
    blockerCode: "LIFECYCLE_STATE_TOO_EARLY",
    severity: "HIGH",
    description: "Lifecycle must be at or beyond CUSTOMER_ACCEPTED.",
  },
  {
    requirementId: "REQ-CLOSE-ENGINEERING",
    gate: "BOTH",
    label: "Engineering Close",
    blockerCode: "MISSING_ENGINEERING_CLOSE",
    severity: "HIGH",
    requiredCloseType: "ENGINEERING_CLOSE",
    description: "Engineering package use requires ENGINEERING_CLOSE.",
  },
  {
    requirementId: "REQ-CLOSE-BUDGET",
    gate: "BOTH",
    label: "Budget Close",
    blockerCode: "MISSING_BUDGET_CLOSE",
    severity: "HIGH",
    requiredCloseType: "BUDGET_CLOSE",
    description: "Budget use requires BUDGET_CLOSE.",
  },
  {
    requirementId: "REQ-CLOSE-VENDOR-ACCEPTANCE",
    gate: "BOTH",
    label: "Vendor Acceptance Close",
    blockerCode: "MISSING_VENDOR_ACCEPTANCE_CLOSE",
    severity: "MEDIUM",
    requiredCloseType: "VENDOR_ACCEPTANCE_CLOSE",
    description: "Vendor scope use requires vendor acceptance when vendor scope is applicable.",
  },
  {
    requirementId: "REQ-CLOSE-CUSTOMER-ACCEPTANCE",
    gate: "BOTH",
    label: "Customer Acceptance Close",
    blockerCode: "MISSING_CUSTOMER_ACCEPTANCE_CLOSE",
    severity: "HIGH",
    requiredCloseType: "CUSTOMER_ACCEPTANCE_CLOSE",
    description: "SOF and contract readiness require customer acceptance.",
  },
  {
    requirementId: "REQ-LOCKED-BUDGET",
    gate: "BOTH",
    label: "Locked Budget Reference",
    blockerCode: "MISSING_LOCKED_BUDGET",
    severity: "HIGH",
    description: "Readiness requires locked budget reference.",
  },
  {
    requirementId: "REQ-PRODUCT-PLAN",
    gate: "SOF",
    label: "Approved Product Plan",
    blockerCode: "MISSING_PRODUCT_PLAN",
    severity: "HIGH",
    description: "SOF readiness requires approved product plan.",
  },
  {
    requirementId: "REQ-SERVICE-DESCRIPTION",
    gate: "SOF",
    label: "Service Description",
    blockerCode: "MISSING_SERVICE_DESCRIPTION",
    severity: "HIGH",
    description: "SOF readiness requires service description.",
  },
  {
    requirementId: "REQ-SERVICE-LOCATIONS",
    gate: "SOF",
    label: "Service Locations",
    blockerCode: "MISSING_SERVICE_LOCATIONS",
    severity: "HIGH",
    description: "SOF readiness requires service locations.",
  },
  {
    requirementId: "REQ-APPROVED-CAPACITY",
    gate: "SOF",
    label: "Approved Capacity",
    blockerCode: "MISSING_APPROVED_CAPACITY",
    severity: "HIGH",
    description: "SOF readiness requires approved capacity.",
  },
  {
    requirementId: "REQ-TERM-ASSUMPTIONS",
    gate: "SOF",
    label: "Term Assumptions",
    blockerCode: "MISSING_TERM_ASSUMPTIONS",
    severity: "MEDIUM",
    description: "SOF readiness requires term assumptions.",
  },
  {
    requirementId: "REQ-PRICING-REFERENCE",
    gate: "SOF",
    label: "Pricing Reference",
    blockerCode: "MISSING_PRICING_REFERENCE",
    severity: "HIGH",
    description: "SOF readiness requires pricing or budget reference.",
  },
  {
    requirementId: "REQ-OBJECT-PACKAGE",
    gate: "BOTH",
    label: "Approved Object Package",
    blockerCode: "MISSING_APPROVED_OBJECT_PACKAGE",
    severity: "HIGH",
    description: "Readiness requires approved object package.",
  },
  {
    requirementId: "REQ-CUSTOMER-LEGAL-PROFILE",
    gate: "CONTRACT",
    label: "Customer Legal Profile",
    blockerCode: "MISSING_CUSTOMER_LEGAL_PROFILE",
    severity: "MEDIUM",
    description: "Contract readiness requires customer legal profile.",
  },
  {
    requirementId: "REQ-BILLING-PROFILE",
    gate: "CONTRACT",
    label: "Billing Profile",
    blockerCode: "MISSING_BILLING_PROFILE",
    severity: "MEDIUM",
    description: "Contract readiness requires billing profile.",
  },
  {
    requirementId: "REQ-APPROVED-SCOPE",
    gate: "CONTRACT",
    label: "Approved Scope",
    blockerCode: "MISSING_APPROVED_SCOPE",
    severity: "HIGH",
    description: "Contract readiness requires approved scope reference.",
  },
  {
    requirementId: "REQ-APPROVED-VENDOR-SELECTION",
    gate: "CONTRACT",
    label: "Approved Vendor Selections",
    blockerCode: "MISSING_APPROVED_VENDOR_SELECTION",
    severity: "MEDIUM",
    description: "Contract readiness requires approved vendor selections when applicable.",
  },
  {
    requirementId: "REQ-COMMERCIAL-TERMS",
    gate: "CONTRACT",
    label: "Approved Commercial Terms",
    blockerCode: "MISSING_APPROVED_COMMERCIAL_TERMS",
    severity: "HIGH",
    description: "Contract readiness requires approved commercial terms.",
  },
  {
    requirementId: "REQ-RISK-NOTES",
    gate: "CONTRACT",
    label: "Risk Notes",
    blockerCode: "MISSING_RISK_NOTES",
    severity: "LOW",
    description: "Contract readiness should preserve risk notes.",
  },
  {
    requirementId: "REQ-REQUIRED-EXHIBITS",
    gate: "CONTRACT",
    label: "Required Exhibits",
    blockerCode: "MISSING_REQUIRED_EXHIBITS",
    severity: "MEDIUM",
    description: "Contract readiness requires exhibit references.",
  },
  {
    requirementId: "REQ-ENGINEERING-PACKAGE",
    gate: "CONTRACT",
    label: "Engineering Package Reference",
    blockerCode: "MISSING_ENGINEERING_PACKAGE",
    severity: "HIGH",
    description: "Contract readiness requires engineering package reference.",
  },
  {
    requirementId: "REQ-CONTRACT-REVIEWER",
    gate: "CONTRACT",
    label: "Contract Reviewer Role",
    blockerCode: "MISSING_CONTRACT_REVIEWER_ROLE",
    severity: "MEDIUM",
    description: "Contract readiness requires contract reviewer role.",
  },
]);
