import type {
  ScopeVersionCloseActorRole,
  ScopeVersionCloseAuditRecord,
  ScopeVersionCloseEvent,
} from "../scopeversion/ScopeVersionCloseAuthority";
import type {
  ScopeVersionLifecycleAudit,
  ScopeVersionState,
  ScopeVersionTransitionResult,
} from "../scopeversion/ScopeVersionLifecycle";
import type { WorkPackage } from "../control/WorkPackage";

export type AuditSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type ConstitutionalAuditDiagnosticCode =
  | "CONSTITUTIONAL_AUDIT_STARTED"
  | "CONSTITUTIONAL_AUDIT_PASSED"
  | "CONSTITUTIONAL_AUDIT_WARNING"
  | "CONSTITUTIONAL_AUDIT_ERROR"
  | "CONSTITUTIONAL_AUDIT_COMPLETE"
  | "CUSTOMER_TRACEABILITY_VALIDATED"
  | "TRACEABILITY_ERROR"
  | "SCOPEVERSION_TRACEABILITY_VALIDATED"
  | "SCOPEVERSION_TRACEABILITY_ERROR"
  | "AUTHORITY_BOUNDARY_VALIDATED"
  | "AUTHORITY_VIOLATION"
  | "CLOSE_AUTHORITY_VALIDATED"
  | "CLOSE_AUTHORITY_ERROR"
  | "LIFECYCLE_VALIDATED"
  | "LIFECYCLE_ERROR"
  | "REPLAYABILITY_VALIDATED"
  | "REPLAYABILITY_ERROR";

export type AuditFindingType =
  | "TRACEABILITY"
  | "SCOPEVERSION_TRACEABILITY"
  | "AUTHORITY"
  | "CLOSE_AUTHORITY"
  | "LIFECYCLE"
  | "REPLAYABILITY"
  | "PATENT_ALIGNMENT";

export type AuthorityLayer =
  | "PRISM"
  | "MARKETPLACE"
  | "BUDGET"
  | "CONTROL"
  | "FIELD"
  | "COMPLETION"
  | "OPERATIONS"
  | "TWIN"
  | "OI"
  | "SYSTEM";

export type AuthorityActionType =
  | "ADVISORY"
  | "COMMERCIAL_TRUTH"
  | "EXECUTION_AUTHORITY"
  | "FIELD_EXECUTION"
  | "COMPLETION_AUTHORITY"
  | "OPERATIONS_AUTHORITY"
  | "PROJECTION"
  | "PORTFOLIO_OBSERVATION";

export interface AuditDiagnostic {
  code: ConstitutionalAuditDiagnosticCode;
  severity: AuditSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditFinding {
  findingId: string;
  findingType: AuditFindingType;
  severity: AuditSeverity;
  message: string;
  objectType?: string;
  objectId?: string;
  sourceLayer?: AuthorityLayer;
  remediation?: string;
}

export interface ConstitutionalCustomerRef {
  customerId: string;
  name?: string;
}

export interface ConstitutionalOpportunityRef {
  opportunityId: string;
  customerId?: string;
  corridorIds?: string[];
  scopeVersionIds?: string[];
}

export interface ConstitutionalCorridorRef {
  corridorId: string;
  customerId?: string;
  opportunityId?: string;
  scopeVersionIds?: string[];
}

export interface ConstitutionalScopeVersionRef {
  scopeVersionId: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  parentScopeVersionId?: string;
  lifecycleState?: ScopeVersionState | string;
  status?: string;
}

export interface ConstitutionalAuthorityEvent {
  eventId: string;
  authorityLayer: AuthorityLayer;
  actionType: AuthorityActionType;
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  closeId?: string;
  auditId?: string;
  actorId?: string;
  actorRole?: ScopeVersionCloseActorRole;
  notes?: string;
}

export interface ConstitutionalRuntimeSnapshot {
  snapshotId: string;
  customers: readonly ConstitutionalCustomerRef[];
  opportunities: readonly ConstitutionalOpportunityRef[];
  corridors: readonly ConstitutionalCorridorRef[];
  scopeVersions: readonly ConstitutionalScopeVersionRef[];
  authorityEvents?: readonly ConstitutionalAuthorityEvent[];
  closeEvents?: readonly ScopeVersionCloseEvent[];
  closeAudits?: readonly ScopeVersionCloseAuditRecord[];
  lifecycleTransitions?: readonly ScopeVersionTransitionResult[];
  lifecycleAudits?: readonly ScopeVersionLifecycleAudit[];
  workPackages?: readonly WorkPackage[];
}

export interface BaseAuditResult {
  auditId: string;
  snapshotId: string;
  passed: boolean;
  findings: AuditFinding[];
  diagnostics: AuditDiagnostic[];
}

export interface AuthorityAuditResult extends BaseAuditResult {
  advisoryEvents: number;
  authorityEvents: number;
  authorityViolations: number;
}

export interface LifecycleAuditResult extends BaseAuditResult {
  transitionCount: number;
  invalidTransitionCount: number;
  unreachableStateCount: number;
}

export interface CloseAuditResult extends BaseAuditResult {
  closeCount: number;
  invalidCloseCount: number;
  requiredCloseTypesPresent: string[];
  requiredCloseTypesMissing: string[];
}

export interface ReplayabilityAuditResult extends BaseAuditResult {
  replayableEvents: number;
  missingAuditChains: number;
}

export interface ConstitutionalAudit {
  auditId: string;
  snapshotId: string;
  passed: boolean;
  traceability: import("./ConstitutionalTraceabilityAudit").TraceabilityAuditResult;
  authority: AuthorityAuditResult;
  lifecycle: LifecycleAuditResult;
  closeAuthority: CloseAuditResult;
  replayability: ReplayabilityAuditResult;
  patentAlignmentFindings: AuditFinding[];
  findings: AuditFinding[];
  diagnostics: AuditDiagnostic[];
  completedAt: string;
}
