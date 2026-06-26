import type { ItemizedBudget, ItemizedBudgetLine } from "./ItemizedBudget";
import type { BudgetAssumption, BudgetAssumptionCategory, BudgetAssumptionSet } from "./BudgetAssumptionSet";
import type { CostBreakdownCategory } from "./CostBreakdownStructure";
import { CBS_ASSUMPTION_MAPPINGS, cbsMappingForCategory } from "./CostBreakdownStructure";

export interface BudgetAssumptionTrace {
  traceId: string;
  budgetId: string;
  budgetLineId?: string;
  cbsCategory: CostBreakdownCategory;
  assumptionSetId: string;
  assumptionIds: string[];
  contributingQuantities: Array<{
    sourceId: string;
    field: string;
    value: number;
  }>;
  contributingUnitCosts: string[];
  explanation: string;
  confidenceScore: number;
}

function cbsCategoryForLine(line: ItemizedBudgetLine): CostBreakdownCategory {
  if (line.commercialItemId.includes("CONTINGENCY")) return "CONTINGENCY";
  return line.category;
}

export function assumptionsForCategories(assumptionSet: BudgetAssumptionSet, categories: BudgetAssumptionCategory[]) {
  return assumptionSet.assumptions.filter((assumption) => categories.includes(assumption.category));
}

export function assumptionsForCostCategory(assumptionSet: BudgetAssumptionSet, category: CostBreakdownCategory) {
  const mapping = cbsMappingForCategory(category);
  if (!mapping) return [];
  return assumptionsForCategories(assumptionSet, mapping.requiredAssumptionCategories);
}

export function assumptionIdsForCostCategory(assumptionSet: BudgetAssumptionSet, category: CostBreakdownCategory) {
  return assumptionsForCostCategory(assumptionSet, category).map((assumption) => assumption.assumptionId);
}

export function confidenceForAssumptions(assumptions: BudgetAssumption[]) {
  if (!assumptions.length) return 0;
  return Math.round(assumptions.reduce((sum, assumption) => sum + assumption.confidence.score, 0) / assumptions.length);
}

export function traceBudgetLineAssumptions(args: {
  budget: ItemizedBudget;
  line: ItemizedBudgetLine;
  assumptionSet: BudgetAssumptionSet;
}): BudgetAssumptionTrace {
  const category = cbsCategoryForLine(args.line);
  const assumptions = assumptionsForCostCategory(args.assumptionSet, category);
  return {
    traceId: `TRACE-${args.budget.budgetId}-${args.line.budgetLineId}`,
    budgetId: args.budget.budgetId,
    budgetLineId: args.line.budgetLineId,
    cbsCategory: category,
    assumptionSetId: args.assumptionSet.assumptionSetId,
    assumptionIds: assumptions.map((assumption) => assumption.assumptionId),
    contributingQuantities: [{
      sourceId: args.line.sourceQuantity.sourceId,
      field: args.line.sourceQuantity.field,
      value: args.line.sourceQuantity.value,
    }],
    contributingUnitCosts: [args.line.commercialItemId],
    explanation: `${args.line.description} uses ${args.line.sourceQuantity.field}=${args.line.sourceQuantity.value} and ${args.line.commercialItemId}; assumptions: ${assumptions.map((assumption) => assumption.name).join(", ") || "none"}.`,
    confidenceScore: confidenceForAssumptions(assumptions),
  };
}

export function explainBudgetCategory(args: {
  budget: ItemizedBudget;
  assumptionSet: BudgetAssumptionSet;
  category: CostBreakdownCategory;
}): BudgetAssumptionTrace {
  const lines = args.budget.lines.filter((line) => cbsCategoryForLine(line) === args.category || line.category === args.category);
  const assumptions = assumptionsForCostCategory(args.assumptionSet, args.category);
  return {
    traceId: `TRACE-${args.budget.budgetId}-${args.category}`,
    budgetId: args.budget.budgetId,
    cbsCategory: args.category,
    assumptionSetId: args.assumptionSet.assumptionSetId,
    assumptionIds: assumptions.map((assumption) => assumption.assumptionId),
    contributingQuantities: lines.map((line) => ({
      sourceId: line.sourceQuantity.sourceId,
      field: line.sourceQuantity.field,
      value: line.sourceQuantity.value,
    })),
    contributingUnitCosts: [...new Set(lines.map((line) => line.commercialItemId))],
    explanation: `${args.category} is explained by ${lines.length} budget lines, ${assumptions.length} assumptions, source takeoff quantities, and unit-cost library items.`,
    confidenceScore: confidenceForAssumptions(assumptions),
  };
}

export function generateBudgetAssumptionTraces(args: {
  budget: ItemizedBudget;
  assumptionSet: BudgetAssumptionSet;
}) {
  return [
    ...args.budget.lines.map((line) => traceBudgetLineAssumptions({ ...args, line })),
    ...CBS_ASSUMPTION_MAPPINGS.map((mapping) => explainBudgetCategory({
      budget: args.budget,
      assumptionSet: args.assumptionSet,
      category: mapping.cbsCategory,
    })),
  ];
}

