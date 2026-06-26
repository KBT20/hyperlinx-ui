import type { CostPlusPricingModel } from "./CostPlusPricingModel";
import type { SplicingFormulaOutput } from "./HyperscalerPricingEngine";

export interface FiberMaterialQuantitySummary {
  routeFiberFeet: number;
  vaultSlackFeet: number;
  handholeSlackFeet: number;
  wasteFeet: number;
  purchasedFiberFeet: number;
  installedFiberFeet: number;
  wastePercent: number;
}

export interface ConduitMaterialQuantitySummary {
  routeConduitFeet: number;
  standardDuctPackageConduitCount: number;
  standardDuctPackageFeet: number;
  vaultSlackFeet: number;
  wasteFeet: number;
  installedConduitFeet: number;
  wastePercent: number;
}

export interface InnerductMaterialQuantitySummary {
  enabled: boolean;
  routeInnerductFeet: number;
  wasteFeet: number;
  installedInnerductFeet: number;
  wastePercent: number;
}

export interface MaterialQuantitySummary {
  fiber: FiberMaterialQuantitySummary;
  conduit: ConduitMaterialQuantitySummary;
  innerduct: InnerductMaterialQuantitySummary;
  splicing: SplicingFormulaOutput & {
    spliceCases: number;
    spliceCaseMaterialCost: number;
    spliceCaseInstallationCost: number;
  };
}

export interface FiberRoutePricingSummary {
  pricingSummaryId: string;
  totalRouteMiles: number;
  totalRouteFeet: number;
  fiberCount: number;
  fiberMaterialCost: number;
  conduitMaterialCost: number;
  innerductFuturePathCost: number;
  placementLaborCost: number;
  splicingCost: number;
  testingCost: number;
  totalOspCost: number;
  totalIlaRegenCost: number;
  totalBudgetCost: number;
  costPlus: CostPlusPricingModel;
  averageCostPerRouteMile: number;
  averageSellPricePerRouteMile: number;
  averageCostPerFoot: number;
  averageSellPricePerFoot: number;
  materialSummary: MaterialQuantitySummary;
  validationReference: {
    totalRouteMiles: 445.1;
    estimatedCost: 67140000;
    iruPrice: 80570000;
    averageSellPerRouteMile: 181005;
    averageSellPerFoot: 34.28;
    referenceOnly: true;
  };
  noProductionPricing: true;
  noBudgetLock: true;
  noExecutionAuthority: true;
}
