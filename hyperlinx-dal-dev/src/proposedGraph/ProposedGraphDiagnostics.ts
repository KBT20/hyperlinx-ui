export type ProposedGraphDiagnosticCode =
  | "PROPOSED_GRAPH_CREATED"
  | "DESIGN_DOCTRINE_ATTACHED"
  | "ROUTE_CANDIDATE_ATTACHED"
  | "CENTERLINE_ROUTE_ATTACHED"
  | "PROPOSED_GRAPH_BLOCKED"
  | "PROPOSED_GRAPH_READY_FOR_PROPOSAL"
  | "PROPOSED_GRAPH_READY_FOR_ENGINEERING";

export interface ProposedGraphDiagnostic {
  diagnosticId: string;
  code: ProposedGraphDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export function createProposedGraphDiagnostic(
  code: ProposedGraphDiagnosticCode,
  severity: ProposedGraphDiagnostic["severity"],
  message: string,
  proposedGraphId: string,
  details?: Record<string, unknown>,
): ProposedGraphDiagnostic {
  const entry: ProposedGraphDiagnostic = {
    diagnosticId: `${code}-${proposedGraphId}`,
    code,
    severity,
    message,
    timestamp: new Date().toISOString(),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}
