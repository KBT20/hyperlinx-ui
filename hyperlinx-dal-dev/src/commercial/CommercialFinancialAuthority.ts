import type { TransparentCorridorEstimate } from "./TransparentEstimatingEngine";

export interface CommercialFinancialAuthority {
  constructionCost: number;
  sellPrice: number;
  grossMarginDollars: number;
  grossMarginPercent: number;
  nrcRevenue: number;
  mrcRevenue: number;
  lifecycleRevenue: number;
  revenuePerMile: number;
  costPerMile: number;
  marginPerMile: number;
  costPerFoot: number;
  sellPerFoot: number;
  revenuePerFoot: number;
  lifecycleMonths: number;
  validationWarnings: string[];
}

const COST_PER_MILE_MIN = 20_000;
const COST_PER_MILE_MAX = 750_000;
const TARGET_MARGIN_MIN = 8;
const TARGET_MARGIN_MAX = 65;
const DEFAULT_LIFECYCLE_MONTHS = 36;

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function safeUnit(value: number, denominator: number, places = 2) {
  return denominator > 0 ? round(value / denominator, places) : 0;
}

export function buildCommercialFinancialAuthority(args: {
  constructionCost: number;
  sellPrice: number;
  routeMiles: number;
  routeFeet: number;
  transparentEstimate?: TransparentCorridorEstimate;
  lifecycleMonths?: number;
}): CommercialFinancialAuthority {
  const constructionCost = Math.round(args.constructionCost);
  const sellPrice = Math.round(args.sellPrice);
  const nrcRevenue = Math.round(args.transparentEstimate?.nrc ?? sellPrice);
  const mrcRevenue = Math.round(args.transparentEstimate?.mrc ?? 0);
  const lifecycleMonths = args.lifecycleMonths ?? DEFAULT_LIFECYCLE_MONTHS;
  const lifecycleRevenue = Math.round(nrcRevenue + mrcRevenue * lifecycleMonths);
  const grossMarginDollars = Math.round(sellPrice - constructionCost);
  const grossMarginPercent = sellPrice > 0 ? round((grossMarginDollars / sellPrice) * 100, 1) : 0;
  const costPerMile = safeUnit(constructionCost, args.routeMiles, 0);
  const revenuePerMile = safeUnit(nrcRevenue, args.routeMiles, 0);
  const marginPerMile = safeUnit(grossMarginDollars, args.routeMiles, 0);
  const costPerFoot = safeUnit(constructionCost, args.routeFeet);
  const sellPerFoot = safeUnit(sellPrice, args.routeFeet);
  const revenuePerFoot = safeUnit(nrcRevenue, args.routeFeet);
  const validationWarnings: string[] = [];

  if (costPerMile > 0 && (costPerMile < COST_PER_MILE_MIN || costPerMile > COST_PER_MILE_MAX)) {
    validationWarnings.push(`Cost/Mile ${costPerMile.toLocaleString()} is outside configured range ${COST_PER_MILE_MIN.toLocaleString()}-${COST_PER_MILE_MAX.toLocaleString()}.`);
  }
  if (grossMarginPercent < TARGET_MARGIN_MIN || grossMarginPercent > TARGET_MARGIN_MAX) {
    validationWarnings.push(`Gross Margin ${grossMarginPercent}% is outside target range ${TARGET_MARGIN_MIN}-${TARGET_MARGIN_MAX}%.`);
  }
  if (grossMarginPercent > 100) {
    validationWarnings.push("Gross Margin cannot exceed 100%.");
  }
  if (nrcRevenue !== sellPrice) {
    validationWarnings.push("NRC Revenue does not match the selected Sell Price model.");
  }
  if (nrcRevenue === constructionCost + sellPrice) {
    validationWarnings.push("Revenue is inconsistent: NRC Revenue must never equal Construction Cost + Sell Price.");
  }
  if (!args.transparentEstimate?.controls) {
    validationWarnings.push("Production and financial assumptions are missing from the Transparent Estimating Engine controls.");
  }
  const unknownCount = args.transparentEstimate?.unknownQuantities.length ?? 0;
  if (unknownCount > 0) {
    validationWarnings.push(`${unknownCount.toLocaleString()} unknown constraint value(s) reduce confidence but do not fabricate cost.`);
  }

  return {
    constructionCost,
    sellPrice,
    grossMarginDollars,
    grossMarginPercent,
    nrcRevenue,
    mrcRevenue,
    lifecycleRevenue,
    revenuePerMile,
    costPerMile,
    marginPerMile,
    costPerFoot,
    sellPerFoot,
    revenuePerFoot,
    lifecycleMonths,
    validationWarnings,
  };
}
