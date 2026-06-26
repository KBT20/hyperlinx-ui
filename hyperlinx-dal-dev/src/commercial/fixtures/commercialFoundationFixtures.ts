import { googleTexasAiProposedGraphFixture } from "../../proposedGraph/ProposedGraphFixtures";
import { generateBudgetAssumptionTraces } from "../BudgetAssumptionEngine";
import { createItemizedBudgetFromGraph } from "../CommercialFoundationEngine";
import { COMMERCIAL_ITEM_CATALOG } from "../CommercialItemCatalog";
import { COMMERCIAL_QUANTITY_MAPPINGS } from "../CommercialQuantityMapping";
import { UNIT_COST_LIBRARY } from "../UnitCostLibrary";
import { DEFAULT_BUDGET_ASSUMPTION_SET } from "./budgetAssumptionFixtures";

const itemizedBudget = googleTexasAiProposedGraphFixture.proposedGraph
  ? createItemizedBudgetFromGraph(googleTexasAiProposedGraphFixture.proposedGraph)
  : null;

export const commercialFoundationFixture = Object.freeze({
  fixtureId: "COMMERCIAL-FOUNDATION-GOOGLE-TEXAS-AI",
  label: "Google Texas AI Expansion commercial foundation fixture",
  catalogItemCount: COMMERCIAL_ITEM_CATALOG.length,
  unitCostCount: UNIT_COST_LIBRARY.length,
  quantityMappingCount: COMMERCIAL_QUANTITY_MAPPINGS.length,
  assumptionSet: DEFAULT_BUDGET_ASSUMPTION_SET,
  assumptionTraceCount: itemizedBudget
    ? generateBudgetAssumptionTraces({
        budget: itemizedBudget,
        assumptionSet: DEFAULT_BUDGET_ASSUMPTION_SET,
      }).length
    : 0,
  itemizedBudget,
  noProductionPricing: true,
  noBudgetLock: true,
});
