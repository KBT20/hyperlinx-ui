import type { ProposedInventory } from "./ProposedInventory";
import type { PreliminaryQuoteLineItem } from "./PreliminaryQuoteLineItem";
import type { QuoteConfidence, QuoteReadiness, QuoteReadinessBlocker, QuoteReadinessDiagnostic } from "./QuoteReadiness";

export interface PreliminaryQuotePackage {
  quotePackageId: string;
  proposalId: string;
  proposedGraphId?: string;
  routeCandidateId?: string;
  centerlineRouteId?: string;
  stationedCorridorId?: string;
  takeoffId?: string;
  engineeringConstraintCandidateIds?: string[];
  customer: string;
  customerId: string;
  opportunity: string;
  opportunityId: string;
  routeRequestId: string;
  networkSummary: string;
  estimatedRoute: string;
  estimatedFootage: number;
  primaryProduct: ProposedInventory["primaryProduct"];
  constructionSummary: string;
  estimatedNrc: number;
  estimatedMrc: number;
  recommendedTermMonths: number;
  estimatedTcv: number;
  lineItems: PreliminaryQuoteLineItem[];
  assumptions: string[];
  confidence: QuoteConfidence;
  disclaimers: string[];
  readiness: QuoteReadiness;
  blockers: QuoteReadinessBlocker[];
  diagnostics: QuoteReadinessDiagnostic[];
  generatedAt: string;
  readOnly: true;
  preliminary: true;
  nonContractual: true;
  engineeringValidationRequired: true;
}

export interface EngineeringHandoffCandidate {
  proposalId: string;
  proposedGraphId?: string;
  routeCandidateId?: string;
  centerlineRouteId?: string;
  stationedCorridorId?: string;
  takeoffId?: string;
  engineeringConstraintCandidateIds?: string[];
  customerId: string;
  opportunityId: string;
  routeRequestId: string;
  proposalAccepted: boolean;
  estimatedInventory: ProposedInventory;
  estimatedFinancials: {
    estimatedNrc: number;
    estimatedMrc: number;
    estimatedTcv: number;
    recommendedTermMonths: number;
  };
  noEngineeringExecution: true;
  engineeringCertificationRequired: true;
  noGeometryMutation: true;
  noScopeVersionCreation: true;
}
