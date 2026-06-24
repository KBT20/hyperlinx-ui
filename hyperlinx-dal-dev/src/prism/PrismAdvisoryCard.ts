export type PrismAdvisoryCategory =
  | "ROUTE_OPPORTUNITY"
  | "FACILITY_OPPORTUNITY"
  | "MARKETPLACE_MATCH"
  | "COST_REDUCTION"
  | "DIVERSITY_IMPROVEMENT"
  | "CAPACITY_IMPROVEMENT"
  | "POWER_OPPORTUNITY"
  | "GPU_OPPORTUNITY"
  | "LAND_OPPORTUNITY"
  | "RISK_ALERT";

export type PrismRiskCategory =
  | "DIVERSITY_RISK"
  | "COST_RISK"
  | "CAPACITY_RISK"
  | "POWER_RISK"
  | "FACILITY_RISK"
  | "CONSTRUCTION_RISK"
  | "RIGHT_OF_WAY_RISK"
  | "MARKETPLACE_RISK";

export interface PrismAdvisoryCard {
  cardId: string;
  category: PrismAdvisoryCategory;
  title: string;
  summary: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  impactScore: number;
  evidenceIds: string[];
  advisoryOnly: true;
}

export interface PrismOpportunity {
  opportunityId: string;
  opportunityType: PrismAdvisoryCategory;
  title: string;
  summary: string;
  source: "BASELINE" | "MARKETPLACE" | "SCOPE_REVIEW" | "PRISM_FIXTURE";
  evidenceIds: string[];
}

export interface PrismRisk {
  riskId: string;
  riskCategory: PrismRiskCategory;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  mitigation: string;
  evidenceIds: string[];
}

export interface PrismRecommendation {
  recommendationId: string;
  recommendationType: PrismAdvisoryCategory;
  title: string;
  rationale: string;
  expectedBenefit: string;
  humanDecisionRequired: true;
  advisoryOnly: true;
}
