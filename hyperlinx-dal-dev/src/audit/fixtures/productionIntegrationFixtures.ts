import {
  runDependencyAudit,
  runExecutionAudit,
  runIntegrationAudit,
  runMarketplaceAudit,
  runProductionReadinessAudit,
  runScopeVersionAudit,
} from "../ProductionIntegrationAuditEngine";
import type {
  ExecutionIntegrationFlow,
  IntegrationRiskLevel,
  IntegrationSurfaceAssessment,
  IntegrationSurfaceName,
  MarketplaceIntegrationFlow,
  ProductionIntegrationSnapshot,
  RuntimeDependency,
  ScopeVersionReferenceAuditItem,
} from "../ProductionIntegrationAudit";

const surfaces: IntegrationSurfaceName[] = [
  "Customer",
  "Opportunity",
  "Corridor",
  "ScopeVersion",
  "Marketplace",
  "Control",
  "Field",
  "Completion",
  "Operations",
];

function surface(name: IntegrationSurfaceName, overrides: Partial<IntegrationSurfaceAssessment> = {}): IntegrationSurfaceAssessment {
  return {
    surface: name,
    currentDalOwner: `${name} Workspace`,
    currentImplementation: `${name} local DAL module and fixtures`,
    constitutionalImplementation: `${name} constitutional contract layer`,
    integrationGap: "No production gap identified in fixture.",
    requiredAdapter: "Read-only adapter for shadow runtime validation.",
    riskLevel: "LOW",
    status: "READY",
    ...overrides,
  };
}

function dependency(
  from: IntegrationSurfaceName,
  to: IntegrationSurfaceName,
  overrides: Partial<RuntimeDependency> = {},
): RuntimeDependency {
  return {
    dependencyId: `DEP-${from}-${to}`.toUpperCase(),
    from,
    to,
    requiredInputs: ["scopeVersionId", "customerId", "opportunityId", "corridorId"],
    requiredOutputs: ["validatedAuthorityResult", "auditRecord"],
    missingDependencies: [],
    duplicateDependencies: [],
    riskLevel: "LOW",
    ...overrides,
  };
}

function scopeReference(component: IntegrationSurfaceName, overrides: Partial<ScopeVersionReferenceAuditItem> = {}): ScopeVersionReferenceAuditItem {
  return {
    component,
    scopeVersionId: "SV-PROD-INTEGRATION-001",
    referenceStatus: "CANONICAL_SCOPEVERSION",
    ...overrides,
  };
}

function marketplaceFlow(overrides: Partial<MarketplaceIntegrationFlow> = {}): MarketplaceIntegrationFlow {
  return {
    flowId: "MARKETPLACE-FLOW-001",
    customerLinked: true,
    opportunityLinked: true,
    budgetLinked: true,
    vendorLinked: true,
    bidPackageLinked: true,
    contractReadinessLinked: true,
    controlActivationLinked: true,
    authorityBoundaryPreserved: true,
    ...overrides,
  };
}

function executionFlow(overrides: Partial<ExecutionIntegrationFlow> = {}): ExecutionIntegrationFlow {
  return {
    flowId: "EXECUTION-FLOW-001",
    controlConnected: true,
    workPackagesConnected: true,
    fieldConnected: true,
    completionConnected: true,
    operationsConnected: true,
    lifecycleBypassDetected: false,
    authorityBypassDetected: false,
    kernelMutationRequired: false,
    requiredCloseTypes: ["CONTRACT_CLOSE", "CONTROL_CLOSE", "FIELD_CLOSE", "COMPLETION_CLOSE", "OPERATIONS_CLOSE"],
    missingCloseTypes: [],
    ...overrides,
  };
}

function snapshot(
  snapshotId: string,
  overrides: Partial<ProductionIntegrationSnapshot> = {},
): ProductionIntegrationSnapshot {
  return {
    snapshotId,
    surfaces: surfaces.map((name) => surface(name)),
    dependencies: [
      dependency("Marketplace", "Control"),
      dependency("Control", "Field"),
      dependency("Field", "Completion"),
      dependency("Completion", "Operations"),
      dependency("Prism", "ScopeVersion"),
      dependency("Translate", "Corridor"),
    ],
    scopeVersionReferences: surfaces.map((name) => scopeReference(name)),
    marketplaceFlows: [marketplaceFlow()],
    executionFlows: [executionFlow()],
    notes: "Production integration fixture.",
    ...overrides,
  };
}

function missingSurface(name: IntegrationSurfaceName, riskLevel: IntegrationRiskLevel): IntegrationSurfaceAssessment {
  return surface(name, {
    currentImplementation: `${name} has no production adapter in this fixture.`,
    integrationGap: `${name} production adapter missing.`,
    requiredAdapter: `Create read-only ${name} adapter before shadow runtime.`,
    riskLevel,
    status: "ADAPTER_REQUIRED",
  });
}

export const productionIntegrationSnapshots: readonly ProductionIntegrationSnapshot[] = Object.freeze([
  snapshot("PROD-INTEGRATION-FULLY-INTEGRATED"),
  snapshot("PROD-INTEGRATION-MISSING-SCOPEVERSION", {
    scopeVersionReferences: surfaces.map((name) =>
      name === "ScopeVersion"
        ? scopeReference(name, { scopeVersionId: undefined, referenceStatus: "MISSING_SCOPEVERSION" })
        : scopeReference(name),
    ),
  }),
  snapshot("PROD-INTEGRATION-MISSING-MARKETPLACE-DEPENDENCY", {
    surfaces: surfaces.map((name) => (name === "Marketplace" ? missingSurface(name, "HIGH") : surface(name))),
    dependencies: [
      dependency("Marketplace", "Control", { missingDependencies: ["BudgetLock", "ContractReadiness"], riskLevel: "HIGH" }),
    ],
    marketplaceFlows: [marketplaceFlow({ budgetLinked: false, contractReadinessLinked: false })],
  }),
  snapshot("PROD-INTEGRATION-MISSING-CONTROL-DEPENDENCY", {
    surfaces: surfaces.map((name) => (name === "Control" ? missingSurface(name, "CRITICAL") : surface(name))),
    dependencies: [dependency("Control", "Field", { missingDependencies: ["CONTROL_CLOSE", "WorkPackageAdapter"], riskLevel: "CRITICAL" })],
    executionFlows: [executionFlow({ controlConnected: false, requiredCloseTypes: ["CONTRACT_CLOSE", "FIELD_CLOSE", "COMPLETION_CLOSE", "OPERATIONS_CLOSE"] })],
  }),
  snapshot("PROD-INTEGRATION-MISSING-FIELD-DEPENDENCY", {
    surfaces: surfaces.map((name) => (name === "Field" ? missingSurface(name, "CRITICAL") : surface(name))),
    dependencies: [dependency("Field", "Completion", { missingDependencies: ["FIELD_CLOSE", "ClosureLedgerAdapter"], riskLevel: "CRITICAL" })],
    executionFlows: [executionFlow({ fieldConnected: false, requiredCloseTypes: ["CONTRACT_CLOSE", "CONTROL_CLOSE", "COMPLETION_CLOSE", "OPERATIONS_CLOSE"] })],
  }),
  snapshot("PROD-INTEGRATION-MISSING-COMPLETION-DEPENDENCY", {
    surfaces: surfaces.map((name) => (name === "Completion" ? missingSurface(name, "HIGH") : surface(name))),
    dependencies: [dependency("Completion", "Operations", { missingDependencies: ["COMPLETION_CLOSE"], riskLevel: "HIGH" })],
    executionFlows: [executionFlow({ completionConnected: false, requiredCloseTypes: ["CONTRACT_CLOSE", "CONTROL_CLOSE", "FIELD_CLOSE", "OPERATIONS_CLOSE"] })],
  }),
  snapshot("PROD-INTEGRATION-MISSING-OPERATIONS-DEPENDENCY", {
    surfaces: surfaces.map((name) => (name === "Operations" ? missingSurface(name, "HIGH") : surface(name))),
    dependencies: [dependency("Completion", "Operations", { missingDependencies: ["OperationsReadinessAdapter"], riskLevel: "HIGH" })],
    executionFlows: [executionFlow({ operationsConnected: false, requiredCloseTypes: ["CONTRACT_CLOSE", "CONTROL_CLOSE", "FIELD_CLOSE", "COMPLETION_CLOSE"] })],
  }),
  snapshot("PROD-INTEGRATION-LIFECYCLE-BYPASS", {
    executionFlows: [executionFlow({ lifecycleBypassDetected: true })],
  }),
  snapshot("PROD-INTEGRATION-AUTHORITY-BYPASS", {
    marketplaceFlows: [marketplaceFlow({ authorityBoundaryPreserved: false })],
    executionFlows: [executionFlow({ authorityBypassDetected: true })],
  }),
  snapshot("PROD-INTEGRATION-PRODUCTION-READY"),
]);

export const productionIntegrationAuditFixtures = Object.freeze(
  productionIntegrationSnapshots.map(runIntegrationAudit),
);

export const productionDependencyAuditFixtures = Object.freeze(
  productionIntegrationSnapshots.map(runDependencyAudit),
);

export const productionScopeVersionAuditFixtures = Object.freeze(
  productionIntegrationSnapshots.map(runScopeVersionAudit),
);

export const productionMarketplaceAuditFixtures = Object.freeze(
  productionIntegrationSnapshots.map(runMarketplaceAudit),
);

export const productionExecutionAuditFixtures = Object.freeze(
  productionIntegrationSnapshots.map(runExecutionAudit),
);

export const productionReadinessAuditFixtures = Object.freeze(
  productionIntegrationSnapshots.map(runProductionReadinessAudit),
);

export function evaluateProductionIntegrationFixtures() {
  return {
    fixtureCount: productionReadinessAuditFixtures.length,
    readyCount: productionReadinessAuditFixtures.filter((audit) => audit.passed).length,
    blockedCount: productionReadinessAuditFixtures.filter((audit) => !audit.passed).length,
    recommendations: productionReadinessAuditFixtures.map((audit) => ({
      snapshotId: audit.snapshotId,
      recommendation: audit.cutoverRecommendation,
      findingCount: audit.findings.length,
    })),
  };
}
