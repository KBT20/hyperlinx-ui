import type { AdapterGap, AdapterGapSeverity, AdapterGapType } from "./AdapterGap";

export type AdapterRemediationStrategy =
  | "NORMALIZE"
  | "RECONCILE"
  | "MAP"
  | "DOCUMENT"
  | "ESCALATE";

export type AdapterRemediationStatus =
  | "READY"
  | "PARTIAL"
  | "BLOCKED"
  | "NO_ACTION_REQUIRED";

export type AdapterRemediationDiagnosticCode =
  | "ADAPTER_GAP_IDENTIFIED"
  | "ADAPTER_NORMALIZATION_APPLIED"
  | "ADAPTER_RECONCILIATION_COMPLETE"
  | "ADAPTER_REMEDIATION_READY";

export interface AdapterRemediationDiagnostic {
  code: AdapterRemediationDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  details?: Record<string, unknown>;
}

export interface AdapterNormalizationRule {
  ruleId: string;
  gapType: AdapterGapType;
  appliesTo: string;
  sourceValue: string;
  normalizedValue: string;
  description: string;
  readOnly: true;
}

export interface AdapterRemediation {
  remediationId: string;
  gapId: string;
  gapType: AdapterGapType;
  strategy: AdapterRemediationStrategy;
  recommendedAdapter: string;
  requiredMapping: string;
  owner: string;
  risk: AdapterGapSeverity;
  priority: number;
  automated: false;
  notes: string;
}

export interface AdapterNormalizedValue {
  ruleId: string;
  gapType: AdapterGapType;
  sourceField: string;
  sourceValue: string;
  normalizedValue: string;
  applied: boolean;
}

export interface AdapterReconciliationResult {
  resultId: string;
  status: AdapterRemediationStatus;
  gaps: AdapterGap[];
  remediations: AdapterRemediation[];
  normalizedValues: AdapterNormalizedValue[];
  diagnostics: AdapterRemediationDiagnostic[];
}

export interface AdapterRemediationPlan {
  planId: string;
  status: AdapterRemediationStatus;
  gaps: AdapterGap[];
  remediations: AdapterRemediation[];
  normalizedValues: AdapterNormalizedValue[];
  diagnostics: AdapterRemediationDiagnostic[];
  createdAt: string;
}

export function createAdapterRemediationDiagnostic(
  code: AdapterRemediationDiagnosticCode,
  severity: AdapterRemediationDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): AdapterRemediationDiagnostic {
  return { code, severity, message, details };
}
