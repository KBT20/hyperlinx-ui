import type { CorridorNetworkRole } from "../corridor/corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "../corridor/CorridorLens";
import type { ReferenceArchitectureToolRequirement } from "../corridor/CorridorReferenceArchitecture";
import type { PrismObjectPopulationPlan, PrismProductPlan, PrismRecommendationLevel } from "../corridor/PrismRecommendationContract";
import type {
  CommercialAssumption,
  CommercialConfidence,
  CommercialProductEstimate,
  CommercialQuantityEstimate,
  CommercialRisk,
  EstimateStatus,
  PreliminaryQuote,
} from "./PreliminaryQuote";

export interface OpportunityPackage {
  opportunityPackageId: string;
  candidateId: string;
  corridorId: string;
  customerAsk: string;
  lensType?: CorridorLensType;
  networkRole?: CorridorNetworkRole;
  referenceArchitectureId?: string;
  recommendationLevel?: PrismRecommendationLevel;
  recommendedProducts: PrismProductPlan[];
  objectPlan: PrismObjectPopulationPlan;
  requiredObjects: CorridorLensObjectType[];
  requiredTools: ReferenceArchitectureToolRequirement[];
  requiredDesignStandards: string[];
  estimatedQuantities: CommercialQuantityEstimate;
  productEstimates: CommercialProductEstimate[];
  estimatedNrc: number;
  estimatedMrc: number;
  estimatedIru: number;
  commercialAssumptions: CommercialAssumption[];
  commercialRisks: CommercialRisk[];
  confidence: CommercialConfidence;
  engineeringReviewRequired: boolean;
  marketplaceBudgetRequired: boolean;
  status: EstimateStatus;
  preliminaryQuote: PreliminaryQuote;
  doctrine: "OPPORTUNITY_PACKAGE_IS_ADVISORY_ONLY";
  createdAt: string;
}
