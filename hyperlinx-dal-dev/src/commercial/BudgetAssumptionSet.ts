import type { CommercialCategory } from "./CommercialItemCatalog";

export type BudgetAssumptionSetStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED" | "ARCHIVED";

export type BudgetAssumptionSetSource =
  | "COMMERCIAL_FOUNDATION"
  | "CUSTOMER_REFERENCE_FIXTURE"
  | "ENGINEERING_PRECEDENT"
  | "HUMAN_ESTIMATOR"
  | "UNKNOWN";

export type BudgetAssumptionCategory =
  | "CORRIDOR"
  | "CORRIDOR_CONFIDENCE"
  | "ROUTE_MATURITY"
  | "EXISTING_INFRASTRUCTURE"
  | "EXISTING_UTILITY"
  | "CIVIL"
  | "ENGINEERING"
  | "COMMERCIAL"
  | "CONSTRUCTION"
  | "CUSTOMER"
  | "RISK";

export type BudgetAssumptionConfidenceLevel = "ESTIMATED" | "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
export type BudgetAssumptionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface BudgetAssumptionConfidence {
  level: BudgetAssumptionConfidenceLevel;
  score: number;
  rationale: string;
}

export interface BudgetAssumption {
  assumptionId: string;
  category: BudgetAssumptionCategory;
  name: string;
  description: string;
  value: string | number | boolean;
  unit: string;
  reason: string;
  source: BudgetAssumptionSetSource;
  confidence: BudgetAssumptionConfidence;
  risk: BudgetAssumptionRiskLevel;
  affectedCostCategories: CommercialCategory[];
  customerNeutral: boolean;
  notes?: string;
}

export interface BudgetAssumptionSet {
  assumptionSetId: string;
  name: string;
  version: string;
  status: BudgetAssumptionSetStatus;
  source: BudgetAssumptionSetSource;
  createdBy: string;
  createdDate: string;
  confidence: BudgetAssumptionConfidence;
  notes: string[];
  assumptions: BudgetAssumption[];
  googleReferenceFixture?: true;
  noProductionPricing: true;
  noBudgetLock: true;
}

export function assumptionSetConfidence(assumptions: BudgetAssumption[]): BudgetAssumptionConfidence {
  if (!assumptions.length) {
    return {
      level: "LOW",
      score: 0,
      rationale: "No assumptions are available.",
    };
  }
  const score = Math.round(assumptions.reduce((sum, assumption) => sum + assumption.confidence.score, 0) / assumptions.length);
  const level: BudgetAssumptionConfidenceLevel =
    score >= 90 ? "VERIFIED" :
    score >= 75 ? "HIGH" :
    score >= 55 ? "MEDIUM" :
    score >= 35 ? "LOW" :
    "ESTIMATED";
  return {
    level,
    score,
    rationale: "Assumption set confidence is the average of contained assumption confidence scores.",
  };
}

