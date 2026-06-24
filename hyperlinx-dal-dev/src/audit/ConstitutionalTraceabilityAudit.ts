import type {
  AuditFinding,
  AuditDiagnostic,
  BaseAuditResult,
} from "./ConstitutionalAudit";

export interface TraceabilityAuditResult extends BaseAuditResult {
  customerCount: number;
  opportunityCount: number;
  corridorCount: number;
  scopeVersionCount: number;
  orphanReferenceCount: number;
  missingTraceabilityCount: number;
}

export interface TraceabilityAuditSummary {
  validCustomerIds: string[];
  validOpportunityIds: string[];
  validCorridorIds: string[];
  validScopeVersionIds: string[];
  findings: AuditFinding[];
  diagnostics: AuditDiagnostic[];
}
