import type { OpportunityLaunchResult } from "../customer/OpportunityLaunch";
import type { BaselineNetworkCandidate } from "../translate/BaselineNetworkCandidate";
import type { NetworkIntent, NetworkType } from "../translate/NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "../translate/ProtectionSchema";
import type { ScopeReviewStatus } from "../review/ScopeReview";
import type { OpportunityRequest } from "./OpportunityRequest";
import type { OpportunityNextAction } from "./OpportunityNextAction";
import type { OpportunityStatusCard } from "./OpportunityStatusCard";

export type OpportunityWorkspaceStatus =
  | "DRAFT"
  | "INTAKE_READY"
  | "READY_TO_LAUNCH_TRANSLATE"
  | "TRANSLATE_IN_PROGRESS"
  | "BASELINE_READY"
  | "SCOPE_REVIEW_READY"
  | "SCOPE_REVIEW_IN_PROGRESS"
  | "READY_FOR_PRISM"
  | "PRISM_COMPLETE"
  | "QUOTE_READY"
  | "BLOCKED";

export type OpportunityWorkspaceSection =
  | "CUSTOMER_SUMMARY"
  | "OPPORTUNITY_SUMMARY"
  | "NETWORK_INTENT"
  | "PROTECTION_SCHEMA"
  | "LOCATIONS"
  | "ATTACHMENTS"
  | "TRANSLATE_STATUS"
  | "BASELINE_NETWORK_SUMMARY"
  | "SCOPE_REVIEW_STATUS"
  | "PRISM_STATUS"
  | "PRELIMINARY_QUOTE_STATUS"
  | "NEXT_ACTION"
  | "DIAGNOSTICS";

export interface OpportunityWorkspaceDiagnostic {
  code:
    | "OPPORTUNITY_WORKSPACE_BUILT"
    | "OPPORTUNITY_STATUS_DETERMINED"
    | "OPPORTUNITY_NEXT_ACTION_DETERMINED"
    | "OPPORTUNITY_WORKSPACE_BLOCKER_IDENTIFIED"
    | "OPPORTUNITY_WORKSPACE_READY";
  severity: "INFO" | "WARNING" | "ERROR";
  customerId?: string;
  opportunityId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export type OpportunityStageSignal =
  | "NOT_STARTED"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "BLOCKED";

export interface OpportunityDetailStageContext {
  translateStatus?: OpportunityStageSignal;
  baselineNetwork?: BaselineNetworkCandidate;
  scopeReviewStatus?: ScopeReviewStatus;
  prismStatus?: OpportunityStageSignal;
  preliminaryQuoteStatus?: OpportunityStageSignal;
  launchResult?: OpportunityLaunchResult;
}

export interface OpportunitySummary {
  customerId: string;
  customerName: string;
  opportunityId: string;
  opportunityName: string;
  accountOwner: string;
  businessSponsor?: string;
  networkType?: NetworkType;
  protectionSchema?: ProtectionSchemaType;
  requestedProducts: string[];
  requestedServices: string[];
  locationCount: number;
  attachmentCount: number;
  currentStatus: OpportunityWorkspaceStatus;
  nextAction: OpportunityNextAction;
}

export interface OpportunityDetailWorkspaceInput {
  opportunity: OpportunityRequest;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  stageContext?: OpportunityDetailStageContext;
  evaluatedAt?: string;
}

export interface OpportunityDetailWorkspace {
  workspaceId: "OPPORTUNITY_DETAIL";
  title: string;
  opportunity: OpportunityRequest;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  summary: OpportunitySummary;
  status: OpportunityWorkspaceStatus;
  sections: OpportunityWorkspaceSection[];
  statusCards: OpportunityStatusCard[];
  nextAction: OpportunityNextAction;
  blockers: string[];
  diagnostics: OpportunityWorkspaceDiagnostic[];
  stageContext: OpportunityDetailStageContext;
  noPersistence: true;
  noServerRoutes: true;
  noProductionUiWiring: true;
  noReactImplementation: true;
}
