export interface MarkupPoints {
  points: number;
  appliedTo: "BUDGET_COST";
  reason: string;
  source: "GOOGLE_DOBSON_REFERENCE" | "COMMERCIAL_REVIEW" | "DEVELOPMENT_SEED";
  developmentSeed: true;
  productionApproved: false;
}

export interface CostPlusPricingModel {
  budgetCost: number;
  markup: MarkupPoints;
  markupAmount: number;
  sellPrice: number;
  currency: "USD";
  traceability: string[];
}

export function applyCostPlusPricing(args: {
  budgetCost: number;
  markup: MarkupPoints;
  traceability: string[];
}): CostPlusPricingModel {
  const markupAmount = Math.round(args.budgetCost * (args.markup.points / 100));
  return {
    budgetCost: Math.round(args.budgetCost),
    markup: args.markup,
    markupAmount,
    sellPrice: Math.round(args.budgetCost + markupAmount),
    currency: "USD",
    traceability: [
      ...args.traceability,
      `MarkupPoints:${args.markup.points}`,
      "CostPlusPricingModel.sellPrice",
    ],
  };
}
