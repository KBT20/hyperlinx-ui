import type { ArchitectureSelection } from "./ArchitectureSelection";
import type { BaselineNetworkObject } from "./BaselineNetworkObject";
import type { CustomerContext, NetworkIntent, NetworkType, OpportunityContext } from "./NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "./ProtectionSchema";

export type BaselineNetworkReadinessStatus = "READY_FOR_SCOPE_REVIEW" | "BLOCKED";

export type BaselineNetworkDiagnosticCode =
  | "INTENT_SELECTED"
  | "PROTECTION_SELECTED"
  | "ARCHITECTURE_SELECTED"
  | "BASELINE_SYNTHESIZED"
  | "READY_FOR_SCOPE_REVIEW"
  | "BASELINE_SYNTHESIS_BLOCKED";

export interface BaselineNetworkDiagnostic {
  code: BaselineNetworkDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  customerId?: string;
  opportunityId?: string;
  candidateId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface BaselineNetworkTraceability {
  customerId: string;
  opportunityId: string;
  corridorId?: string;
  scopeVersionId?: string;
  intentId?: string;
  protectionSchemaId?: string;
  architectureSelectionId?: string;
}

export interface BaselineNetworkCandidate {
  candidateId: string;
  customerContext: CustomerContext;
  opportunityContext: OpportunityContext;
  selectedIntent?: NetworkIntent;
  selectedProtection?: ProtectionSchema;
  architectureSelection?: ArchitectureSelection;
  referenceArchitecture?: string;
  candidateObjects: BaselineNetworkObject[];
  status: BaselineNetworkReadinessStatus;
  blockers: string[];
  diagnostics: BaselineNetworkDiagnostic[];
  traceability: BaselineNetworkTraceability;
  generatedAt: string;
  noRouting: true;
  noEngineering: true;
  noScopeVersionCreation: true;
  nonAuthoritative: true;
}

export interface BaselineNetworkSummaryCardModel {
  modelId: "BASELINE_NETWORK_SUMMARY_CARD";
  candidateId: string;
  networkType?: NetworkType;
  protectionSchema?: ProtectionSchemaType;
  objectCount: number;
  referenceArchitecture?: string;
  noAuthorityCreated: true;
}

export interface ScopeReviewReadinessCardModel {
  modelId: "SCOPE_REVIEW_READINESS_CARD";
  status: BaselineNetworkReadinessStatus;
  blockers: string[];
  nextWorkspace: "Scope Review";
}

export interface BaselineNetworkSynthesisViewModel {
  intentSelector: {
    modelId: "NETWORK_INTENT_SELECTOR";
    selectedNetworkType?: NetworkType;
  };
  protectionSelector: {
    modelId: "PROTECTION_SELECTOR";
    selectedProtectionSchema?: ProtectionSchemaType;
  };
  architectureSummary?: {
    modelId: "ARCHITECTURE_SUMMARY_CARD";
    referenceArchitecture?: string;
  };
  baselineNetworkSummary: BaselineNetworkSummaryCardModel;
  scopeReviewReadiness: ScopeReviewReadinessCardModel;
}
