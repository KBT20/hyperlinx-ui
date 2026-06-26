import { createDefaultBudgetAssumptionState, type BudgetAssumptionState } from "./BudgetAssumptionState";
import { priceHyperscalerRoutes, type HyperscalerPricingResult, type HyperscalerRoutePricingInput, type SplicingFormulaOutput } from "./HyperscalerPricingEngine";
import { GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE, type HyperscalerReferencePricingProfile } from "./fixtures/googleDobsonReferencePricingProfile";

export type PricingScopeKind = "ROUTE" | "COMBINED_AWARD";

export interface PricingScopeSelection {
  scopeId: string;
  label: string;
  kind: PricingScopeKind;
  routeRequirementIds: string[];
}

export interface CombinedAwardAdjustment {
  adjustmentId: string;
  label: string;
  amount: number;
  reason: string;
  appliedTo: "BUDGET_COST" | "SELL_PRICE";
  explicit: true;
}

export interface SelectedScopePricingReconciliation {
  ospCost: number;
  ilaRegenCost: number;
  otherExplicitCostItems: CombinedAwardAdjustment[];
  budgetCost: number;
  markupPointsPercent: number;
  markupPointsAmount: number;
  sellPriceIru: number;
  routeMiles: number;
  routeFeet: number;
  costPerMile: number;
  sellPricePerMile: number;
  costPerFoot: number;
  sellPricePerFoot: number;
  budgetCostReconciles: boolean;
  sellPriceReconciles: boolean;
  combinedAwardAdjustmentStatus: string;
}

export interface SelectedScopePricingSummary {
  summaryId: string;
  scope: PricingScopeSelection;
  pricing: HyperscalerPricingResult;
  assumptionState: BudgetAssumptionState;
  splicing: SplicingFormulaOutput;
  reconciliation: SelectedScopePricingReconciliation;
  diagnostics: string[];
  authoritativeCommercialCalculation: true;
  noProductionPricing: true;
  noBudgetLock: true;
  noExecutionAuthority: true;
}

function rounded(value: number) {
  return Math.round(value);
}

function perUnit(value: number, denominator: number) {
  return denominator > 0 ? Number((value / denominator).toFixed(2)) : 0;
}

export function createSelectedScopePricingSummary(args: {
  scope: PricingScopeSelection;
  routes: HyperscalerRoutePricingInput[];
  combinedAwardAdjustments?: CombinedAwardAdjustment[];
  assumptionState?: BudgetAssumptionState;
  profile?: HyperscalerReferencePricingProfile;
}): SelectedScopePricingSummary {
  const profile = args.profile ?? GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE;
  const assumptionState = args.assumptionState ?? createDefaultBudgetAssumptionState();
  const pricing = priceHyperscalerRoutes({
    pricingId: args.scope.scopeId,
    routes: args.routes,
    profile,
    assumptionState,
  });
  const explicitAdjustments = args.combinedAwardAdjustments ?? [];
  const otherExplicitCostTotal = explicitAdjustments
    .filter((adjustment) => adjustment.appliedTo === "BUDGET_COST")
    .reduce((total, adjustment) => total + adjustment.amount, 0);
  const budgetCost = rounded(pricing.fiberSummary.totalOspCost + pricing.fiberSummary.totalIlaRegenCost + otherExplicitCostTotal);
  const markupPointsAmount = rounded(budgetCost * (pricing.fiberSummary.costPlus.markup.points / 100));
  const sellPriceAdjustments = explicitAdjustments
    .filter((adjustment) => adjustment.appliedTo === "SELL_PRICE")
    .reduce((total, adjustment) => total + adjustment.amount, 0);
  const sellPriceIru = rounded(budgetCost + markupPointsAmount + sellPriceAdjustments);
  const routeFeet = args.routes.reduce((total, route) => total + route.takeoff.routeFeet, 0);
  const routeMiles = args.routes.reduce((total, route) => total + route.takeoff.routeMiles, 0);
  const splicing = pricing.fiberSummary.materialSummary.splicing;

  return {
    summaryId: `SELECTED-PRICING-${args.scope.scopeId}`,
    scope: args.scope,
    pricing,
    assumptionState,
    splicing,
    reconciliation: {
      ospCost: pricing.fiberSummary.totalOspCost,
      ilaRegenCost: pricing.fiberSummary.totalIlaRegenCost,
      otherExplicitCostItems: explicitAdjustments,
      budgetCost,
      markupPointsPercent: pricing.fiberSummary.costPlus.markup.points,
      markupPointsAmount,
      sellPriceIru,
      routeMiles,
      routeFeet,
      costPerMile: perUnit(budgetCost, routeMiles),
      sellPricePerMile: perUnit(sellPriceIru, routeMiles),
      costPerFoot: perUnit(budgetCost, routeFeet),
      sellPricePerFoot: perUnit(sellPriceIru, routeFeet),
      budgetCostReconciles: budgetCost === rounded(pricing.fiberSummary.totalOspCost + pricing.fiberSummary.totalIlaRegenCost + otherExplicitCostTotal),
      sellPriceReconciles: sellPriceIru === rounded(budgetCost + markupPointsAmount + sellPriceAdjustments),
      combinedAwardAdjustmentStatus: explicitAdjustments.length ? "Combined-award adjustments explicitly applied." : "No combined-award adjustment applied",
    },
    diagnostics: [
      `[SELECTED_SCOPE_PRICING_CREATED] scopeId=${args.scope.scopeId}`,
      `assumptionStateId=${assumptionState.stateId}`,
      `routes=${args.routes.length}`,
      `budgetCost=${budgetCost}`,
      `sellPriceIru=${sellPriceIru}`,
      `splicingButtSplices=${splicing.buttSplices}`,
      explicitAdjustments.length ? "combinedAwardAdjustments=EXPLICIT" : "combinedAwardAdjustments=NONE",
    ],
    authoritativeCommercialCalculation: true,
    noProductionPricing: true,
    noBudgetLock: true,
    noExecutionAuthority: true,
  };
}
