import type { MarketplaceAsset } from "../marketplace/MarketplaceAsset";
import type { PrismWorkspace } from "../prism/PrismWorkspace";
import type { PreliminaryQuoteAssumption } from "./PreliminaryQuoteAssumption";
import type { PreliminaryQuoteConfidenceBasis } from "./PreliminaryQuoteConfidence";
import type { PreliminaryQuoteProduct, PreliminaryQuoteWorkspaceSummary } from "./PreliminaryQuoteWorkspaceSummary";

export type PreliminaryQuoteWorkspaceSection =
  | "CUSTOMER_SUMMARY"
  | "OPPORTUNITY_SUMMARY"
  | "NETWORK_INTENT"
  | "PROTECTION_SCHEMA"
  | "REFERENCE_ARCHITECTURE"
  | "RECOMMENDED_PRODUCTS"
  | "MARKETPLACE_INPUTS"
  | "ESTIMATED_NRC"
  | "ESTIMATED_MRC"
  | "ESTIMATED_TERM"
  | "ASSUMPTIONS"
  | "RISKS"
  | "CONFIDENCE"
  | "DIAGNOSTICS"
  | "NEXT_ACTION";

export interface PreliminaryQuoteDiagnostic {
  diagnosticId: string;
  code:
    | "QUOTE_WORKSPACE_CREATED"
    | "PRODUCTS_SELECTED"
    | "ASSUMPTIONS_GENERATED"
    | "CONFIDENCE_CALCULATED"
    | "READY_FOR_CUSTOMER_DISCUSSION"
    | "QUOTE_BLOCKED";
  severity: "INFO" | "WARNING" | "ERROR";
  opportunityId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface PreliminaryQuoteBlocker {
  blockerId: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  requiredAction: string;
}

export interface PreliminaryQuoteRisk {
  riskId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  mitigation: string;
}

export interface PreliminaryQuoteLineItem {
  lineItemId: string;
  label: string;
  product: PreliminaryQuoteProduct;
  estimatedNrc: number;
  estimatedMrc: number;
  source: "FIXTURE" | "MARKETPLACE_FIXTURE" | "PRISM_FIXTURE";
  advisoryOnly: true;
}

export interface PreliminaryQuoteWorkspaceInput {
  prismWorkspace: PrismWorkspace;
  marketplaceAssets?: readonly MarketplaceAsset[];
  recommendedProducts?: readonly PreliminaryQuoteProduct[];
  estimatedNrc?: number;
  estimatedMrc?: number;
  estimatedTermMonths?: number;
  quoteGenerated?: boolean;
  evaluatedAt?: string;
}

export interface PreliminaryQuoteWorkspace {
  workspaceId: "PRELIMINARY_QUOTE_WORKSPACE";
  title: string;
  prismWorkspace: PrismWorkspace;
  marketplaceAssets: readonly MarketplaceAsset[];
  sections: readonly PreliminaryQuoteWorkspaceSection[];
  summary: PreliminaryQuoteWorkspaceSummary;
  lineItems: readonly PreliminaryQuoteLineItem[];
  assumptions: readonly PreliminaryQuoteAssumption[];
  risks: readonly PreliminaryQuoteRisk[];
  confidenceBasis: PreliminaryQuoteConfidenceBasis;
  blockers: readonly PreliminaryQuoteBlocker[];
  diagnostics: readonly PreliminaryQuoteDiagnostic[];
  advisoryOnly: true;
  preliminaryOnly: true;
  nonContractual: true;
  engineeringValidationRequired: true;
  noContractAuthority: true;
  noBudgetLock: true;
  noSof: true;
  noPersistence: true;
  noServerRoutes: true;
  noAuthorityCreated: true;
}
