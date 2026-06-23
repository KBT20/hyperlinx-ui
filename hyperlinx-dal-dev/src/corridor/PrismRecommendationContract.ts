import type { CorridorNetworkRole } from "./corridorTypes";
import type { CorridorLensObjectType, CorridorLensProviderType, CorridorLensType } from "./CorridorLens";
import type { ReferenceArchitectureToolRequirement, ReferenceArchitectureToolType } from "./CorridorReferenceArchitecture";

export type PrismRecommendationLevel =
  | "RECOMMENDED"
  | "ACCEPTABLE"
  | "CONDITIONAL"
  | "NOT_RECOMMENDED"
  | "REJECTED";

export type PrismRecommendationStrength = "STRONG" | "MODERATE" | "WEAK";

export type PrismRecommendationRisk =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "BLOCKING";

export type PrismHumanReviewGateStatus =
  | "PASS_TO_ROUTE_ENGINEERING_REVIEW"
  | "REVIEW_REQUIRED"
  | "BLOCKED";

export type PrismHumanReviewBlockerType =
  | "MISSING_REQUIRED_TOOL_EVIDENCE"
  | "MISSING_REQUIRED_OBJECT_EVIDENCE"
  | "UNRESOLVED_HIGH_SEVERITY_DESIGN_STANDARD"
  | "UNRESOLVED_CONFLICT"
  | "ROUTE_ENGINEERING_REVIEW_REQUIRED"
  | "MISSING_REFERENCE_ARCHITECTURE_FIT"
  | "MISSING_LENS"
  | "MISSING_CUSTOMER_REQUIREMENT"
  | "MISSING_EVIDENCE_CONFIDENCE"
  | "ROUTE_DIVERSITY_NOT_REVIEWED"
  | "REGEN_ADM_OPTICAL_REVIEW_REQUIRED"
  | "POWER_CAPACITY_UNVERIFIED"
  | "JURISDICTION_RISK_UNRESOLVED"
  | "CROSSING_RISK_UNRESOLVED";

export type PrismProductType =
  | "DUCT_SALE"
  | "DUCT_MAINTENANCE"
  | "DARK_FIBER_IRU"
  | "MANAGED_FIBER"
  | "WAVE_SERVICE"
  | "ETHERNET_TRANSPORT"
  | "AI_INTERCONNECT"
  | "ROUTE_OPERATIONS"
  | "RESIDUAL_CAPACITY_MONETIZATION";

export type PrismRecommendationDiagnosticCode =
  | "PRISM_RECOMMENDATION_STARTED"
  | "PRISM_RECOMMENDATION_LEVEL"
  | "PRISM_HUMAN_REVIEW_GATE"
  | "PRISM_OBJECT_POPULATION_PLAN"
  | "PRISM_PRODUCT_PLAN"
  | "PRISM_HANDOFF_DRAFT_CREATED"
  | "PRISM_RECOMMENDATION_WARNING"
  | "PRISM_RECOMMENDATION_BLOCKER"
  | "PRISM_RECOMMENDATION_COMPLETE";

export interface PrismRecommendationDiagnostic {
  code: PrismRecommendationDiagnosticCode;
  candidateId?: string;
  corridorId?: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
  timestamp: string;
  evidenceIds: string[];
  details?: Record<string, unknown>;
}

export interface PrismRecommendationRationale {
  summary: string;
  scoreContext: string;
  architectureContext: string;
  standardsContext: string;
  decisionContext: string;
  evidenceIds: string[];
}

export interface PrismHumanReviewBlocker {
  blockerId: string;
  blockerType: PrismHumanReviewBlockerType;
  severity: PrismRecommendationRisk;
  message: string;
  requiredAction: string;
  evidenceIds: string[];
  objectTypes?: CorridorLensObjectType[];
  requiredTools?: ReferenceArchitectureToolType[];
  requiredStandards?: string[];
}

export interface PrismHumanReviewGate {
  gateStatus: PrismHumanReviewGateStatus;
  blockers: PrismHumanReviewBlocker[];
  routeEngineeringReviewRequired: boolean;
  passToRouteEngineeringReview: boolean;
  notes: string;
}

export interface PrismObjectEvidenceRequirement {
  objectType: CorridorLensObjectType;
  evidenceRequired: string[];
  requiredTools: ReferenceArchitectureToolType[];
  requiredStandards: string[];
}

export interface PrismObjectPopulationPlan {
  requiredObjects: CorridorLensObjectType[];
  suggestedObjects: CorridorLensObjectType[];
  optionalObjects: CorridorLensObjectType[];
  missingObjects: CorridorLensObjectType[];
  objectEvidenceRequirements: PrismObjectEvidenceRequirement[];
  objectDesignStandards: Record<string, string[]>;
  objectReviewRequirements: Record<string, string[]>;
  providerPriorities: CorridorLensProviderType[];
}

export interface PrismProductPlan {
  productType: PrismProductType;
  commercialModel: string;
  requiredObjects: CorridorLensObjectType[];
  capacityAssumptions: string[];
  termAssumptions: string[];
  revenueEvidenceIds: string[];
  riskNotes: string[];
  routeEngineeringReviewRequired: boolean;
}

export interface PrismRouteEngineeringHandoffDraft {
  candidateId: string;
  corridorId: string;
  lensType?: CorridorLensType;
  networkRole?: CorridorNetworkRole;
  referenceArchitectureId?: string;
  recommendationLevel: PrismRecommendationLevel;
  requiredObjects: CorridorLensObjectType[];
  requiredTools: ReferenceArchitectureToolRequirement[];
  requiredDesignStandards: string[];
  humanReviewBlockers: PrismHumanReviewBlocker[];
  requiredRouteEngineeringReviews: string[];
  evidenceIds: string[];
  notes: string;
  status: "DRAFT_ONLY";
}

export interface PrismRecommendation {
  recommendationId: string;
  candidateId: string;
  corridorId: string;
  recommendationLevel: PrismRecommendationLevel;
  recommendationStrength: PrismRecommendationStrength;
  risk: PrismRecommendationRisk;
  rationale: PrismRecommendationRationale;
  humanReviewGate: PrismHumanReviewGate;
  objectPopulationPlan: PrismObjectPopulationPlan;
  productPlan: PrismProductPlan;
  routeEngineeringHandoffDraft: PrismRouteEngineeringHandoffDraft;
  diagnostics: PrismRecommendationDiagnostic[];
  doctrine: "PRISM_RECOMMENDATION_IS_ADVISORY_ONLY";
  createdAt: string;
}
