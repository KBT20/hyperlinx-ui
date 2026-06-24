import type { OpportunityRequest } from "../opportunity/OpportunityRequest";
import type { BaselineNetworkCandidate } from "./BaselineNetworkCandidate";
import type { NetworkIntent } from "./NetworkIntent";
import type { ProtectionSchema } from "./ProtectionSchema";
import type {
  ArchitectureSummaryCardModel,
  BaselineSummaryCardModel,
  TranslateBlockerPanelModel,
  TranslateNextActionPanelModel,
  TranslateReadinessCardModel,
  TranslateWorkspaceSummary,
} from "./TranslateWorkspaceSummary";
import type { TranslateWorkspaceNextAction, TranslateWorkspaceStatus } from "./TranslateWorkspaceStatus";

export interface TranslateWorkspaceBlocker {
  blockerId: string;
  field: string;
  severity: "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  blocksScopeReview: boolean;
}

export interface TranslateWorkspaceDiagnostic {
  code:
    | "TRANSLATE_WORKSPACE_CREATED"
    | "INTENT_CONFIRMED"
    | "PROTECTION_CONFIRMED"
    | "ARCHITECTURE_SELECTED"
    | "BASELINE_SYNTHESIZED"
    | "READY_FOR_SCOPE_REVIEW"
    | "TRANSLATE_BLOCKED";
  severity: "INFO" | "WARNING" | "ERROR";
  customerId?: string;
  opportunityId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface TranslateWorkspaceInput {
  opportunity: OpportunityRequest;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  baselineNetworkCandidate?: BaselineNetworkCandidate;
  evaluatedAt?: string;
}

export interface TranslateWorkspace {
  workspaceId: "TRANSLATE_WORKSPACE";
  title: string;
  opportunity: OpportunityRequest;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  baselineNetworkCandidate?: BaselineNetworkCandidate;
  status: TranslateWorkspaceStatus;
  summary: TranslateWorkspaceSummary;
  blockers: TranslateWorkspaceBlocker[];
  diagnostics: TranslateWorkspaceDiagnostic[];
  nextAction: TranslateWorkspaceNextAction;
  cards: {
    baselineSummary: BaselineSummaryCardModel;
    architectureSummary: ArchitectureSummaryCardModel;
    readiness: TranslateReadinessCardModel;
    blockers: TranslateBlockerPanelModel;
    nextAction: TranslateNextActionPanelModel;
  };
  noPersistence: true;
  noServerRoutes: true;
  noReactImplementation: true;
  noScopeVersionCreation: true;
  noRouting: true;
  noEngineering: true;
}
