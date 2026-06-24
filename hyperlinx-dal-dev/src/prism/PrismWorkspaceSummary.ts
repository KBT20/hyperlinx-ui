import type { PrismWorkspaceStatus } from "./PrismWorkspaceStatus";

export interface PrismWorkspaceSummary {
  customerName: string;
  opportunityName: string;
  opportunityId: string;
  networkType: string;
  protectionSchema: string;
  status: PrismWorkspaceStatus;
  baselineObjectCount: number;
  marketplaceMatchCount: number;
  riskCount: number;
  recommendationCount: number;
  routeAlternativeCount: number;
  readyForQuote: boolean;
  nextAction: "RESOLVE_BLOCKERS" | "GENERATE_PRELIMINARY_QUOTE" | "HUMAN_REVIEW";
}
