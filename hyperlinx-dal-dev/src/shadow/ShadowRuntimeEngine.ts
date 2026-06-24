import { getAuthoritativeLifecycleState, lifecycleRank, normalizeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import { SCOPEVERSION_CLOSE_TYPE_REGISTRY, type ScopeVersionCloseType } from "../scopeversion/ScopeVersionCloseAuthority";
import { SCOPEVERSION_STATE_REGISTRY } from "../scopeversion/ScopeVersionLifecycle";
import type { ScopeVersion } from "../types/dal";
import { getScopeVersionClosures, getScopeVersionTraceability } from "../adapters/DalScopeVersionAdapter";
import type {
  ShadowCloseEvaluation,
  ShadowLifecycleEvaluation,
  ShadowMarketplaceEvaluation,
  ShadowRuntimeEvaluation,
  ShadowRuntimeInput,
  ShadowRuntimeScopeVersionInput,
  ShadowRuntimeSummary,
  ShadowTraceabilityEvaluation,
} from "./ShadowRuntimeEvaluation";
import type {
  ShadowRuntimeComparison,
  ShadowRuntimeComparisonStatus,
  ShadowRuntimeDiagnostic,
  ShadowRuntimeFinding,
  ShadowRuntimeSeverity,
} from "./ShadowRuntimeFinding";
import {
  createShadowDiagnostic,
  createShadowFinding,
  diagnosticSeverityForFinding,
  shadowStatusFromFindings,
} from "./ShadowRuntimeFinding";

const CLOSE_TYPE_SET = new Set<string>(SCOPEVERSION_CLOSE_TYPE_REGISTRY.map((authority) => authority.closeType));
const CONSTITUTIONAL_STATE_SET = new Set<string>(SCOPEVERSION_STATE_REGISTRY);
const LIFECYCLE_TO_CLOSE_REQUIREMENTS: Array<{ minState: string; closeType: ScopeVersionCloseType }> = [
  { minState: "APPROVED", closeType: "CONTRACT_CLOSE" },
  { minState: "CONTROL_ACTIVE", closeType: "CONTROL_CLOSE" },
  { minState: "FIELD", closeType: "FIELD_CLOSE" },
  { minState: "COMPLETE", closeType: "COMPLETION_CLOSE" },
  { minState: "OPERATIONAL", closeType: "OPERATIONS_CLOSE" },
];

export function evaluateScopeVersion(input: ShadowRuntimeScopeVersionInput): ShadowRuntimeEvaluation {
  const scopeVersion = input.scopeVersion as ScopeVersion;
  const scopeVersionId = scopeVersion?.scopeVersionId ?? "UNKNOWN_SCOPEVERSION";
  const lifecycle = evaluateLifecycle(scopeVersion);
  const closes = evaluateClosures(scopeVersion, input.closures);
  const traceability = evaluateTraceability(scopeVersion);
  const marketplace = evaluateMarketplace(scopeVersion, input.marketplace);
  const comparisons = [
    comparison("Lifecycle", scopeVersionId, lifecycle.status, lifecycle.dalLifecycleState, lifecycle.constitutionalLifecycleState, lifecycle.findings, lifecycle.diagnostics),
    comparison("Close Authority", scopeVersionId, closes.status, closes.requiredCloseTypes, closes.closeTypesPresent, closes.findings, closes.diagnostics),
    comparison("Traceability", scopeVersionId, traceability.status, ["customerId", "opportunityId", "corridorId"], {
      customerId: traceability.customerId,
      opportunityId: traceability.opportunityId,
      corridorId: traceability.corridorId,
    }, traceability.findings, traceability.diagnostics),
    comparison("Marketplace", scopeVersionId, marketplace.status, {
      opportunityLinked: true,
      budgetLinked: true,
      vendorLinked: true,
      bidPackageLinked: true,
      contractReadinessLinked: true,
    }, {
      opportunityLinked: marketplace.opportunityLinked,
      budgetLinked: marketplace.budgetLinked,
      vendorLinked: marketplace.vendorLinked,
      bidPackageLinked: marketplace.bidPackageLinked,
      contractReadinessLinked: marketplace.contractReadinessLinked,
    }, marketplace.findings, marketplace.diagnostics),
  ];
  const findings = [
    ...lifecycle.findings,
    ...closes.findings,
    ...traceability.findings,
    ...marketplace.findings,
  ];
  const diagnostics = [
    ...lifecycle.diagnostics,
    ...closes.diagnostics,
    ...traceability.diagnostics,
    ...marketplace.diagnostics,
  ];

  return {
    evaluationId: `SHADOW-EVALUATION-${scopeVersionId}`,
    runtimeId: "SCOPEVERSION",
    scopeVersionId,
    lifecycle,
    closes,
    traceability,
    marketplace,
    comparisons,
    findings,
    diagnostics,
    status: aggregateStatus(comparisons.map((item) => item.status)),
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluateLifecycle(scopeVersion: ScopeVersion): ShadowLifecycleEvaluation {
  const scopeVersionId = scopeVersion?.scopeVersionId ?? "UNKNOWN_SCOPEVERSION";
  const dalLifecycleState = normalizeLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState ?? scopeVersion?.status);
  const constitutionalLifecycleState = getAuthoritativeLifecycleState(scopeVersion);
  const constitutionalMappedState = mapToConstitutionalState(constitutionalLifecycleState);
  const missingState = !dalLifecycleState && !constitutionalLifecycleState;
  const invalidState = Boolean(dalLifecycleState && !CONSTITUTIONAL_STATE_SET.has(dalLifecycleState) && lifecycleRank(dalLifecycleState) < 0);
  const unmappedState = Boolean(constitutionalLifecycleState && !constitutionalMappedState);
  const reachable = Boolean(constitutionalMappedState || lifecycleRank(constitutionalLifecycleState) >= 0);
  const findings: ShadowRuntimeFinding[] = [];

  if (missingState) {
    findings.push(finding("Lifecycle", "CRITICAL", "Lifecycle state required.", "No DAL or constitutional lifecycle state.", "Use ScopeVersion adapter to expose lifecycle fields."));
  }
  if (invalidState) {
    findings.push(finding("Lifecycle", "HIGH", "Reachable lifecycle state.", String(dalLifecycleState), "Normalize DAL lifecycle before constitutional evaluation."));
  }
  if (unmappedState) {
    findings.push(finding("Lifecycle", "MEDIUM", "Mapped constitutional lifecycle state.", String(constitutionalLifecycleState), "Add adapter mapping for legacy DAL lifecycle value."));
  }
  if (dalLifecycleState && constitutionalLifecycleState && dalLifecycleState !== constitutionalLifecycleState) {
    findings.push(finding("Lifecycle", "MEDIUM", String(dalLifecycleState), String(constitutionalLifecycleState), "Review lifecycle guard output versus persisted DAL state."));
  }

  const diagnostics = [
    createShadowDiagnostic(
      findings.length ? "SHADOW_LIFECYCLE_MISMATCH" : "SHADOW_LIFECYCLE_VALIDATED",
      findings.length ? diagnosticSeverityForFinding(maxSeverity(findings)) : "INFO",
      findings.length ? "Lifecycle shadow evaluation found gaps." : "Lifecycle shadow evaluation matched.",
      {
        scopeVersionId,
        dalLifecycleState,
        constitutionalLifecycleState,
        constitutionalMappedState,
        reachable,
        invalidState,
        missingState,
        unmappedState,
      },
    ),
  ];

  return {
    scopeVersionId,
    dalLifecycleState,
    constitutionalLifecycleState,
    reachable,
    invalidState,
    missingState,
    unmappedState,
    status: shadowStatusFromFindings(findings),
    diagnostics,
    findings,
  };
}

export function evaluateClosures(scopeVersion: ScopeVersion, externalClosures: readonly unknown[] = []): ShadowCloseEvaluation {
  const scopeVersionId = scopeVersion?.scopeVersionId ?? "UNKNOWN_SCOPEVERSION";
  const allClosures = [...getScopeVersionClosures(scopeVersion), ...externalClosures.filter((closure) => closureScopeVersionId(closure) === scopeVersionId)];
  const closeTypes = allClosures.map(closeTypeOf).filter((type): type is string => Boolean(type));
  const registeredCloseTypes = closeTypes.filter((type): type is ScopeVersionCloseType => CLOSE_TYPE_SET.has(type));
  const unmappedCloseTypes = Array.from(new Set(closeTypes.filter((type) => !CLOSE_TYPE_SET.has(type))));
  const requiredCloseTypes = requiredCloseTypesFor(scopeVersion);
  const missingCloseTypes = requiredCloseTypes.filter((type) => !registeredCloseTypes.includes(type));
  const findings: ShadowRuntimeFinding[] = [];

  if (unmappedCloseTypes.length) {
    findings.push(finding("Close Authority", "MEDIUM", "Registered close type.", unmappedCloseTypes.join(", "), "Add close adapter mapping or close authority registry entry."));
  }
  if (missingCloseTypes.length) {
    findings.push(finding("Close Authority", "HIGH", requiredCloseTypes.join(", "), `Missing ${missingCloseTypes.join(", ")}`, "Expose authoritative close records for this ScopeVersion."));
  }

  const diagnostics = [
    createShadowDiagnostic(
      findings.length ? "SHADOW_CLOSE_MISMATCH" : "SHADOW_CLOSE_VALIDATED",
      findings.length ? diagnosticSeverityForFinding(maxSeverity(findings)) : "INFO",
      findings.length ? "Close authority shadow evaluation found gaps." : "Close authority shadow evaluation matched.",
      {
        scopeVersionId,
        closeTypesPresent: registeredCloseTypes,
        requiredCloseTypes,
        missingCloseTypes,
        unmappedCloseTypes,
      },
    ),
  ];

  return {
    scopeVersionId,
    closeTypesPresent: Array.from(new Set(registeredCloseTypes)),
    requiredCloseTypes,
    missingCloseTypes,
    unmappedCloseTypes,
    status: shadowStatusFromFindings(findings),
    diagnostics,
    findings,
  };
}

export function evaluateTraceability(scopeVersion: ScopeVersion): ShadowTraceabilityEvaluation {
  const traceability = getScopeVersionTraceability(scopeVersion);
  const missing = [
    !traceability.customerId ? "customerId" : undefined,
    !traceability.opportunityId ? "opportunityId" : undefined,
    !traceability.corridorId ? "corridorId" : undefined,
    !traceability.scopeVersionId ? "scopeVersionId" : undefined,
  ].filter((field): field is string => Boolean(field));
  const findings = missing.map((field) =>
    finding("Traceability", field === "scopeVersionId" ? "CRITICAL" : "HIGH", `${field} present`, "missing", `Map ${field} from DAL runtime or mark explicitly unavailable.`),
  );
  const diagnostics = [
    createShadowDiagnostic(
      findings.length ? "SHADOW_TRACEABILITY_GAP" : "SHADOW_TRACEABILITY_VALIDATED",
      findings.length ? diagnosticSeverityForFinding(maxSeverity(findings)) : "INFO",
      findings.length ? "Traceability shadow evaluation found gaps." : "Traceability shadow evaluation matched.",
      {
        scopeVersionId: traceability.scopeVersionId,
        missing,
      },
    ),
  ];

  return {
    scopeVersionId: traceability.scopeVersionId,
    customerId: traceability.customerId,
    opportunityId: traceability.opportunityId,
    corridorId: traceability.corridorId,
    scopeVersionResolved: Boolean(traceability.scopeVersionId),
    complete: missing.length === 0,
    status: shadowStatusFromFindings(findings),
    diagnostics,
    findings,
  };
}

export function evaluateMarketplace(scopeVersion: ScopeVersion, marketplaceRecords: readonly unknown[] = []): ShadowMarketplaceEvaluation {
  const scopeVersionId = scopeVersion?.scopeVersionId ?? "UNKNOWN_SCOPEVERSION";
  const relevant = marketplaceRecords.filter((record) => {
    const candidate = asRecord(record);
    return candidate.scopeVersionId === scopeVersionId || candidate.opportunityId === scopeVersion.sourceOpportunityId;
  });
  const opportunityLinked = Boolean(scopeVersion.sourceOpportunityId || relevant.some((record) => Boolean(asRecord(record).opportunityId)));
  const budgetLinked = relevant.some((record) => Boolean(asRecord(record).budgetLockId || asRecord(record).budgetCandidateId || asRecord(record).candidateId));
  const vendorLinked = relevant.some((record) => Boolean(asRecord(record).vendorId || asRecord(record).vendorResponseId));
  const bidPackageLinked = relevant.some((record) => Boolean(asRecord(record).bidPackageId));
  const contractReadinessLinked = relevant.some((record) => Boolean(asRecord(record).contractReadinessId || asRecord(record).contractReady));
  const checks = { opportunityLinked, budgetLinked, vendorLinked, bidPackageLinked, contractReadinessLinked };
  const findings = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) =>
      finding("Marketplace", key === "opportunityLinked" ? "HIGH" : "MEDIUM", `${key}=true`, `${key}=false`, `Expose ${key} through DAL marketplace adapter.`),
    );
  const diagnostics = [
    createShadowDiagnostic(
      findings.length ? "SHADOW_RUNTIME_GAP" : "SHADOW_RUNTIME_MATCH",
      findings.length ? diagnosticSeverityForFinding(maxSeverity(findings)) : "INFO",
      findings.length ? "Marketplace shadow evaluation found gaps." : "Marketplace shadow evaluation matched.",
      {
        scopeVersionId,
        ...checks,
      },
    ),
  ];

  return {
    scopeVersionId,
    ...checks,
    status: shadowStatusFromFindings(findings),
    diagnostics,
    findings,
  };
}

export function runShadowRuntime(input: ShadowRuntimeInput): ShadowRuntimeSummary {
  console.info("[SHADOW_RUNTIME_STARTED]", { runtimeId: input.runtimeId });
  const started = createShadowDiagnostic("SHADOW_RUNTIME_STARTED", "INFO", "Shadow runtime evaluation started.", {
    runtimeId: input.runtimeId,
  });
  const evaluations = input.scopeVersions.map((scopeVersion) =>
    evaluateScopeVersion({
      scopeVersion,
      closures: input.closures,
      marketplace: input.marketplace,
    }),
  );
  const findings = evaluations.flatMap((evaluation) => evaluation.findings);
  const diagnostics = [
    started,
    ...evaluations.flatMap((evaluation) => evaluation.diagnostics),
    createShadowDiagnostic("SHADOW_RUNTIME_COMPLETE", findings.length ? diagnosticSeverityForFinding(maxSeverity(findings)) : "INFO", "Shadow runtime evaluation complete.", {
      runtimeId: input.runtimeId,
      findingCount: findings.length,
    }),
  ];
  const status = aggregateStatus(evaluations.map((evaluation) => evaluation.status));

  console.info("[SHADOW_RUNTIME_COMPLETE]", {
    runtimeId: input.runtimeId,
    status,
    findingCount: findings.length,
  });

  return {
    runtimeId: input.runtimeId,
    status,
    scopeVersionCount: input.scopeVersions.length,
    matchCount: evaluations.filter((evaluation) => evaluation.status === "MATCH").length,
    partialMatchCount: evaluations.filter((evaluation) => evaluation.status === "PARTIAL_MATCH").length,
    mismatchCount: evaluations.filter((evaluation) => evaluation.status === "MISMATCH").length,
    unmappedCount: evaluations.filter((evaluation) => evaluation.status === "UNMAPPED").length,
    unknownCount: evaluations.filter((evaluation) => evaluation.status === "UNKNOWN").length,
    findings,
    diagnostics,
    evaluations,
    completedAt: new Date().toISOString(),
  };
}

function requiredCloseTypesFor(scopeVersion: ScopeVersion): ScopeVersionCloseType[] {
  const state = getAuthoritativeLifecycleState(scopeVersion);
  return LIFECYCLE_TO_CLOSE_REQUIREMENTS.filter((requirement) => lifecycleRank(state) >= lifecycleRank(requirement.minState)).map((requirement) => requirement.closeType);
}

function closeTypeOf(value: unknown): string | undefined {
  const record = asRecord(value);
  const authority = asRecord(record.authority);
  return firstString(record.closeType, record.closureType, record.eventType, authority.closeType, authority.authorityType);
}

function closureScopeVersionId(value: unknown): string | undefined {
  const record = asRecord(value);
  return firstString(record.scopeVersionId);
}

function mapToConstitutionalState(state: unknown): string | undefined {
  const normalized = normalizeLifecycleState(state);
  if (!normalized) return undefined;
  if (CONSTITUTIONAL_STATE_SET.has(normalized)) return normalized;
  const mapping: Record<string, string> = {
    DRAFT: "INTENT",
    ANALYZED: "DESIGN",
    CERTIFIED: "ENGINEERING_REVIEW",
    PROVISIONALLY_CERTIFIED: "ENGINEERING_REVIEW",
    QUOTED: "COMMERCIAL_REVIEW",
    APPROVED: "ENGINEERING_APPROVED",
    CONTROL: "CONTROL_READY",
    CONTROL_ACTIVE: "CONTROL_ACTIVE",
    FIELD: "FIELD_ACTIVE",
    PARTIALLY_COMPLETE: "COMPLETION_REVIEW",
    COMPLETE: "COMPLETE",
    VERIFIED: "COMPLETE",
    OPERATIONAL: "OPERATIONS",
    OPERATIONS: "OPERATIONS",
  };
  return mapping[normalized];
}

function comparison(
  component: string,
  scopeVersionId: string,
  status: ShadowRuntimeComparisonStatus,
  expected: unknown,
  actual: unknown,
  findings: ShadowRuntimeFinding[],
  diagnostics: ShadowRuntimeDiagnostic[],
): ShadowRuntimeComparison {
  return {
    comparisonId: `SHADOW-COMPARISON-${component.replace(/[^A-Z0-9]+/gi, "-")}-${scopeVersionId}`,
    component,
    status,
    expected,
    actual,
    findings,
    diagnostics,
  };
}

function finding(component: string, severity: ShadowRuntimeSeverity, expected: string, actual: string, recommendedAdapterAction: string): ShadowRuntimeFinding {
  return createShadowFinding({
    component,
    severity,
    expected,
    actual,
    gap: `${component}: expected ${expected}, actual ${actual}`,
    recommendedAdapterAction,
  });
}

function aggregateStatus(statuses: readonly ShadowRuntimeComparisonStatus[]): ShadowRuntimeComparisonStatus {
  if (!statuses.length) return "UNKNOWN";
  if (statuses.includes("MISMATCH")) return "MISMATCH";
  if (statuses.includes("UNMAPPED")) return "UNMAPPED";
  if (statuses.includes("PARTIAL_MATCH")) return "PARTIAL_MATCH";
  if (statuses.includes("UNKNOWN")) return "UNKNOWN";
  return "MATCH";
}

function maxSeverity(findings: readonly ShadowRuntimeFinding[]): ShadowRuntimeSeverity {
  if (findings.some((findingItem) => findingItem.severity === "CRITICAL")) return "CRITICAL";
  if (findings.some((findingItem) => findingItem.severity === "HIGH")) return "HIGH";
  if (findings.some((findingItem) => findingItem.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
