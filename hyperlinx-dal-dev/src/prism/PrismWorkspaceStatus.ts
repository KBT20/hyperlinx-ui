export type PrismWorkspaceStatus =
  | "DRAFT"
  | "READY_FOR_PRISM"
  | "ANALYZING"
  | "READY_FOR_QUOTE"
  | "BLOCKED";

export type PrismWorkspaceSection =
  | "OPPORTUNITY_SUMMARY"
  | "BASELINE_NETWORK_SUMMARY"
  | "MARKETPLACE_OPPORTUNITIES"
  | "CANDIDATE_FACILITIES"
  | "CANDIDATE_SITES"
  | "NETWORK_AFFINITY"
  | "ROUTE_ALTERNATIVES"
  | "COST_DRIVERS"
  | "DIVERSITY_GAPS"
  | "RISKS"
  | "RECOMMENDATIONS"
  | "DIAGNOSTICS";

export interface PrismWorkspaceBlocker {
  blockerId: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  requiredAction: string;
}

export interface PrismWorkspaceDiagnostic {
  diagnosticId: string;
  code:
    | "PRISM_WORKSPACE_CREATED"
    | "BASELINE_ANALYZED"
    | "MARKETPLACE_ANALYZED"
    | "RISK_IDENTIFIED"
    | "OPPORTUNITY_IDENTIFIED"
    | "RECOMMENDATION_GENERATED"
    | "READY_FOR_QUOTE"
    | "PRISM_BLOCKED";
  severity: "INFO" | "WARNING" | "ERROR";
  opportunityId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
