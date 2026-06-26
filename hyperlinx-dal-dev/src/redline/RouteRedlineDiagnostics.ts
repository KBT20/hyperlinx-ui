export type RouteRedlineDiagnosticCode =
  | "REDLINE_ACTION_CREATED"
  | "ROUTE_REVISION_CREATED"
  | "OSRM_RESNAP_REQUESTED"
  | "OSRM_RESNAP_SUCCEEDED"
  | "OSRM_RESNAP_FAILED"
  | "ROUTE_REVISION_DELTA_CALCULATED"
  | "SELECTED_ROUTE_CANDIDATE_UPDATED"
  | "SELECTED_PROPOSAL_SOURCE_UPDATED";

export interface RouteRedlineDiagnostic {
  diagnosticId: string;
  code: RouteRedlineDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
