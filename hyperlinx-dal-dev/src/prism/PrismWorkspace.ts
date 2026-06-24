import type { MarketplaceAsset } from "../marketplace/MarketplaceAsset";
import type { OpportunityDetailWorkspace } from "../opportunity/OpportunityDetailWorkspace";
import type { ScopeReviewWorkspace } from "../review/ScopeReviewWorkspace";
import type { BaselineNetworkCandidate } from "../translate/BaselineNetworkCandidate";
import type { PrismAdvisoryCard, PrismOpportunity, PrismRecommendation, PrismRisk } from "./PrismAdvisoryCard";
import type { PrismWorkspaceStatus, PrismWorkspaceSection, PrismWorkspaceBlocker, PrismWorkspaceDiagnostic } from "./PrismWorkspaceStatus";
import type { PrismWorkspaceSummary } from "./PrismWorkspaceSummary";

export interface PrismRouteAlternative {
  alternativeId: string;
  label: string;
  routeType: "PRIMARY" | "DIVERSE" | "LOW_COST" | "LOW_RISK" | "MARKETPLACE_ASSISTED";
  summary: string;
  evidenceIds: string[];
  advisoryOnly: true;
}

export interface PrismCostDriver {
  costDriverId: string;
  label: string;
  category: "CONSTRUCTION" | "POWER" | "FACILITY" | "MARKETPLACE" | "RIGHT_OF_WAY" | "ENGINEERING";
  impact: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
}

export interface PrismDiversityGap {
  gapId: string;
  gapType: "ROUTE" | "FACILITY" | "POWER" | "MARKETPLACE" | "JURISDICTION";
  summary: string;
  suggestedReview: string;
}

export interface PrismWorkspaceInput {
  opportunityWorkspace: OpportunityDetailWorkspace;
  scopeReviewWorkspace?: ScopeReviewWorkspace;
  marketplaceAssets?: readonly MarketplaceAsset[];
  candidateSites?: readonly string[];
  routeAlternatives?: readonly PrismRouteAlternative[];
  evaluatedAt?: string;
}

export interface PrismWorkspace {
  workspaceId: "PRISM_WORKSPACE";
  title: string;
  opportunityWorkspace: OpportunityDetailWorkspace;
  baselineNetwork?: BaselineNetworkCandidate;
  scopeReviewWorkspace?: ScopeReviewWorkspace;
  marketplaceAssets: readonly MarketplaceAsset[];
  candidateSites: readonly string[];
  sections: readonly PrismWorkspaceSection[];
  status: PrismWorkspaceStatus;
  summary: PrismWorkspaceSummary;
  advisoryCards: readonly PrismAdvisoryCard[];
  opportunities: readonly PrismOpportunity[];
  risks: readonly PrismRisk[];
  recommendations: readonly PrismRecommendation[];
  routeAlternatives: readonly PrismRouteAlternative[];
  costDrivers: readonly PrismCostDriver[];
  diversityGaps: readonly PrismDiversityGap[];
  blockers: readonly PrismWorkspaceBlocker[];
  diagnostics: readonly PrismWorkspaceDiagnostic[];
  noPersistence: true;
  noServerRoutes: true;
  noAuthorityCreated: true;
  noLifecycleMutation: true;
  noScopeVersionMutation: true;
  advisoryOnly: true;
}
