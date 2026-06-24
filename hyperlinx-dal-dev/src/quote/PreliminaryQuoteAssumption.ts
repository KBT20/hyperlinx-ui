export type PreliminaryQuoteAssumptionCategory =
  | "NETWORK"
  | "MARKETPLACE"
  | "ENGINEERING"
  | "COMMERCIAL"
  | "RISK"
  | "CUSTOMER";

export interface PreliminaryQuoteAssumption {
  assumptionId: string;
  category: PreliminaryQuoteAssumptionCategory;
  statement: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceIds: string[];
  requiresValidation: boolean;
  advisoryOnly: true;
}
