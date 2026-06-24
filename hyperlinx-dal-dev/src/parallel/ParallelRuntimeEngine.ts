import type { ParallelRuntimeInput, ParallelRuntimeObservation, ParallelRuntimeResult } from "./ParallelRuntime";
import type {
  ParallelComparisonArea,
  ParallelRuntimeAdoptionStatus,
  ParallelRuntimeAlignment,
  ParallelRuntimeComparison,
  ParallelRuntimeDiagnostic,
  ParallelRuntimeFinding,
  ParallelRuntimeRisk,
  ParallelRuntimeRiskLevel,
  ParallelRuntimeRiskType,
} from "./ParallelRuntimeComparison";
import {
  alignmentFromFindings,
  createParallelDiagnostic,
  createParallelFinding,
  createParallelRisk,
  diagnosticSeverityForRisk,
} from "./ParallelRuntimeComparison";

export function runParallelValidation(input: ParallelRuntimeInput): ParallelRuntimeResult {
  console.info("[PARALLEL_RUNTIME_STARTED]", { validationId: input.validationId });
  const started = createParallelDiagnostic("PARALLEL_RUNTIME_STARTED", "INFO", "Parallel runtime validation started.", {
    validationId: input.validationId,
  });
  const comparisons = [
    compareScopeVersionState(input.dalRuntime, input.constitutionalRuntime),
    compareLifecycleState(input.dalRuntime, input.constitutionalRuntime),
    compareCloseAuthority(input.dalRuntime, input.constitutionalRuntime),
    compareTraceability(input.dalRuntime, input.constitutionalRuntime),
    compareExecutionReadiness("Control readiness", "CONTROL_RISK", input.dalRuntime.controlReady, input.constitutionalRuntime.controlReady),
    compareExecutionReadiness("Field readiness", "FIELD_RISK", input.dalRuntime.fieldReady, input.constitutionalRuntime.fieldReady),
    compareExecutionReadiness("Completion readiness", "COMPLETION_RISK", input.dalRuntime.completionReady, input.constitutionalRuntime.completionReady),
    compareExecutionReadiness("Operations readiness", "OPERATIONS_RISK", input.dalRuntime.operationsReady, input.constitutionalRuntime.operationsReady),
    compareMarketplaceReadiness(input.dalRuntime, input.constitutionalRuntime),
    compareAuditReadiness(input.dalRuntime, input.constitutionalRuntime),
  ];
  const findings = comparisons.flatMap((comparison) => comparison.findings);
  const risks = comparisons.flatMap((comparison) => comparison.risks);
  const adoptionStatus = calculateAdoptionReadiness(comparisons, risks);
  const diagnostics = [
    started,
    ...comparisons.flatMap((comparison) => comparison.diagnostics),
    createParallelDiagnostic("PARALLEL_ADOPTION_STATUS", diagnosticSeverityForRisk(maxRisk(risks)), "Parallel adoption status calculated.", {
      adoptionStatus,
      riskCount: risks.length,
    }),
    createParallelDiagnostic("PARALLEL_RUNTIME_COMPLETE", diagnosticSeverityForRisk(maxRisk(risks)), "Parallel runtime validation complete.", {
      validationId: input.validationId,
      adoptionStatus,
      findingCount: findings.length,
      riskCount: risks.length,
    }),
  ];
  const alignment = aggregateAlignment(comparisons.map((comparison) => comparison.alignment));

  console.info("[PARALLEL_RUNTIME_COMPLETE]", {
    validationId: input.validationId,
    alignment,
    adoptionStatus,
    findingCount: findings.length,
    riskCount: risks.length,
  });

  return {
    resultId: `PARALLEL-RUNTIME-${input.validationId}`,
    validationId: input.validationId,
    alignment,
    adoptionStatus,
    comparisons,
    risks,
    findings,
    diagnostics,
    completedAt: new Date().toISOString(),
  };
}

export function compareScopeVersionState(dal: ParallelRuntimeObservation, constitutional: ParallelRuntimeObservation): ParallelRuntimeComparison {
  return compareValue({
    area: "ScopeVersion state",
    riskType: "AUTHORITY_RISK",
    dalValue: dal.scopeVersionState,
    constitutionalValue: constitutional.scopeVersionState,
    missingSeverity: "CRITICAL",
    mismatchSeverity: "HIGH",
    adoptionImpact: "ScopeVersion state mismatch blocks controlled adoption.",
  });
}

export function compareLifecycleState(dal: ParallelRuntimeObservation, constitutional: ParallelRuntimeObservation): ParallelRuntimeComparison {
  return compareValue({
    area: "Lifecycle state",
    riskType: "LIFECYCLE_RISK",
    dalValue: dal.lifecycleState,
    constitutionalValue: constitutional.lifecycleState,
    missingSeverity: "CRITICAL",
    mismatchSeverity: "HIGH",
    adoptionImpact: "Lifecycle mismatch blocks controlled adoption.",
  });
}

export function compareCloseAuthority(dal: ParallelRuntimeObservation, constitutional: ParallelRuntimeObservation): ParallelRuntimeComparison {
  const dalSet = new Set(dal.closeAuthority ?? []);
  const constitutionalSet = new Set(constitutional.closeAuthority ?? []);
  const missingInDal = Array.from(constitutionalSet).filter((value) => !dalSet.has(value));
  const unexpectedInDal = Array.from(dalSet).filter((value) => !constitutionalSet.has(value));
  const findings: ParallelRuntimeFinding[] = [];
  if (missingInDal.length) {
    findings.push(finding("Close authority", "CLOSE_AUTHORITY", "AUTHORITY_RISK", "HIGH", Array.from(constitutionalSet), Array.from(dalSet), `DAL missing close authority: ${missingInDal.join(", ")}`, "Close authority mismatch blocks parallel deployment."));
  }
  if (unexpectedInDal.length) {
    findings.push(finding("Close authority", "CLOSE_AUTHORITY", "AUTHORITY_RISK", "MEDIUM", Array.from(constitutionalSet), Array.from(dalSet), `DAL has unmapped close authority: ${unexpectedInDal.join(", ")}`, "Unmapped closes require adapter review before adoption."));
  }
  return comparison("Close authority", "AUTHORITY_RISK", Array.from(dalSet), Array.from(constitutionalSet), findings);
}

export function compareTraceability(dal: ParallelRuntimeObservation, constitutional: ParallelRuntimeObservation): ParallelRuntimeComparison {
  const fields = ["customerId", "opportunityId", "corridorId", "scopeVersionId"] as const;
  const findings = fields.flatMap((field) => {
    const dalValue = dal.traceability?.[field];
    const constitutionalValue = constitutional.traceability?.[field];
    if (!dalValue || !constitutionalValue) {
      return [finding("Traceability", field, "TRACEABILITY_RISK", field === "scopeVersionId" ? "CRITICAL" : "HIGH", constitutionalValue, dalValue, `${field} missing from one runtime.`, "Traceability gaps block controlled adoption.")];
    }
    if (dalValue !== constitutionalValue) {
      return [finding("Traceability", field, "TRACEABILITY_RISK", "HIGH", constitutionalValue, dalValue, `${field} differs between runtimes.`, "Traceability mismatch blocks controlled adoption.")];
    }
    return [];
  });
  return comparison("Traceability", "TRACEABILITY_RISK", dal.traceability, constitutional.traceability, findings);
}

export function compareExecutionReadiness(
  area: Extract<ParallelComparisonArea, "Control readiness" | "Field readiness" | "Completion readiness" | "Operations readiness">,
  riskType: ParallelRuntimeRiskType,
  dalValue: unknown,
  constitutionalValue: unknown,
): ParallelRuntimeComparison {
  return compareValue({
    area,
    riskType,
    dalValue,
    constitutionalValue,
    missingSeverity: "HIGH",
    mismatchSeverity: "HIGH",
    adoptionImpact: `${area} mismatch requires parallel validation before adoption.`,
  });
}

export function compareMarketplaceReadiness(dal: ParallelRuntimeObservation, constitutional: ParallelRuntimeObservation): ParallelRuntimeComparison {
  return compareValue({
    area: "Marketplace readiness",
    riskType: "MARKETPLACE_RISK",
    dalValue: dal.marketplaceReady,
    constitutionalValue: constitutional.marketplaceReady,
    missingSeverity: "MEDIUM",
    mismatchSeverity: "MEDIUM",
    adoptionImpact: "Marketplace mismatch can remain in shadow deployment but blocks controlled adoption.",
  });
}

export function compareAuditReadiness(dal: ParallelRuntimeObservation, constitutional: ParallelRuntimeObservation): ParallelRuntimeComparison {
  return compareValue({
    area: "Audit readiness",
    riskType: "AUDIT_RISK",
    dalValue: dal.auditReady,
    constitutionalValue: constitutional.auditReady,
    missingSeverity: "MEDIUM",
    mismatchSeverity: "MEDIUM",
    adoptionImpact: "Audit readiness gaps require documentation before controlled adoption.",
  });
}

export function calculateAdoptionReadiness(
  comparisons: readonly ParallelRuntimeComparison[],
  risks: readonly ParallelRuntimeRisk[] = comparisons.flatMap((comparison) => comparison.risks),
): ParallelRuntimeAdoptionStatus {
  const criticalPathRisks = risks.filter((risk) =>
    ["AUTHORITY_RISK", "TRACEABILITY_RISK", "LIFECYCLE_RISK"].includes(risk.riskType),
  );
  if (criticalPathRisks.some((risk) => risk.level === "CRITICAL" || risk.level === "HIGH")) return "NOT_READY";
  if (risks.some((risk) => risk.level === "CRITICAL")) return "NOT_READY";
  if (risks.some((risk) => risk.level === "HIGH")) return "READY_FOR_SHADOW_DEPLOYMENT";
  if (comparisons.every((comparison) => comparison.alignment === "ALIGNED") && risks.every((risk) => risk.level === "LOW")) {
    return "READY_FOR_CONTROLLED_ADOPTION";
  }
  if (comparisons.every((comparison) => comparison.alignment !== "MISALIGNED")) return "READY_FOR_PARALLEL_DEPLOYMENT";
  return "READY_FOR_SHADOW_DEPLOYMENT";
}

function compareValue(args: {
  area: ParallelComparisonArea;
  riskType: ParallelRuntimeRiskType;
  dalValue: unknown;
  constitutionalValue: unknown;
  missingSeverity: ParallelRuntimeRiskLevel;
  mismatchSeverity: ParallelRuntimeRiskLevel;
  adoptionImpact: string;
}): ParallelRuntimeComparison {
  const findings: ParallelRuntimeFinding[] = [];
  if (args.dalValue === undefined || args.constitutionalValue === undefined) {
    findings.push(finding(args.area, "value", args.riskType, args.missingSeverity, args.constitutionalValue, args.dalValue, `${args.area} missing from one runtime.`, args.adoptionImpact));
  } else if (JSON.stringify(args.dalValue) !== JSON.stringify(args.constitutionalValue)) {
    findings.push(finding(args.area, "value", args.riskType, args.mismatchSeverity, args.constitutionalValue, args.dalValue, `${args.area} differs between runtimes.`, args.adoptionImpact));
  }
  return comparison(args.area, args.riskType, args.dalValue, args.constitutionalValue, findings);
}

function comparison(
  area: ParallelComparisonArea,
  riskType: ParallelRuntimeRiskType,
  dalValue: unknown,
  constitutionalValue: unknown,
  findings: readonly ParallelRuntimeFinding[],
): ParallelRuntimeComparison {
  const alignment = alignmentFromFindings(findings);
  const risks = findings.map((item) =>
    createParallelRisk({
      riskType: item.riskType,
      level: item.severity,
      component: item.component,
      message: item.gap,
      productionCutoverImpact: item.adoptionImpact,
    }),
  );
  const diagnostics: ParallelRuntimeDiagnostic[] = [
    createParallelDiagnostic(
      alignment === "ALIGNED" ? "PARALLEL_COMPARISON_ALIGNED" : "PARALLEL_COMPARISON_MISMATCH",
      findings.length ? diagnosticSeverityForRisk(maxFindingSeverity(findings)) : "INFO",
      `${area} comparison ${alignment.toLowerCase().replaceAll("_", " ")}.`,
      { area, dalValue, constitutionalValue, findingCount: findings.length },
    ),
    ...risks.map((risk) =>
      createParallelDiagnostic("PARALLEL_RISK_IDENTIFIED", diagnosticSeverityForRisk(risk.level), risk.message, {
        riskType: risk.riskType,
        component: risk.component,
      }),
    ),
  ];
  return {
    comparisonId: `PARALLEL-COMPARISON-${area.replace(/[^A-Z0-9]+/gi, "-")}`,
    area,
    alignment,
    dalValue,
    constitutionalValue,
    findings: [...findings],
    risks,
    diagnostics,
  };
}

function finding(
  component: string,
  field: string,
  riskType: ParallelRuntimeRiskType,
  severity: ParallelRuntimeRiskLevel,
  constitutionalValue: unknown,
  dalValue: unknown,
  gap: string,
  adoptionImpact: string,
) {
  return createParallelFinding({
    component,
    riskType,
    severity,
    dalValue,
    constitutionalValue,
    gap: `${field}: ${gap}`,
    adoptionImpact,
  });
}

function aggregateAlignment(alignments: readonly ParallelRuntimeAlignment[]): ParallelRuntimeAlignment {
  if (alignments.includes("MISALIGNED")) return "MISALIGNED";
  if (alignments.includes("PARTIALLY_ALIGNED")) return "PARTIALLY_ALIGNED";
  return "ALIGNED";
}

function maxRisk(risks: readonly ParallelRuntimeRisk[]): ParallelRuntimeRiskLevel {
  if (risks.some((risk) => risk.level === "CRITICAL")) return "CRITICAL";
  if (risks.some((risk) => risk.level === "HIGH")) return "HIGH";
  if (risks.some((risk) => risk.level === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function maxFindingSeverity(findings: readonly ParallelRuntimeFinding[]): ParallelRuntimeRiskLevel {
  if (findings.some((findingItem) => findingItem.severity === "CRITICAL")) return "CRITICAL";
  if (findings.some((findingItem) => findingItem.severity === "HIGH")) return "HIGH";
  if (findings.some((findingItem) => findingItem.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}
