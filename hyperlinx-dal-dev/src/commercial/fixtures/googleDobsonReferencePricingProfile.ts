import type { MarkupPoints } from "../CostPlusPricingModel";
import { ESTIMATOR_DEFAULTS } from "../EstimatorDefaults";
import type { IlaRegenLineItem, IlaRegenPricingProfile } from "../IlaRegenPricing";

function ilaLine(
  profileId: string,
  category: IlaRegenLineItem["category"],
  description: string,
  unitCost: number,
): IlaRegenLineItem {
  return {
    lineItemId: `${profileId}:${description.replaceAll(/[^A-Za-z0-9]+/g, "_")}`,
    category,
    description,
    quantity: 1,
    unit: "ALLOWANCE",
    unitCost,
    extendedCost: unitCost,
    source: "DOBSON_REFERENCE_WORKBOOK",
    referenceDerived: true,
    developmentSeed: true,
    productionApproved: false,
  };
}

export interface HyperscalerReferencePricingProfile {
  profileId: string;
  version: string;
  sourceReferences: string[];
  ospRates: {
    plowLaborPerFoot: number;
    boreLaborPerFoot: number;
    rockAdderPerFoot: number;
    openCutLaborPerFoot: number;
    rockPercentOfBoreFeet: number;
    engineeringPermittingPerFoot: number;
    contingencyPercent: number;
    contingencyReason: string;
    handholeSpacingFeet: number;
    handholeLaborEach: number;
    handholeMaterialEach: number;
    spliceCaseEach: number;
    reelLengthFeet: number;
    buttSpliceUnitRate: number;
    spliceCaseInstallationEach: number;
    vaultSlackFeet: number;
    handholeSlackFeet: number;
    fiberWastePercent: number;
    conduitWastePercent: number;
    innerductWastePercent: number;
    conduitMaterialPerFoot: number;
    innerductFuturePathPerFoot: number;
    fiberMaterialPerFoot: number;
    fiberPlacementLaborPerFoot: number;
    splicingLaborEach: number;
    testingAllowanceEach: number;
    vaultAllowanceEach: number;
    bridgeWaterwayBoreAllowanceEach: number;
    projectManagementPercent: number;
  };
  markup: MarkupPoints;
  selectedIlaProfileId: IlaRegenPricingProfile["profileId"];
  ilaProfiles: IlaRegenPricingProfile[];
  customerNeutral: true;
  referenceDerived: true;
  developmentSeed: true;
  productionApproved: false;
}

const ila18Lines: IlaRegenLineItem[] = [
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_LAND", "Land acquisition", 120000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_LAND", "Survey", 20000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_LAND", "Environmental assessment", 15000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_LAND", "Material testing", 10000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_LAND", "Permit fees / insurance", 20000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Power infrastructure", 105000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Site work", 70000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Foundation", 60000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Prefab building / shelter", 235000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Electrical", 80000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Generator", 55000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "ATS", 22000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "HVAC", 38000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Security / access control", 14000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Landscaping", 7500),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Fire suppression", 12000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "SITE_CONSTRUCTION", "Finalization", 12000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Racks", 36000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Fiber guide", 18000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "FDU", 24000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Batteries", 27000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Rectifiers", 18000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Alarm cabling", 8000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Ironwork", 12000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "DC cable", 15000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Fiber management", 12000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Splice enclosure", 9100),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Installation labor", 17000),
  ilaLine("ILA_18_RACK_SINGLE_WIDE", "TELECOM_FIT_OUT", "Commissioning / testing", 8000),
];

const ila36Lines: IlaRegenLineItem[] = [
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_LAND", "Land acquisition", 150000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_LAND", "Survey", 30000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_LAND", "Environmental assessment", 25000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_LAND", "Material testing", 15000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_LAND", "Permit fees / insurance", 35000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Power infrastructure", 175000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Site work", 110000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Foundation", 95000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Prefab building / shelter", 430000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Electrical", 140000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Generator", 125000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "ATS", 40000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "HVAC", 85000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Security / access control", 30000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Landscaping", 15000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Fire suppression", 35000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "SITE_CONSTRUCTION", "Finalization", 25000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Racks", 72000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Fiber guide", 25000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "FDU", 34000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Batteries", 42000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Rectifiers", 30000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Alarm cabling", 12000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Ironwork", 19000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "DC cable", 22000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Fiber management", 18000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Splice enclosure", 12600),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Installation labor", 18000),
  ilaLine("ILA_36_RACK_DOUBLE_WIDE", "TELECOM_FIT_OUT", "Commissioning / testing", 8000),
];

export const GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE: HyperscalerReferencePricingProfile = {
  profileId: "HYPERSCALER-REFERENCE-GOOGLE-DOBSON-DEV-2026-06",
  version: "DEV-2026-06",
  sourceReferences: [
    "Google Fiber Project - 20251121.xlsx",
    "Dobson ILA Cost Summary 27 vs 36 Racks.xlsx",
    "Google Helium RFP package / RFP response sheet",
  ],
  ospRates: {
    plowLaborPerFoot: 5,
    boreLaborPerFoot: ESTIMATOR_DEFAULTS.construction.baseDirtBorePerFoot,
    rockAdderPerFoot: ESTIMATOR_DEFAULTS.construction.rockAdderPerFoot,
    openCutLaborPerFoot: 38,
    rockPercentOfBoreFeet: ESTIMATOR_DEFAULTS.construction.defaultRockPercentOfDirtBore / 100,
    engineeringPermittingPerFoot: 0.75,
    contingencyPercent: ESTIMATOR_DEFAULTS.commercial.defaultContingencyPercent,
    contingencyReason: "Budgetary hyperscaler proposal; explicit development-seed contingency.",
    handholeSpacingFeet: 2500,
    handholeLaborEach: 315,
    handholeMaterialEach: 900,
    spliceCaseEach: 850,
    reelLengthFeet: ESTIMATOR_DEFAULTS.fiber.reelLengthFeet,
    buttSpliceUnitRate: 35,
    spliceCaseInstallationEach: 315,
    vaultSlackFeet: ESTIMATOR_DEFAULTS.fiber.vaultSlackFeet,
    handholeSlackFeet: ESTIMATOR_DEFAULTS.fiber.handholeSlackFeet,
    fiberWastePercent: ESTIMATOR_DEFAULTS.materials.defaultFiberWastePercent,
    conduitWastePercent: ESTIMATOR_DEFAULTS.materials.defaultConduitWastePercent,
    innerductWastePercent: ESTIMATOR_DEFAULTS.materials.defaultInnerductWastePercent,
    conduitMaterialPerFoot: 2.25,
    innerductFuturePathPerFoot: 0.55,
    fiberMaterialPerFoot: 1.85,
    fiberPlacementLaborPerFoot: 0.7,
    splicingLaborEach: 4200,
    testingAllowanceEach: 1600,
    vaultAllowanceEach: 24500,
    bridgeWaterwayBoreAllowanceEach: 85000,
    projectManagementPercent: 4,
  },
  markup: {
    points: ESTIMATOR_DEFAULTS.commercial.defaultMarkupPoints,
    appliedTo: "BUDGET_COST",
    reason: "Reference cost-plus IRU pricing example; explicit points, not hidden in cost.",
    source: "GOOGLE_DOBSON_REFERENCE",
    developmentSeed: true,
    productionApproved: false,
  },
  selectedIlaProfileId: "ILA_36_RACK_DOUBLE_WIDE",
  ilaProfiles: [
    {
      profileId: "ILA_18_RACK_SINGLE_WIDE",
      label: "18-rack single-wide",
      rackCount: 18,
      buildingType: "Single-wide",
      budgetCost: 1099600,
      referenceMarkupPoints: 20,
      referenceSellPrice: 1319520,
      lineItems: ila18Lines,
    },
    {
      profileId: "ILA_36_RACK_DOUBLE_WIDE",
      label: "36-rack double-wide",
      rackCount: 36,
      buildingType: "Double-wide",
      budgetCost: 1872600,
      referenceMarkupPoints: 20,
      referenceSellPrice: 2247120,
      lineItems: ila36Lines,
    },
  ],
  customerNeutral: true,
  referenceDerived: true,
  developmentSeed: true,
  productionApproved: false,
};
