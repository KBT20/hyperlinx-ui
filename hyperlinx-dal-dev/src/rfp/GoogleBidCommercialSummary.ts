export interface GoogleBidCommercialSummary {
  totalEstimatedNrc: number;
  totalEstimatedMrc: number;
  totalEstimatedTco: number;
  totalCivilBudgetaryCost: number;
  totalEngineeringPermittingAllowance: number;
  totalProjectManagementAllowance: number;
  totalContingencyAllowance: number;
  reviewStatus: "COMMERCIAL_REVIEW_REQUIRED" | "READY_FOR_CUSTOMER_REVIEW";
  assumptions: string[];
}
