import type { StationedCorridor } from "../corridor/StationedCorridor";
import type { CivilMixEstimate, CivilMixLineItem } from "./CivilMixEstimate";
import type { CivilMixCategory, CivilMixProfile } from "./CivilMixProfile";

function unitCost(profile: CivilMixProfile, category: CivilMixCategory) {
  return profile.unitCosts.find((item) => item.category === category)?.unitCost ?? 0;
}

function lineItem(args: {
  estimateId: string;
  category: CivilMixCategory;
  feet?: number;
  count?: number;
  unitCost: number;
  basis: string;
}): CivilMixLineItem {
  const feet = Math.round(args.feet ?? 0);
  const count = Math.round(args.count ?? 0);
  const quantity = feet || count || 1;
  return {
    lineItemId: `${args.estimateId}:${args.category}`,
    category: args.category,
    feet,
    count,
    unitCost: args.unitCost,
    estimatedCost: Math.round(quantity * args.unitCost),
    basis: args.basis,
    verificationStatus: "PENDING_ENGINEERING_VERIFICATION",
  };
}

export function estimateCivilMixFromCorridor(args: {
  routeRequirementId: string;
  stationedCorridor: StationedCorridor;
  profile: CivilMixProfile;
}): CivilMixEstimate {
  const { routeRequirementId, stationedCorridor, profile } = args;
  const takeoff = stationedCorridor.takeoff;
  const estimateId = `CIVIL-${routeRequirementId}`;
  const crossingFeet = Math.min(takeoff.routeFeet, takeoff.roadCrossingCount * 240 + takeoff.railCrossingCount * 400 + takeoff.waterCrossingCount * 500);
  const bridgeAttachmentCount = takeoff.bridgeCrossingCount;
  const hddFeet = Math.round(crossingFeet + takeoff.unknownConstraintCount * 250);
  const urbanFeet = Math.round(takeoff.routeFeet * 0.08);
  const openTrenchFeet = Math.round(takeoff.routeFeet * 0.06);
  const plowFeet = Math.max(0, takeoff.routeFeet - hddFeet - urbanFeet - openTrenchFeet);
  const lineItems = [
    lineItem({ estimateId, category: "PLOW", feet: plowFeet, unitCost: unitCost(profile, "PLOW"), basis: "Rural centerline segments bias toward plow." }),
    lineItem({ estimateId, category: "HDD_BORE", feet: hddFeet, unitCost: unitCost(profile, "HDD_BORE"), basis: "Road, rail, water, and unknown constraints bias toward HDD." }),
    lineItem({ estimateId, category: "OPEN_TRENCH", feet: openTrenchFeet, unitCost: unitCost(profile, "OPEN_TRENCH"), basis: "Sales allowance for open trench segments." }),
    lineItem({ estimateId, category: "URBAN_CONSTRUCTION", feet: urbanFeet, unitCost: unitCost(profile, "URBAN_CONSTRUCTION"), basis: "Urban segments bias toward HDD/open trench." }),
    lineItem({ estimateId, category: "BRIDGE_ATTACHMENT", count: bridgeAttachmentCount, unitCost: unitCost(profile, "BRIDGE_ATTACHMENT"), basis: "Bridge crossings require engineering review." }),
    lineItem({ estimateId, category: "RAILROAD_CROSSING", count: takeoff.railCrossingCount, unitCost: unitCost(profile, "RAILROAD_CROSSING"), basis: "Railroad crossings require permit and method verification." }),
    lineItem({ estimateId, category: "WATER_CROSSING", count: takeoff.waterCrossingCount, unitCost: unitCost(profile, "WATER_CROSSING"), basis: "Water crossings require engineered crossing review." }),
    lineItem({ estimateId, category: "UNKNOWN", count: takeoff.unknownConstraintCount, unitCost: unitCost(profile, "UNKNOWN"), basis: "Unknown constraints remain pending engineering verification." }),
  ];
  const directCivilCost = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  const materialCost = Math.round(takeoff.ductFeet * profile.conduitMaterialCostPerFoot + takeoff.fiberFeet * (profile.fiberMaterialCostPerFoot + profile.blowFiberLaborCostPerFoot));
  const objectCost = Math.round((takeoff.vaultCount + takeoff.handholeCount) * profile.handholeVaultFactor + takeoff.splicePointCount * (profile.spliceCaseMaterialCost + profile.splicingLaborCost));
  const estimatedCivilCost = directCivilCost + materialCost + objectCost;
  const engineeringPermittingAllowance = Math.round(estimatedCivilCost * profile.engineeringPermittingPercent);
  const projectManagementAllowance = Math.round(estimatedCivilCost * profile.projectManagementPercent);
  const contingencyAllowance = Math.round((estimatedCivilCost + engineeringPermittingAllowance + projectManagementAllowance) * profile.contingencyPercent);
  return {
    civilMixEstimateId: estimateId,
    routeRequirementId,
    stationedCorridorId: stationedCorridor.stationedCorridorId,
    totalFeet: takeoff.routeFeet,
    totalMiles: takeoff.routeMiles,
    lineItems,
    estimatedCivilCost,
    engineeringPermittingAllowance,
    projectManagementAllowance,
    contingencyAllowance,
    totalBudgetaryCost: estimatedCivilCost + engineeringPermittingAllowance + projectManagementAllowance + contingencyAllowance,
    status: "SALES_ESTIMATE",
    verificationStatus: "PENDING_ENGINEERING_VERIFICATION",
    assumptions: [
      "Civil mix is budgetary and pending Route Engineering verification.",
      "Rural long-haul centerline segments bias toward plow.",
      "Crossings and unknown constraints bias toward HDD or engineered crossing allowance.",
      "Prior Google Fiber and Dobson/Google ILA workbooks inform unit-cost precedent only.",
    ],
    diagnostics: [
      `profile=${profile.profileId}`,
      `plowFeet=${plowFeet}`,
      `hddFeet=${hddFeet}`,
      `openTrenchFeet=${openTrenchFeet}`,
      `urbanFeet=${urbanFeet}`,
    ],
  };
}
