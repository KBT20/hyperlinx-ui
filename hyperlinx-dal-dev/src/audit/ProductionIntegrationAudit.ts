import type { AuditSeverity } from "./ConstitutionalAudit";

export type ProductionIntegrationDiagnosticCode =
  | "PRODUCTION_AUDIT_STARTED"
  | "INTEGRATION_GAP_IDENTIFIED"
  | "DEPENDENCY_IDENTIFIED"
  | "RISK_IDENTIFIED"
  | "PRODUCTION_AUDIT_COMPLETE";

export type IntegrationRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IntegrationSurfaceName =
  | "Customer"
  | "Opportunity"
  | "Corridor"
  | "ScopeVersion"
  | "Marketplace"
  | "Control"
  | "Field"
  | "Completion"
  | "Operations"
  | "Prism"
  | "Translate";

export type IntegrationSurfaceStatus =
  | "READY"
  | "PARTIAL"
  | "MISSING"
  | "LEGACY_ONLY"
  | "ADAPTER_REQUIRED";

export type ScopeVersionReferenceStatus =
  | "CANONICAL_SCOPEVERSION"
  | "MISSING_SCOPEVERSION"
  | "DUPLICATE_SCOPEVERSION"
  | "UNBOUNDED_REFERENCE"
  | "LEGACY_REFERENCE";

export interface ProductionIntegrationDiagnostic {
  code: ProductionIntegrationDiagnosticCode;
  severity: AuditSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface IntegrationFinding {
  findingId: string;
  severity: AuditSeverity;
  riskLevel: IntegrationRiskLevel;
  message: string;
  surface?: IntegrationSurfaceName;
  dependencyId?: string;
  remediation?: string;
}

export interface IntegrationSurfaceAssessment {
  surface: IntegrationSurfaceName;
  currentDalOwner: string;
  currentImplementation: string;
  constitutionalImplementation: string;
  integrationGap: string;
  requiredAdapter: string;
  riskLevel: IntegrationRiskLevel;
  status: IntegrationSurfaceStatus;
}

export interface RuntimeDependency {
  dependencyId: string;
  from: IntegrationSurfaceName;
  to: IntegrationSurfaceName;
  requiredInputs: string[];
  requiredOutputs: string[];
  missingDependencies: string[];
  duplicateDependencies: string[];
  riskLevel: IntegrationRiskLevel;
}

export interface ScopeVersionReferenceAuditItem {
  component: IntegrationSurfaceName;
  scopeVersionId?: string;
  referenceStatus: ScopeVersionReferenceStatus;
  notes?: string;
}

export interface MarketplaceIntegrationFlow {
  flowId: string;
  customerLinked: boolean;
  opportunityLinked: boolean;
  budgetLinked: boolean;
  vendorLinked: boolean;
  bidPackageLinked: boolean;
  contractReadinessLinked: boolean;
  controlActivationLinked: boolean;
  authorityBoundaryPreserved: boolean;
}

export interface ExecutionIntegrationFlow {
  flowId: string;
  controlConnected: boolean;
  workPackagesConnected: boolean;
  fieldConnected: boolean;
  completionConnected: boolean;
  operationsConnected: boolean;
  lifecycleBypassDetected: boolean;
  authorityBypassDetected: boolean;
  kernelMutationRequired: boolean;
  requiredCloseTypes: string[];
  missingCloseTypes: string[];
}

export interface ProductionIntegrationSnapshot {
  snapshotId: string;
  surfaces: readonly IntegrationSurfaceAssessment[];
  dependencies: readonly RuntimeDependency[];
  scopeVersionReferences: readonly ScopeVersionReferenceAuditItem[];
  marketplaceFlows: readonly MarketplaceIntegrationFlow[];
  executionFlows: readonly ExecutionIntegrationFlow[];
  notes?: string;
}

export interface ProductionAuditResult {
  auditId: string;
  snapshotId: string;
  passed: boolean;
  findings: IntegrationFinding[];
  diagnostics: ProductionIntegrationDiagnostic[];
}

export interface IntegrationAuditResult extends ProductionAuditResult {
  surfaceCount: number;
  adapterRequiredCount: number;
  criticalSurfaceCount: number;
}

export interface DependencyAuditResult extends ProductionAuditResult {
  dependencyCount: number;
  missingDependencyCount: number;
  duplicateDependencyCount: number;
}

export interface ScopeVersionProductionAuditResult extends ProductionAuditResult {
  componentCount: number;
  canonicalReferenceCount: number;
  missingReferenceCount: number;
  legacyReferenceCount: number;
}

export interface MarketplaceProductionAuditResult extends ProductionAuditResult {
  flowCount: number;
  completeFlowCount: number;
  blockedFlowCount: number;
}

export interface ExecutionProductionAuditResult extends ProductionAuditResult {
  flowCount: number;
  connectedFlowCount: number;
  bypassCount: number;
}

export interface ProductionReadinessAuditResult extends ProductionAuditResult {
  integration: IntegrationAuditResult;
  dependencies: DependencyAuditResult;
  scopeVersion: ScopeVersionProductionAuditResult;
  marketplace: MarketplaceProductionAuditResult;
  execution: ExecutionProductionAuditResult;
  riskRegister: IntegrationFinding[];
  cutoverRecommendation: "AUDIT_ONLY" | "READ_ONLY_ADAPTERS" | "SHADOW_RUNTIME" | "PARALLEL_VALIDATION" | "PRODUCTION_ADOPTION_READY";
  completedAt: string;
}
