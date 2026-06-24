export type ParallelRuntimeAlignment =
  | "ALIGNED"
  | "PARTIALLY_ALIGNED"
  | "MISALIGNED";

export type ParallelRuntimeAdoptionStatus =
  | "NOT_READY"
  | "READY_FOR_SHADOW_DEPLOYMENT"
  | "READY_FOR_PARALLEL_DEPLOYMENT"
  | "READY_FOR_CONTROLLED_ADOPTION";

export type ParallelRuntimeRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ParallelRuntimeRiskType =
  | "AUTHORITY_RISK"
  | "LIFECYCLE_RISK"
  | "TRACEABILITY_RISK"
  | "MARKETPLACE_RISK"
  | "CONTROL_RISK"
  | "FIELD_RISK"
  | "COMPLETION_RISK"
  | "OPERATIONS_RISK"
  | "PRODUCTION_CUTOVER_RISK"
  | "AUDIT_RISK";

export type ParallelRuntimeDiagnosticCode =
  | "PARALLEL_RUNTIME_STARTED"
  | "PARALLEL_COMPARISON_ALIGNED"
  | "PARALLEL_COMPARISON_MISMATCH"
  | "PARALLEL_RISK_IDENTIFIED"
  | "PARALLEL_ADOPTION_STATUS"
  | "PARALLEL_RUNTIME_COMPLETE";

export interface ParallelRuntimeDiagnostic {
  code: ParallelRuntimeDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  details?: Record<string, unknown>;
}

export interface ParallelRuntimeRisk {
  riskId: string;
  riskType: ParallelRuntimeRiskType;
  level: ParallelRuntimeRiskLevel;
  component: string;
  message: string;
  productionCutoverImpact: string;
}

export interface ParallelRuntimeFinding {
  findingId: string;
  component: string;
  riskType: ParallelRuntimeRiskType;
  severity: ParallelRuntimeRiskLevel;
  dalValue: unknown;
  constitutionalValue: unknown;
  gap: string;
  adoptionImpact: string;
}

export interface ParallelRuntimeComparison {
  comparisonId: string;
  area: ParallelComparisonArea;
  alignment: ParallelRuntimeAlignment;
  dalValue: unknown;
  constitutionalValue: unknown;
  findings: ParallelRuntimeFinding[];
  risks: ParallelRuntimeRisk[];
  diagnostics: ParallelRuntimeDiagnostic[];
}

export type ParallelComparisonArea =
  | "ScopeVersion state"
  | "Lifecycle state"
  | "Close authority"
  | "Traceability"
  | "Control readiness"
  | "Field readiness"
  | "Completion readiness"
  | "Operations readiness"
  | "Marketplace readiness"
  | "Audit readiness";

export function createParallelDiagnostic(
  code: ParallelRuntimeDiagnosticCode,
  severity: ParallelRuntimeDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): ParallelRuntimeDiagnostic {
  return { code, severity, message, details };
}

export function createParallelFinding(args: Omit<ParallelRuntimeFinding, "findingId">): ParallelRuntimeFinding {
  return {
    findingId: `PARALLEL-FINDING-${args.component}-${args.gap.replace(/[^A-Z0-9]+/gi, "-").slice(0, 64)}`,
    ...args,
  };
}

export function createParallelRisk(args: Omit<ParallelRuntimeRisk, "riskId">): ParallelRuntimeRisk {
  return {
    riskId: `PARALLEL-RISK-${args.component}-${args.riskType}`,
    ...args,
  };
}

export function alignmentFromFindings(findings: readonly ParallelRuntimeFinding[]): ParallelRuntimeAlignment {
  if (findings.some((finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH")) return "MISALIGNED";
  if (findings.length) return "PARTIALLY_ALIGNED";
  return "ALIGNED";
}

export function diagnosticSeverityForRisk(level: ParallelRuntimeRiskLevel): ParallelRuntimeDiagnostic["severity"] {
  if (level === "CRITICAL") return "CRITICAL";
  if (level === "HIGH") return "ERROR";
  if (level === "MEDIUM") return "WARNING";
  return "INFO";
}
