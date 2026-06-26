import type { CivilMixProfile } from "../CivilMixProfile";

export const googleHeliumBudgetaryCostProfileV1: CivilMixProfile = {
  profileId: "GOOGLE_HELIUM_BUDGETARY_COST_PROFILE_V1",
  name: "Google Helium Budgetary Cost Profile V1",
  customerSegment: "HYPERSCALER",
  unitCosts: [
    { category: "PLOW", unit: "FOOT", unitCost: 18, sourceBasis: "Prior Google Fiber workbook plow labor precedent." },
    { category: "HDD_BORE", unit: "FOOT", unitCost: 68, sourceBasis: "Prior Google Fiber workbook bore labor precedent." },
    { category: "OPEN_TRENCH", unit: "FOOT", unitCost: 42, sourceBasis: "Prior Google Fiber workbook construction precedent." },
    { category: "BRIDGE_ATTACHMENT", unit: "EACH", unitCost: 72000, sourceBasis: "Bridge attachment placeholder pending engineering review." },
    { category: "RAILROAD_CROSSING", unit: "EACH", unitCost: 95000, sourceBasis: "Railroad crossing placeholder pending engineering review." },
    { category: "WATER_CROSSING", unit: "EACH", unitCost: 68000, sourceBasis: "Water crossing placeholder pending engineering review." },
    { category: "URBAN_CONSTRUCTION", unit: "FOOT", unitCost: 58, sourceBasis: "Urban HDD/open trench blended allowance." },
    { category: "UNKNOWN", unit: "ALLOWANCE", unitCost: 15000, sourceBasis: "Unknown constraint allowance pending engineering review." },
  ],
  conduitMaterialCostPerFoot: 2.25,
  fiberMaterialCostPerFoot: 1.85,
  blowFiberLaborCostPerFoot: 0.72,
  handholeVaultFactor: 18500,
  spliceCaseMaterialCost: 1800,
  splicingLaborCost: 4200,
  engineeringPermittingPercent: 0.08,
  projectManagementPercent: 0.06,
  contingencyPercent: 0.12,
  ilaCostProfile: {
    profileId: "DOBSON_GOOGLE_ILA_PRECEDENT",
    name: "Dobson/Google ILA Cost Precedent",
    singleWideCost: 375000,
    doubleWideCost: 575000,
    rackCountAssumption: 36,
    regenSpacingMiles: 60,
    markupPercent: 0.15,
    sourceBasis: "Dobson ILA Cost Summary 27 vs 36 Racks workbook precedent.",
  },
  salesEstimateOnly: true,
  pendingEngineeringVerification: true,
};

export const civilMixProfiles = Object.freeze([googleHeliumBudgetaryCostProfileV1]);
