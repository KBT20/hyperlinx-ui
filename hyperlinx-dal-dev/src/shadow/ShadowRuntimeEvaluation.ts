import type { ScopeVersionCloseType } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";
import type {
  ShadowRuntimeComparison,
  ShadowRuntimeComparisonStatus,
  ShadowRuntimeDiagnostic,
  ShadowRuntimeFinding,
} from "./ShadowRuntimeFinding";

export interface ShadowRuntimeScopeVersionInput {
  scopeVersion: unknown;
  closures?: readonly unknown[];
  marketplace?: readonly unknown[];
}

export interface ShadowRuntimeInput {
  runtimeId: string;
  scopeVersions: readonly unknown[];
  closures?: readonly unknown[];
  marketplace?: readonly unknown[];
  notes?: string;
}

export interface ShadowLifecycleEvaluation {
  scopeVersionId: string;
  dalLifecycleState?: string;
  constitutionalLifecycleState?: string;
  reachable: boolean;
  invalidState: boolean;
  missingState: boolean;
  unmappedState: boolean;
  status: ShadowRuntimeComparisonStatus;
  diagnostics: ShadowRuntimeDiagnostic[];
  findings: ShadowRuntimeFinding[];
}

export interface ShadowCloseEvaluation {
  scopeVersionId: string;
  closeTypesPresent: ScopeVersionCloseType[];
  requiredCloseTypes: ScopeVersionCloseType[];
  missingCloseTypes: ScopeVersionCloseType[];
  unmappedCloseTypes: string[];
  status: ShadowRuntimeComparisonStatus;
  diagnostics: ShadowRuntimeDiagnostic[];
  findings: ShadowRuntimeFinding[];
}

export interface ShadowTraceabilityEvaluation {
  scopeVersionId: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  scopeVersionResolved: boolean;
  complete: boolean;
  status: ShadowRuntimeComparisonStatus;
  diagnostics: ShadowRuntimeDiagnostic[];
  findings: ShadowRuntimeFinding[];
}

export interface ShadowMarketplaceEvaluation {
  scopeVersionId: string;
  opportunityLinked: boolean;
  budgetLinked: boolean;
  vendorLinked: boolean;
  bidPackageLinked: boolean;
  contractReadinessLinked: boolean;
  status: ShadowRuntimeComparisonStatus;
  diagnostics: ShadowRuntimeDiagnostic[];
  findings: ShadowRuntimeFinding[];
}

export interface ShadowRuntimeEvaluation {
  evaluationId: string;
  runtimeId: string;
  scopeVersionId?: string;
  lifecycle?: ShadowLifecycleEvaluation;
  closes?: ShadowCloseEvaluation;
  traceability?: ShadowTraceabilityEvaluation;
  marketplace?: ShadowMarketplaceEvaluation;
  comparisons: ShadowRuntimeComparison[];
  findings: ShadowRuntimeFinding[];
  diagnostics: ShadowRuntimeDiagnostic[];
  status: ShadowRuntimeComparisonStatus;
  evaluatedAt: string;
}

export interface ShadowRuntimeSummary {
  runtimeId: string;
  status: ShadowRuntimeComparisonStatus;
  scopeVersionCount: number;
  matchCount: number;
  partialMatchCount: number;
  mismatchCount: number;
  unmappedCount: number;
  unknownCount: number;
  findings: ShadowRuntimeFinding[];
  diagnostics: ShadowRuntimeDiagnostic[];
  evaluations: ShadowRuntimeEvaluation[];
  completedAt: string;
}

export type ShadowExpectedLifecycleState = ScopeVersionState | "ANALYZED" | "CERTIFIED" | "PROVISIONALLY_CERTIFIED" | "QUOTED" | "APPROVED" | "CONTROL" | "FIELD" | "OPERATIONAL";
