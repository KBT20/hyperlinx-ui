export type CivilMixCategory =
  | "PLOW"
  | "HDD_BORE"
  | "OPEN_TRENCH"
  | "BRIDGE_ATTACHMENT"
  | "RAILROAD_CROSSING"
  | "WATER_CROSSING"
  | "URBAN_CONSTRUCTION"
  | "UNKNOWN";

export interface CivilMixUnitCost {
  category: CivilMixCategory;
  unit: "FOOT" | "EACH" | "ALLOWANCE";
  unitCost: number;
  sourceBasis: string;
}

export interface IlaCostProfile {
  profileId: string;
  name: string;
  singleWideCost: number;
  doubleWideCost: number;
  rackCountAssumption: number;
  regenSpacingMiles: number;
  markupPercent: number;
  sourceBasis: string;
}

export interface CivilMixProfile {
  profileId: string;
  name: string;
  customerSegment: "HYPERSCALER" | "CARRIER" | "ENTERPRISE" | "UTILITY";
  unitCosts: CivilMixUnitCost[];
  conduitMaterialCostPerFoot: number;
  fiberMaterialCostPerFoot: number;
  blowFiberLaborCostPerFoot: number;
  handholeVaultFactor: number;
  spliceCaseMaterialCost: number;
  splicingLaborCost: number;
  engineeringPermittingPercent: number;
  projectManagementPercent: number;
  contingencyPercent: number;
  ilaCostProfile?: IlaCostProfile;
  salesEstimateOnly: true;
  pendingEngineeringVerification: true;
}
