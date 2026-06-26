export type OspSegmentPricingLineCategory =
  | "PLOW_LABOR"
  | "BORE_LABOR"
  | "ROCK_ADDER"
  | "OPEN_CUT_LABOR"
  | "BRIDGE_WATERWAY_ALLOWANCE"
  | "CONDUIT_MATERIAL"
  | "INNERDUCT_FUTUREPATH"
  | "FIBER_MATERIAL"
  | "FIBER_PLACEMENT_LABOR"
  | "HANDHOLE_LABOR"
  | "HANDHOLE_MATERIAL"
  | "VAULT_ALLOWANCE"
  | "SPLICE_CASE"
  | "SPLICING_LABOR"
  | "ENGINEERING_PERMITTING"
  | "PROJECT_MANAGEMENT"
  | "CONTINGENCY";

export type HyperscalerPricingUnit = "FOOT" | "EACH" | "ALLOWANCE" | "PERCENT";

export interface OspSegmentPricingLine {
  lineId: string;
  category: OspSegmentPricingLineCategory;
  description: string;
  quantity: number;
  unit: HyperscalerPricingUnit;
  unitRate: number;
  extendedCost: number;
  sourceQuantity: string;
  costBasis: string;
  assumption: string;
  referenceDerived: true;
  developmentSeed: true;
  productionApproved: false;
}

export interface OspSegmentContingency {
  percentage: number;
  appliedTo: "SEGMENT_SUBTOTAL";
  reason: string;
  amount: number;
}

export interface OspSegmentPricing {
  segmentId: string;
  segmentName: string;
  aLocation: string;
  zLocation: string;
  routeMiles: number;
  totalRouteFeet: number;
  borePercentage: number;
  plowPercentage: number;
  openCutPercentage: number;
  rockBorePercentage: number;
  dirtBorePercentage: number;
  boreFeet: number;
  dirtOnlyBoreFeet: number;
  rockBoreFeet: number;
  plowFeet: number;
  openCutFeet: number;
  baseBoreCost: number;
  rockAdderCost: number;
  totalRockBoreCost: number;
  totalDirtBoreCost: number;
  lineItems: OspSegmentPricingLine[];
  segmentSubtotal: number;
  contingency: OspSegmentContingency | null;
  segmentTotal: number;
  costPerFoot: number;
  costPerMile: number;
  diagnostics: string[];
}
