import type { AuditSeverity } from "./ConstitutionalAudit";
import type {
  DependencyAuditResult,
  ExecutionIntegrationFlow,
  ExecutionProductionAuditResult,
  IntegrationAuditResult,
  IntegrationFinding,
  IntegrationRiskLevel,
  IntegrationSurfaceAssessment,
  MarketplaceIntegrationFlow,
  MarketplaceProductionAuditResult,
  ProductionIntegrationDiagnostic,
  ProductionIntegrationDiagnosticCode,
  ProductionIntegrationSnapshot,
  ProductionReadinessAuditResult,
  RuntimeDependency,
  ScopeVersionProductionAuditResult,
  ScopeVersionReferenceAuditItem,
} from "./ProductionIntegrationAudit";

const REQUIRED_EXECUTION_CLOSE_TYPES = ["CONTRACT_CLOSE", "CONTROL_CLOSE", "FIELD_CLOSE", "COMPLETION_CLOSE", "OPERATIONS_CLOSE"];

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: ProductionIntegrationDiagnosticCode,
  severity: AuditSeverity,
  message: string,
  details?: Record<string, unknown>,
): ProductionIntegrationDiagnostic {
  return { code, severity, message, details };
}

function finding(args: Omit<IntegrationFinding, "findingId">): IntegrationFinding {
  const source = args.surface ?? args.dependencyId ?? "GLOBAL";
  return {
    findingId: `PROD-INTEGRATION-FINDING-${source}-${args.message.replace(/[^A-Z0-9]+/gi, "-").slice(0, 56)}`,
    ...args,
  };
}

export function runIntegrationAudit(snapshot: ProductionIntegrationSnapshot): IntegrationAuditResult {
  const findings: IntegrationFinding[] = [];
  const diagnostics: ProductionIntegrationDiagnostic[] = [
    diagnostic("PRODUCTION_AUDIT_STARTED", "INFO", "Integration surface audit started.", { snapshotId: snapshot.snapshotId }),
  ];

  for (const surface of snapshot.surfaces) {
    if (surface.status !== "READY") {
      findings.push(surfaceFinding(surface));
      diagnostics.push(
        diagnostic("INTEGRATION_GAP_IDENTIFIED", severityForRisk(surface.riskLevel), `${surface.surface} integration gap identified.`, {
          status: surface.status,
          requiredAdapter: surface.requiredAdapter,
          riskLevel: surface.riskLevel,
        }),
      );
    }
    if (surface.riskLevel === "HIGH" || surface.riskLevel === "CRITICAL") {
      diagnostics.push(
        diagnostic("RISK_IDENTIFIED", severityForRisk(surface.riskLevel), `${surface.surface} carries ${surface.riskLevel} integration risk.`, {
          surface: surface.surface,
        }),
      );
    }
  }

  const passed = !hasBlockingRisk(findings);
  diagnostics.push(diagnostic("PRODUCTION_AUDIT_COMPLETE", passed ? "INFO" : "ERROR", "Integration surface audit complete.", {
    passed,
    findingCount: findings.length,
  }));

  return {
    auditId: `INTEGRATION-SURFACE-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    surfaceCount: snapshot.surfaces.length,
    adapterRequiredCount: snapshot.surfaces.filter((surface) => surface.status === "ADAPTER_REQUIRED").length,
    criticalSurfaceCount: snapshot.surfaces.filter((surface) => surface.riskLevel === "CRITICAL").length,
    findings,
    diagnostics,
  };
}

export function runDependencyAudit(snapshot: ProductionIntegrationSnapshot): DependencyAuditResult {
  const findings: IntegrationFinding[] = [];
  const diagnostics: ProductionIntegrationDiagnostic[] = [
    diagnostic("PRODUCTION_AUDIT_STARTED", "INFO", "Runtime dependency audit started.", { snapshotId: snapshot.snapshotId }),
  ];

  for (const dependency of snapshot.dependencies) {
    diagnostics.push(
      diagnostic("DEPENDENCY_IDENTIFIED", "INFO", `${dependency.from} -> ${dependency.to} dependency identified.`, {
        dependencyId: dependency.dependencyId,
        requiredInputs: dependency.requiredInputs,
        requiredOutputs: dependency.requiredOutputs,
      }),
    );
    if (dependency.missingDependencies.length || dependency.duplicateDependencies.length) {
      findings.push(dependencyFinding(dependency));
      diagnostics.push(
        diagnostic("INTEGRATION_GAP_IDENTIFIED", severityForRisk(dependency.riskLevel), `${dependency.dependencyId} has dependency gaps.`, {
          missingDependencies: dependency.missingDependencies,
          duplicateDependencies: dependency.duplicateDependencies,
        }),
      );
    }
  }

  const passed = !hasBlockingRisk(findings);
  diagnostics.push(diagnostic("PRODUCTION_AUDIT_COMPLETE", passed ? "INFO" : "ERROR", "Runtime dependency audit complete.", {
    passed,
    findingCount: findings.length,
  }));

  return {
    auditId: `DEPENDENCY-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    dependencyCount: snapshot.dependencies.length,
    missingDependencyCount: snapshot.dependencies.reduce((count, dependency) => count + dependency.missingDependencies.length, 0),
    duplicateDependencyCount: snapshot.dependencies.reduce((count, dependency) => count + dependency.duplicateDependencies.length, 0),
    findings,
    diagnostics,
  };
}

export function runScopeVersionAudit(snapshot: ProductionIntegrationSnapshot): ScopeVersionProductionAuditResult {
  const findings: IntegrationFinding[] = [];
  const diagnostics: ProductionIntegrationDiagnostic[] = [
    diagnostic("PRODUCTION_AUDIT_STARTED", "INFO", "ScopeVersion production reference audit started.", { snapshotId: snapshot.snapshotId }),
  ];

  for (const item of snapshot.scopeVersionReferences) {
    if (item.referenceStatus !== "CANONICAL_SCOPEVERSION") {
      const riskLevel = riskForReference(item);
      findings.push(
        finding({
          severity: severityForRisk(riskLevel),
          riskLevel,
          surface: item.component,
          message: `${item.component} uses ${item.referenceStatus}.`,
          remediation: "Provide a bounded canonical scopeVersionId adapter before production integration.",
        }),
      );
      diagnostics.push(
        diagnostic("INTEGRATION_GAP_IDENTIFIED", severityForRisk(riskLevel), `${item.component} ScopeVersion reference gap identified.`, {
          referenceStatus: item.referenceStatus,
          scopeVersionId: item.scopeVersionId,
        }),
      );
    }
  }

  const passed = !hasBlockingRisk(findings);
  diagnostics.push(diagnostic("PRODUCTION_AUDIT_COMPLETE", passed ? "INFO" : "ERROR", "ScopeVersion production reference audit complete.", {
    passed,
    findingCount: findings.length,
  }));

  return {
    auditId: `SCOPEVERSION-PRODUCTION-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    componentCount: snapshot.scopeVersionReferences.length,
    canonicalReferenceCount: snapshot.scopeVersionReferences.filter((item) => item.referenceStatus === "CANONICAL_SCOPEVERSION").length,
    missingReferenceCount: snapshot.scopeVersionReferences.filter((item) => item.referenceStatus === "MISSING_SCOPEVERSION").length,
    legacyReferenceCount: snapshot.scopeVersionReferences.filter((item) => item.referenceStatus === "LEGACY_REFERENCE").length,
    findings,
    diagnostics,
  };
}

export function runMarketplaceAudit(snapshot: ProductionIntegrationSnapshot): MarketplaceProductionAuditResult {
  const findings: IntegrationFinding[] = [];
  const diagnostics: ProductionIntegrationDiagnostic[] = [
    diagnostic("PRODUCTION_AUDIT_STARTED", "INFO", "Marketplace integration audit started.", { snapshotId: snapshot.snapshotId }),
  ];

  for (const flow of snapshot.marketplaceFlows) {
    const missing = missingMarketplaceLinks(flow);
    if (missing.length || !flow.authorityBoundaryPreserved) {
      const riskLevel: IntegrationRiskLevel = !flow.authorityBoundaryPreserved ? "CRITICAL" : "HIGH";
      findings.push(
        finding({
          severity: severityForRisk(riskLevel),
          riskLevel,
          surface: "Marketplace",
          message: `Marketplace flow ${flow.flowId} is not production-ready.`,
          remediation: `Resolve missing links: ${missing.join(", ") || "authority boundary"}.`,
        }),
      );
      diagnostics.push(
        diagnostic("INTEGRATION_GAP_IDENTIFIED", severityForRisk(riskLevel), `Marketplace flow ${flow.flowId} has gaps.`, {
          missing,
          authorityBoundaryPreserved: flow.authorityBoundaryPreserved,
        }),
      );
    }
  }

  const passed = !hasBlockingRisk(findings);
  diagnostics.push(diagnostic("PRODUCTION_AUDIT_COMPLETE", passed ? "INFO" : "ERROR", "Marketplace integration audit complete.", {
    passed,
    findingCount: findings.length,
  }));

  return {
    auditId: `MARKETPLACE-PRODUCTION-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    flowCount: snapshot.marketplaceFlows.length,
    completeFlowCount: snapshot.marketplaceFlows.filter((flow) => missingMarketplaceLinks(flow).length === 0 && flow.authorityBoundaryPreserved).length,
    blockedFlowCount: findings.length,
    findings,
    diagnostics,
  };
}

export function runExecutionAudit(snapshot: ProductionIntegrationSnapshot): ExecutionProductionAuditResult {
  const findings: IntegrationFinding[] = [];
  const diagnostics: ProductionIntegrationDiagnostic[] = [
    diagnostic("PRODUCTION_AUDIT_STARTED", "INFO", "Execution integration audit started.", { snapshotId: snapshot.snapshotId }),
  ];

  for (const flow of snapshot.executionFlows) {
    const missing = missingExecutionLinks(flow);
    const missingCloseTypes = REQUIRED_EXECUTION_CLOSE_TYPES.filter((closeType) => !flow.requiredCloseTypes.includes(closeType));
    if (missing.length || missingCloseTypes.length || flow.lifecycleBypassDetected || flow.authorityBypassDetected || flow.kernelMutationRequired) {
      const riskLevel: IntegrationRiskLevel =
        flow.lifecycleBypassDetected || flow.authorityBypassDetected || flow.kernelMutationRequired ? "CRITICAL" : "HIGH";
      findings.push(
        finding({
          severity: severityForRisk(riskLevel),
          riskLevel,
          surface: "Control",
          message: `Execution flow ${flow.flowId} is not production-ready.`,
          remediation: `Resolve missing execution links: ${[...missing, ...missingCloseTypes].join(", ") || "authority boundary"}.`,
        }),
      );
      diagnostics.push(
        diagnostic("INTEGRATION_GAP_IDENTIFIED", severityForRisk(riskLevel), `Execution flow ${flow.flowId} has gaps.`, {
          missing,
          missingCloseTypes,
          lifecycleBypassDetected: flow.lifecycleBypassDetected,
          authorityBypassDetected: flow.authorityBypassDetected,
          kernelMutationRequired: flow.kernelMutationRequired,
        }),
      );
    }
  }

  const passed = !hasBlockingRisk(findings);
  diagnostics.push(diagnostic("PRODUCTION_AUDIT_COMPLETE", passed ? "INFO" : "ERROR", "Execution integration audit complete.", {
    passed,
    findingCount: findings.length,
  }));

  return {
    auditId: `EXECUTION-PRODUCTION-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    flowCount: snapshot.executionFlows.length,
    connectedFlowCount: snapshot.executionFlows.filter((flow) => missingExecutionLinks(flow).length === 0).length,
    bypassCount: snapshot.executionFlows.filter((flow) => flow.lifecycleBypassDetected || flow.authorityBypassDetected).length,
    findings,
    diagnostics,
  };
}

export function runProductionReadinessAudit(snapshot: ProductionIntegrationSnapshot): ProductionReadinessAuditResult {
  const started = diagnostic("PRODUCTION_AUDIT_STARTED", "INFO", "Production readiness audit started.", { snapshotId: snapshot.snapshotId });
  console.info("[PRODUCTION_AUDIT_STARTED]", { snapshotId: snapshot.snapshotId });

  const integration = runIntegrationAudit(snapshot);
  const dependencies = runDependencyAudit(snapshot);
  const scopeVersion = runScopeVersionAudit(snapshot);
  const marketplace = runMarketplaceAudit(snapshot);
  const execution = runExecutionAudit(snapshot);
  const findings = [
    ...integration.findings,
    ...dependencies.findings,
    ...scopeVersion.findings,
    ...marketplace.findings,
    ...execution.findings,
  ];
  const passed = !hasBlockingRisk(findings);
  const diagnostics = [
    started,
    ...integration.diagnostics,
    ...dependencies.diagnostics,
    ...scopeVersion.diagnostics,
    ...marketplace.diagnostics,
    ...execution.diagnostics,
    diagnostic("PRODUCTION_AUDIT_COMPLETE", passed ? "INFO" : "ERROR", "Production readiness audit complete.", {
      passed,
      findingCount: findings.length,
    }),
  ];

  console.info("[PRODUCTION_AUDIT_COMPLETE]", {
    snapshotId: snapshot.snapshotId,
    passed,
    findingCount: findings.length,
  });

  return {
    auditId: `PRODUCTION-READINESS-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    integration,
    dependencies,
    scopeVersion,
    marketplace,
    execution,
    riskRegister: findings,
    cutoverRecommendation: recommendationFor(findings),
    findings,
    diagnostics,
    completedAt: nowIso(),
  };
}

function surfaceFinding(surface: IntegrationSurfaceAssessment): IntegrationFinding {
  return finding({
    severity: severityForRisk(surface.riskLevel),
    riskLevel: surface.riskLevel,
    surface: surface.surface,
    message: `${surface.surface} requires integration adapter: ${surface.integrationGap}`,
    remediation: surface.requiredAdapter,
  });
}

function dependencyFinding(dependency: RuntimeDependency): IntegrationFinding {
  return finding({
    severity: severityForRisk(dependency.riskLevel),
    riskLevel: dependency.riskLevel,
    surface: dependency.from,
    dependencyId: dependency.dependencyId,
    message: `${dependency.from} -> ${dependency.to} dependency is incomplete.`,
    remediation: `Resolve missing dependencies: ${dependency.missingDependencies.join(", ") || "none"}; duplicate dependencies: ${dependency.duplicateDependencies.join(", ") || "none"}.`,
  });
}

function missingMarketplaceLinks(flow: MarketplaceIntegrationFlow): string[] {
  const missing: string[] = [];
  if (!flow.customerLinked) missing.push("Customer");
  if (!flow.opportunityLinked) missing.push("Opportunity");
  if (!flow.budgetLinked) missing.push("Budget");
  if (!flow.vendorLinked) missing.push("Vendor");
  if (!flow.bidPackageLinked) missing.push("Bid Package");
  if (!flow.contractReadinessLinked) missing.push("Contract Readiness");
  if (!flow.controlActivationLinked) missing.push("Control Activation");
  return missing;
}

function missingExecutionLinks(flow: ExecutionIntegrationFlow): string[] {
  const missing: string[] = [];
  if (!flow.controlConnected) missing.push("Control");
  if (!flow.workPackagesConnected) missing.push("Work Packages");
  if (!flow.fieldConnected) missing.push("Field");
  if (!flow.completionConnected) missing.push("Completion");
  if (!flow.operationsConnected) missing.push("Operations");
  return missing;
}

function riskForReference(item: { referenceStatus: string }): IntegrationRiskLevel {
  if (item.referenceStatus === "MISSING_SCOPEVERSION") return "CRITICAL";
  if (item.referenceStatus === "UNBOUNDED_REFERENCE") return "HIGH";
  if (item.referenceStatus === "DUPLICATE_SCOPEVERSION") return "HIGH";
  if (item.referenceStatus === "LEGACY_REFERENCE") return "MEDIUM";
  return "LOW";
}

function severityForRisk(risk: IntegrationRiskLevel): AuditSeverity {
  if (risk === "CRITICAL") return "CRITICAL";
  if (risk === "HIGH") return "ERROR";
  if (risk === "MEDIUM") return "WARNING";
  return "INFO";
}

function hasBlockingRisk(findings: readonly IntegrationFinding[]) {
  return findings.some((findingItem) => findingItem.riskLevel === "HIGH" || findingItem.riskLevel === "CRITICAL");
}

function recommendationFor(findings: readonly IntegrationFinding[]): ProductionReadinessAuditResult["cutoverRecommendation"] {
  if (findings.some((findingItem) => findingItem.riskLevel === "CRITICAL")) return "AUDIT_ONLY";
  if (findings.some((findingItem) => findingItem.riskLevel === "HIGH")) return "READ_ONLY_ADAPTERS";
  if (findings.some((findingItem) => findingItem.riskLevel === "MEDIUM")) return "SHADOW_RUNTIME";
  if (findings.some((findingItem) => findingItem.riskLevel === "LOW")) return "PARALLEL_VALIDATION";
  return "PRODUCTION_ADOPTION_READY";
}
