export type RouteGenerationDiagnosticCode =
  | "ROUTE_CANDIDATE_CREATED"
  | "ROUTE_ENDPOINT_RESOLVED"
  | "ROUTE_SEGMENTS_GENERATED"
  | "ROUTE_CONSTRAINTS_ESTIMATED"
  | "ROUTE_STATISTICS_GENERATED"
  | "ROUTE_GENERATION_WARNING";

export interface RouteGenerationDiagnostic {
  diagnosticId: string;
  code: RouteGenerationDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export function routeGenerationDiagnostic(
  code: RouteGenerationDiagnosticCode,
  severity: RouteGenerationDiagnostic["severity"],
  message: string,
  routeCandidateId: string,
  details?: Record<string, unknown>,
): RouteGenerationDiagnostic {
  const entry: RouteGenerationDiagnostic = {
    diagnosticId: `${code}-${routeCandidateId}`,
    code,
    severity,
    message,
    timestamp: new Date().toISOString(),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}
