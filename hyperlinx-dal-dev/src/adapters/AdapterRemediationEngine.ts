import type { DalAdapterGap } from "./DalAdapter";
import type { AdapterGap, AdapterGapSeverity, AdapterGapType } from "./AdapterGap";
import { adapterGapRegistryFor } from "./AdapterGap";
import type {
  AdapterNormalizedValue,
  AdapterNormalizationRule,
  AdapterReconciliationResult,
  AdapterRemediation,
  AdapterRemediationDiagnostic,
  AdapterRemediationPlan,
  AdapterRemediationStatus,
} from "./AdapterRemediation";
import { createAdapterRemediationDiagnostic } from "./AdapterRemediation";
import type { ShadowRuntimeFinding } from "../shadow/ShadowRuntimeFinding";

export interface AdapterGapInput {
  adapterGaps?: readonly DalAdapterGap[];
  shadowFindings?: readonly ShadowRuntimeFinding[];
  records?: readonly unknown[];
}

export interface AdapterRemediationInput extends AdapterGapInput {
  planId: string;
}

export const DEFAULT_NORMALIZATION_RULES: readonly AdapterNormalizationRule[] = Object.freeze([
  {
    ruleId: "NORM-LIFECYCLE-RELEASED-TO-CONTROL",
    gapType: "LIFECYCLE_GAP",
    appliesTo: "lifecycleState",
    sourceValue: "RELEASED_TO_CONTROL",
    normalizedValue: "CONTROL",
    description: "Legacy released-to-control state maps to CONTROL.",
    readOnly: true,
  },
  {
    ruleId: "NORM-LIFECYCLE-ACTIVATED",
    gapType: "LIFECYCLE_GAP",
    appliesTo: "lifecycleState",
    sourceValue: "ACTIVATED",
    normalizedValue: "CONTROL_ACTIVE",
    description: "Legacy activated state maps to CONTROL_ACTIVE.",
    readOnly: true,
  },
  {
    ruleId: "NORM-LIFECYCLE-IN-FIELD",
    gapType: "LIFECYCLE_GAP",
    appliesTo: "lifecycleState",
    sourceValue: "IN_FIELD",
    normalizedValue: "FIELD",
    description: "Legacy in-field state maps to FIELD.",
    readOnly: true,
  },
  {
    ruleId: "NORM-LIFECYCLE-FIELD-ACTIVE",
    gapType: "LIFECYCLE_GAP",
    appliesTo: "lifecycleState",
    sourceValue: "FIELD_ACTIVE",
    normalizedValue: "FIELD",
    description: "Runtime FIELD_ACTIVE aliases to DAL monotonic FIELD.",
    readOnly: true,
  },
  {
    ruleId: "NORM-CLOSE-FIELD-CLOSURE",
    gapType: "CLOSE_GAP",
    appliesTo: "closeType",
    sourceValue: "FIELD_CLOSURE",
    normalizedValue: "FIELD_CLOSE",
    description: "Legacy field closure label maps to FIELD_CLOSE.",
    readOnly: true,
  },
  {
    ruleId: "NORM-CLOSE-CONTROL-ACTIVATED",
    gapType: "CLOSE_GAP",
    appliesTo: "closeType",
    sourceValue: "CONTROL_ACTIVATED",
    normalizedValue: "CONTROL_CLOSE",
    description: "Legacy control activation event maps to CONTROL_CLOSE evidence.",
    readOnly: true,
  },
  {
    ruleId: "NORM-MARKETPLACE-BUDGET-CANDIDATE",
    gapType: "MARKETPLACE_GAP",
    appliesTo: "marketplaceReference",
    sourceValue: "candidateId",
    normalizedValue: "budgetCandidateId",
    description: "Legacy candidateId may satisfy budget candidate linkage for adapter reads.",
    readOnly: true,
  },
]);

export function identifyGaps(input: AdapterGapInput): AdapterReconciliationResult {
  const adapterGaps = (input.adapterGaps ?? []).map(adapterGapFromDalGap);
  const shadowGaps = (input.shadowFindings ?? []).map(adapterGapFromShadowFinding);
  const recordGaps = (input.records ?? []).flatMap(gapsFromRecord);
  const gaps = dedupeGaps([...adapterGaps, ...shadowGaps, ...recordGaps]);
  const diagnostics = gaps.map((gap) =>
    createAdapterRemediationDiagnostic("ADAPTER_GAP_IDENTIFIED", severityToDiagnostic(gap.severity), gap.message, {
      gapId: gap.gapId,
      gapType: gap.gapType,
      sourceEntityId: gap.sourceEntityId,
    }),
  );

  return {
    resultId: "ADAPTER-GAP-IDENTIFICATION",
    status: statusFor(gaps),
    gaps,
    remediations: [],
    normalizedValues: [],
    diagnostics,
  };
}

export function normalizeMappings(
  gaps: readonly AdapterGap[],
  rules: readonly AdapterNormalizationRule[] = DEFAULT_NORMALIZATION_RULES,
): AdapterReconciliationResult {
  const normalizedValues = gaps.flatMap((gap) => {
    const actual = gap.actual ?? "";
    return rules
      .filter((rule) => rule.gapType === gap.gapType && actual.includes(rule.sourceValue))
      .map((rule): AdapterNormalizedValue => ({
        ruleId: rule.ruleId,
        gapType: gap.gapType,
        sourceField: rule.appliesTo,
        sourceValue: rule.sourceValue,
        normalizedValue: rule.normalizedValue,
        applied: true,
      }));
  });
  const remediations = gaps.map((gap) => remediationFor(gap, normalizedValues.some((value) => value.gapType === gap.gapType) ? "NORMALIZE" : "MAP"));
  const diagnostics = normalizedValues.map((value) =>
    createAdapterRemediationDiagnostic("ADAPTER_NORMALIZATION_APPLIED", "INFO", "Read-only adapter normalization identified.", {
      ruleId: value.ruleId,
      sourceValue: value.sourceValue,
      normalizedValue: value.normalizedValue,
    }),
  );

  return {
    resultId: "ADAPTER-NORMALIZATION",
    status: statusFor(gaps),
    gaps: [...gaps],
    remediations,
    normalizedValues,
    diagnostics,
  };
}

export function reconcileLifecycle(records: readonly unknown[]): AdapterReconciliationResult {
  const gaps = records.flatMap((record) => {
    const lifecycleState = lifecycleStateOf(record);
    if (!lifecycleState) return [gapFor("LIFECYCLE_GAP", "HIGH", "Lifecycle state is missing.", recordId(record), "lifecycleState", "canonicalTruth.lifecycleState", "missing")];
    const normalized = normalizedLifecycle(lifecycleState);
    if (normalized !== lifecycleState) {
      return [gapFor("LIFECYCLE_GAP", "MEDIUM", `Lifecycle state ${lifecycleState} requires adapter normalization.`, recordId(record), "lifecycleState", normalized, lifecycleState)];
    }
    if (!knownLifecycle(lifecycleState)) {
      return [gapFor("LIFECYCLE_GAP", "HIGH", `Lifecycle state ${lifecycleState} is unmapped.`, recordId(record), "lifecycleState", "known lifecycle state", lifecycleState)];
    }
    return [];
  });
  return reconciliation("LIFECYCLE-RECONCILIATION", gaps, normalizeMappings(gaps).normalizedValues);
}

export function reconcileClosures(records: readonly unknown[]): AdapterReconciliationResult {
  const gaps = records.flatMap((record) => {
    const closeType = closeTypeOf(record);
    if (!closeType) return [gapFor("CLOSE_GAP", "HIGH", "Close type is missing.", recordId(record), "closeType", "registered close type", "missing")];
    const normalized = normalizedClose(closeType);
    if (normalized !== closeType) {
      return [gapFor("CLOSE_GAP", "MEDIUM", `Close type ${closeType} requires adapter normalization.`, recordId(record), "closeType", normalized, closeType)];
    }
    if (!knownClose(closeType)) {
      return [gapFor("CLOSE_GAP", "HIGH", `Close type ${closeType} is unmapped.`, recordId(record), "closeType", "registered close type", closeType)];
    }
    return [];
  });
  return reconciliation("CLOSE-RECONCILIATION", gaps, normalizeMappings(gaps).normalizedValues);
}

export function reconcileTraceability(records: readonly unknown[]): AdapterReconciliationResult {
  const gaps = records.flatMap((record) => {
    const recordValue = asRecord(record);
    return [
      !firstString(recordValue.customerId, asRecord(recordValue.canonicalTruth).customerId) ? gapFor("TRACEABILITY_GAP", "HIGH", "customerId is missing.", recordId(record), "customerId", "customerId", "missing") : undefined,
      !firstString(recordValue.opportunityId, recordValue.sourceOpportunityId, asRecord(recordValue.canonicalTruth).opportunityId) ? gapFor("TRACEABILITY_GAP", "HIGH", "opportunityId is missing.", recordId(record), "opportunityId", "opportunityId", "missing") : undefined,
      !firstString(recordValue.corridorId, asRecord(recordValue.canonicalTruth).corridorId) ? gapFor("TRACEABILITY_GAP", "HIGH", "corridorId is missing.", recordId(record), "corridorId", "corridorId", "missing") : undefined,
      !firstString(recordValue.scopeVersionId) && (recordValue.canonicalTruth || recordValue.workItemId || recordValue.closureId) ? gapFor("REFERENCE_GAP", "CRITICAL", "scopeVersionId is missing.", recordId(record), "scopeVersionId", "scopeVersionId", "missing") : undefined,
    ].filter((gap): gap is AdapterGap => Boolean(gap));
  });
  return reconciliation("TRACEABILITY-RECONCILIATION", gaps, []);
}

export function generateRemediationPlan(input: AdapterRemediationInput): AdapterRemediationPlan {
  console.info("[ADAPTER_GAP_IDENTIFIED]", { planId: input.planId });
  const identified = identifyGaps(input);
  const lifecycle = reconcileLifecycle(input.records ?? []);
  const closures = reconcileClosures((input.records ?? []).filter((record) => closeTypeOf(record) || asRecord(record).closureId || asRecord(record).closeId));
  const traceability = reconcileTraceability(input.records ?? []);
  const allGaps = dedupeGaps([...identified.gaps, ...lifecycle.gaps, ...closures.gaps, ...traceability.gaps]);
  const normalizedValues = [...normalizeMappings(allGaps).normalizedValues, ...lifecycle.normalizedValues, ...closures.normalizedValues];
  const remediations = allGaps.map((gap) => remediationFor(gap, normalizedValues.some((value) => value.gapType === gap.gapType) ? "NORMALIZE" : "MAP"));
  const diagnostics: AdapterRemediationDiagnostic[] = [
    ...identified.diagnostics,
    ...lifecycle.diagnostics,
    ...closures.diagnostics,
    ...traceability.diagnostics,
    ...normalizedValues.map((value) =>
      createAdapterRemediationDiagnostic("ADAPTER_NORMALIZATION_APPLIED", "INFO", "Read-only normalization available.", {
        ruleId: value.ruleId,
        sourceValue: value.sourceValue,
        normalizedValue: value.normalizedValue,
      }),
    ),
    createAdapterRemediationDiagnostic("ADAPTER_REMEDIATION_READY", severityToDiagnostic(maxSeverity(allGaps)), "Adapter remediation plan generated.", {
      planId: input.planId,
      gapCount: allGaps.length,
      remediationCount: remediations.length,
    }),
  ];

  console.info("[ADAPTER_REMEDIATION_READY]", {
    planId: input.planId,
    gapCount: allGaps.length,
    remediationCount: remediations.length,
  });

  return {
    planId: input.planId,
    status: statusFor(allGaps),
    gaps: allGaps,
    remediations,
    normalizedValues,
    diagnostics,
    createdAt: new Date().toISOString(),
  };
}

function adapterGapFromDalGap(gap: DalAdapterGap): AdapterGap {
  const gapType = classify(`${gap.message} ${gap.requiredAdapter ?? ""}`);
  return gapFor(gapType, severityFromDal(gap.severity), gap.message, gap.sourceEntityId, undefined, undefined, undefined, gap.sourceEntityType, gap.requiredAdapter);
}

function adapterGapFromShadowFinding(finding: ShadowRuntimeFinding): AdapterGap {
  const gapType = classify(`${finding.component} ${finding.gap}`);
  return gapFor(gapType, finding.severity, finding.gap, undefined, undefined, finding.expected, finding.actual, finding.component, finding.recommendedAdapterAction);
}

function gapsFromRecord(record: unknown): AdapterGap[] {
  const value = asRecord(record);
  const gaps: AdapterGap[] = [];
  if (value.legacyObject === true || value.opportunitySeedId) {
    gaps.push(gapFor("REFERENCE_GAP", "MEDIUM", "Legacy object mapping requires adapter remediation.", recordId(record), "legacyObjectReference", "scopeVersionId", firstString(value.opportunitySeedId, value.id)));
  }
  if (value.unknownObject === true) {
    gaps.push(gapFor("REFERENCE_GAP", "MEDIUM", "Unknown object mapping requires adapter registry entry.", recordId(record), "entityType", "known entity type", "unknown"));
  }
  return gaps;
}

function reconciliation(resultId: string, gaps: readonly AdapterGap[], normalizedValues: readonly AdapterNormalizedValue[]): AdapterReconciliationResult {
  const diagnostics: AdapterRemediationDiagnostic[] = [
    ...gaps.map((gap) =>
      createAdapterRemediationDiagnostic("ADAPTER_GAP_IDENTIFIED", severityToDiagnostic(gap.severity), gap.message, {
        gapId: gap.gapId,
        gapType: gap.gapType,
      }),
    ),
    createAdapterRemediationDiagnostic("ADAPTER_RECONCILIATION_COMPLETE", severityToDiagnostic(maxSeverity(gaps)), `${resultId} complete.`, {
      gapCount: gaps.length,
    }),
  ];
  return {
    resultId,
    status: statusFor(gaps),
    gaps: [...gaps],
    remediations: gaps.map((gap) => remediationFor(gap, normalizedValues.some((value) => value.gapType === gap.gapType) ? "NORMALIZE" : "MAP")),
    normalizedValues: [...normalizedValues],
    diagnostics,
  };
}

function remediationFor(gap: AdapterGap, strategy: AdapterRemediation["strategy"]): AdapterRemediation {
  return {
    remediationId: `REMEDIATION-${gap.gapId}`,
    gapId: gap.gapId,
    gapType: gap.gapType,
    strategy,
    recommendedAdapter: gap.recommendedAdapter,
    requiredMapping: gap.requiredMapping,
    owner: gap.owner,
    risk: gap.risk,
    priority: gap.priority,
    automated: false,
    notes: "Recommendation only. No DAL mutation, lifecycle mutation, authority mutation, or persistence write is performed.",
  };
}

function gapFor(
  gapType: AdapterGapType,
  severity: AdapterGapSeverity,
  message: string,
  sourceEntityId?: string,
  sourceField?: string,
  expected?: string,
  actual?: string,
  sourceEntityType?: string,
  requiredAdapter?: string,
): AdapterGap {
  const registry = adapterGapRegistryFor(gapType);
  return {
    gapId: `ADAPTER-GAP-${gapType}-${sourceEntityId ?? sourceField ?? message}`.replace(/[^A-Z0-9-]+/gi, "-").slice(0, 100),
    gapType,
    severity,
    status: "OPEN",
    source: "AdapterRemediationEngine",
    sourceEntityId,
    sourceEntityType,
    sourceField,
    message,
    expected,
    actual,
    recommendedAdapter: requiredAdapter ?? registry?.recommendedAdapter ?? "DalAdapter",
    requiredMapping: sourceField ?? registry?.requiredMapping ?? "adapterMapping",
    owner: registry?.owner ?? "DAL Adapter Layer",
    risk: severity,
    priority: priorityFor(severity),
  };
}

function classify(text: string): AdapterGapType {
  const lower = text.toLowerCase();
  if (lower.includes("customer") || lower.includes("opportunity") || lower.includes("corridor") || lower.includes("traceability")) return "TRACEABILITY_GAP";
  if (lower.includes("lifecycle") || lower.includes("state")) return "LIFECYCLE_GAP";
  if (lower.includes("close") || lower.includes("closure")) return "CLOSE_GAP";
  if (lower.includes("marketplace") || lower.includes("vendor") || lower.includes("budget") || lower.includes("bid") || lower.includes("contract")) return "MARKETPLACE_GAP";
  if (lower.includes("authority")) return "AUTHORITY_GAP";
  return "REFERENCE_GAP";
}

function normalizedLifecycle(value: string) {
  const rule = DEFAULT_NORMALIZATION_RULES.find((candidate) => candidate.gapType === "LIFECYCLE_GAP" && candidate.sourceValue === value);
  return rule?.normalizedValue ?? value;
}

function normalizedClose(value: string) {
  const rule = DEFAULT_NORMALIZATION_RULES.find((candidate) => candidate.gapType === "CLOSE_GAP" && candidate.sourceValue === value);
  return rule?.normalizedValue ?? value;
}

function knownLifecycle(value: string) {
  return [
    "DRAFT",
    "ANALYZED",
    "CERTIFIED",
    "PROVISIONALLY_CERTIFIED",
    "QUOTED",
    "APPROVED",
    "CONTROL",
    "CONTROL_ACTIVE",
    "FIELD",
    "PARTIALLY_COMPLETE",
    "COMPLETE",
    "VERIFIED",
    "OPERATIONAL",
  ].includes(value);
}

function knownClose(value: string) {
  return [
    "INTENT_CLOSE",
    "DESIGN_CLOSE",
    "ENGINEERING_CLOSE",
    "COMMERCIAL_CLOSE",
    "BUDGET_CLOSE",
    "VENDOR_RESPONSE_CLOSE",
    "VENDOR_ACCEPTANCE_CLOSE",
    "CUSTOMER_ACCEPTANCE_CLOSE",
    "CONTRACT_CLOSE",
    "MARKETPLACE_CLOSE",
    "CONTROL_CLOSE",
    "FIELD_CLOSE",
    "COMPLETION_CLOSE",
    "OPERATIONS_CLOSE",
    "FINANCIAL_COMMITMENT_CLOSE",
    "PAYMENT_CLOSE",
  ].includes(value);
}

function lifecycleStateOf(record: unknown): string | undefined {
  const value = asRecord(record);
  const canonicalTruth = asRecord(value.canonicalTruth);
  return firstString(canonicalTruth.lifecycleState, value.lifecycleState, value.status);
}

function closeTypeOf(record: unknown): string | undefined {
  const value = asRecord(record);
  const authority = asRecord(value.authority);
  return firstString(value.closeType, value.closureType, value.eventType, authority.closeType, authority.authorityType);
}

function recordId(record: unknown): string | undefined {
  const value = asRecord(record);
  return firstString(value.scopeVersionId, value.customerId, value.opportunityId, value.corridorId, value.workItemId, value.workPackageId, value.closureId, value.closeId, value.id);
}

function dedupeGaps(gaps: readonly AdapterGap[]) {
  return Array.from(new Map(gaps.map((gap) => [gap.gapId, gap])).values());
}

function severityFromDal(severity: string): AdapterGapSeverity {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "ERROR") return "HIGH";
  if (severity === "WARNING") return "MEDIUM";
  return "LOW";
}

function severityToDiagnostic(severity: AdapterGapSeverity): AdapterRemediationDiagnostic["severity"] {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "HIGH") return "ERROR";
  if (severity === "MEDIUM") return "WARNING";
  return "INFO";
}

function maxSeverity(gaps: readonly AdapterGap[]): AdapterGapSeverity {
  if (gaps.some((gap) => gap.severity === "CRITICAL")) return "CRITICAL";
  if (gaps.some((gap) => gap.severity === "HIGH")) return "HIGH";
  if (gaps.some((gap) => gap.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function statusFor(gaps: readonly AdapterGap[]): AdapterRemediationStatus {
  if (!gaps.length) return "NO_ACTION_REQUIRED";
  if (gaps.some((gap) => gap.severity === "CRITICAL")) return "BLOCKED";
  if (gaps.some((gap) => gap.severity === "HIGH" || gap.severity === "MEDIUM")) return "PARTIAL";
  return "READY";
}

function priorityFor(severity: AdapterGapSeverity) {
  if (severity === "CRITICAL") return 1;
  if (severity === "HIGH") return 2;
  if (severity === "MEDIUM") return 3;
  return 4;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
