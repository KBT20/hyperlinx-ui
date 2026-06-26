import type { CivilMixCategory } from "./CivilMixProfile";

export interface CivilMixLineItem {
  lineItemId: string;
  category: CivilMixCategory;
  feet: number;
  count: number;
  unitCost: number;
  estimatedCost: number;
  basis: string;
  verificationStatus: "PENDING_ENGINEERING_VERIFICATION";
}

export interface CivilMixEstimate {
  civilMixEstimateId: string;
  routeRequirementId: string;
  stationedCorridorId: string;
  totalFeet: number;
  totalMiles: number;
  lineItems: CivilMixLineItem[];
  estimatedCivilCost: number;
  engineeringPermittingAllowance: number;
  projectManagementAllowance: number;
  contingencyAllowance: number;
  totalBudgetaryCost: number;
  status: "SALES_ESTIMATE";
  verificationStatus: "PENDING_ENGINEERING_VERIFICATION";
  assumptions: string[];
  diagnostics: string[];
}
