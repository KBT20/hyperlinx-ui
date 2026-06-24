export type ShadowRuntimeSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ShadowRuntimeComparisonStatus =
  | "MATCH"
  | "PARTIAL_MATCH"
  | "MISMATCH"
  | "UNMAPPED"
  | "UNKNOWN";

export type ShadowRuntimeDiagnosticCode =
  | "SHADOW_RUNTIME_STARTED"
  | "SHADOW_RUNTIME_MATCH"
  | "SHADOW_RUNTIME_MISMATCH"
  | "SHADOW_RUNTIME_GAP"
  | "SHADOW_RUNTIME_COMPLETE"
  | "SHADOW_LIFECYCLE_VALIDATED"
  | "SHADOW_LIFECYCLE_MISMATCH"
  | "SHADOW_CLOSE_VALIDATED"
  | "SHADOW_CLOSE_MISMATCH"
  | "SHADOW_TRACEABILITY_VALIDATED"
  | "SHADOW_TRACEABILITY_GAP";

export interface ShadowRuntimeDiagnostic {
  code: ShadowRuntimeDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  details?: Record<string, unknown>;
}

export interface ShadowRuntimeFinding {
  findingId: string;
  component: string;
  severity: ShadowRuntimeSeverity;
  expected: string;
  actual: string;
  gap: string;
  recommendedAdapterAction: string;
}

export interface ShadowRuntimeComparison {
  comparisonId: string;
  component: string;
  status: ShadowRuntimeComparisonStatus;
  expected: unknown;
  actual: unknown;
  findings: ShadowRuntimeFinding[];
  diagnostics: ShadowRuntimeDiagnostic[];
}

export function createShadowDiagnostic(
  code: ShadowRuntimeDiagnosticCode,
  severity: ShadowRuntimeDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): ShadowRuntimeDiagnostic {
  return { code, severity, message, details };
}

export function createShadowFinding(args: Omit<ShadowRuntimeFinding, "findingId">): ShadowRuntimeFinding {
  return {
    findingId: `SHADOW-FINDING-${args.component}-${args.gap.replace(/[^A-Z0-9]+/gi, "-").slice(0, 64)}`,
    ...args,
  };
}

export function shadowStatusFromFindings(findings: readonly ShadowRuntimeFinding[]): ShadowRuntimeComparisonStatus {
  if (findings.some((finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH")) return "MISMATCH";
  if (findings.length) return "PARTIAL_MATCH";
  return "MATCH";
}

export function diagnosticSeverityForFinding(severity: ShadowRuntimeSeverity): ShadowRuntimeDiagnostic["severity"] {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "HIGH") return "ERROR";
  if (severity === "MEDIUM") return "WARNING";
  return "INFO";
}
