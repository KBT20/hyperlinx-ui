import type { CorridorTakeoff } from "../corridor/CorridorTakeoff";
import type { ProposedGraph } from "../proposedGraph/ProposedGraph";
import type { BudgetAssumptionSet } from "./BudgetAssumptionSet";
import { assumptionIdsForCostCategory } from "./BudgetAssumptionEngine";
import { findCommercialItem } from "./CommercialItemCatalog";
import type { CommercialUnit } from "./CommercialItemCatalog";
import type { CostBreakdownCategory } from "./CostBreakdownStructure";
import type { ItemizedBudget, ItemizedBudgetLine } from "./ItemizedBudget";
import { UNIT_COST_LIBRARY_VERSION, findUnitCost } from "./UnitCostLibrary";
import { DEFAULT_BUDGET_ASSUMPTION_SET } from "./fixtures/budgetAssumptionFixtures";

type LineInput = {
  proposalId: string;
  itemId: string;
  quantity: number;
  sourceType?: ItemizedBudgetLine["sourceQuantity"]["sourceType"];
  sourceField: string;
  sourceId: string;
  sourceCorridor: ItemizedBudgetLine["sourceCorridor"];
  assumptionSet: BudgetAssumptionSet;
  unitOverride?: CommercialUnit;
  unitCostOverride?: number;
};

function roundMoney(value: number) {
  return Math.round(value);
}

function safeQuantity(value: number) {
  return Number.isFinite(value) ? Math.max(0, Number(value.toFixed(2))) : 0;
}

function crossingCount(takeoff: CorridorTakeoff) {
  return takeoff.roadCrossingCount + takeoff.railCrossingCount + takeoff.waterCrossingCount + takeoff.bridgeCrossingCount + takeoff.unknownConstraintCount;
}

function derivedCivilQuantities(takeoff: CorridorTakeoff) {
  const crossingFeet = Math.min(takeoff.routeFeet, takeoff.roadCrossingCount * 240 + takeoff.railCrossingCount * 400 + takeoff.waterCrossingCount * 500);
  const hddFeet = Math.round(crossingFeet + takeoff.unknownConstraintCount * 250);
  const urbanFeet = Math.round(takeoff.routeFeet * 0.08);
  const openTrenchFeet = Math.round(takeoff.routeFeet * 0.06);
  const plowFeet = Math.max(0, takeoff.routeFeet - hddFeet - urbanFeet - openTrenchFeet);
  return { crossingFeet, hddFeet, urbanFeet, openTrenchFeet, plowFeet };
}

function budgetLine(args: LineInput): ItemizedBudgetLine | null {
  const item = findCommercialItem(args.itemId);
  const cost = findUnitCost(args.itemId);
  if (!item || !cost || args.quantity <= 0) return null;
  const unit = args.unitOverride ?? item.unit;
  const unitCost = args.unitCostOverride ?? cost.unitCost;
  const quantity = safeQuantity(args.quantity);
  const extendedCost = roundMoney(quantity * unitCost);
  const cbsCategory: CostBreakdownCategory = args.itemId.includes("CONTINGENCY") ? "CONTINGENCY" : item.category;
  return {
    budgetLineId: `${args.proposalId}:${args.itemId}:${args.sourceField}`,
    commercialItemId: args.itemId,
    description: item.description,
    category: item.category,
    assumptionSetId: args.assumptionSet.assumptionSetId,
    assumptionIds: assumptionIdsForCostCategory(args.assumptionSet, cbsCategory),
    quantity,
    unit,
    unitCost,
    extendedCost,
    sourceQuantity: {
      sourceType: args.sourceType ?? "CorridorTakeoff",
      sourceId: args.sourceId,
      field: args.sourceField,
      value: quantity,
    },
    sourceCorridor: args.sourceCorridor,
    confidence: cost.confidence,
    overrideFlag: false,
    traceability: [
      "Corridor",
      "Takeoff",
      "CostBreakdownStructure",
      cbsCategory,
      args.assumptionSet.assumptionSetId,
      item.itemId,
      UNIT_COST_LIBRARY_VERSION,
      "BudgetLine",
      "ItemizedBudget",
      "Proposal",
    ],
  };
}

function categoryTotal(lines: ItemizedBudgetLine[], category: ItemizedBudgetLine["category"]) {
  return lines.filter((line) => line.category === category).reduce((sum, line) => sum + line.extendedCost, 0);
}

export function createItemizedBudgetFromTakeoff(args: {
  proposalId: string;
  takeoff: CorridorTakeoff;
  assumptionSet?: BudgetAssumptionSet;
  markupPercent?: number;
}): ItemizedBudget {
  const { proposalId, takeoff } = args;
  const assumptionSet = args.assumptionSet ?? DEFAULT_BUDGET_ASSUMPTION_SET;
  const sourceCorridor = {
    centerlineRouteId: takeoff.centerlineRouteId,
    stationedCorridorId: takeoff.stationedCorridorId,
    takeoffId: takeoff.takeoffId,
  };
  const sourceId = takeoff.takeoffId;
  const civil = derivedCivilQuantities(takeoff);
  const candidateLines = [
    budgetLine({ proposalId, itemId: "COMM-ENG-SURVEY-MILE", quantity: takeoff.routeMiles, sourceField: "routeMiles", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-ENG-DESIGN-MILE", quantity: takeoff.routeMiles, sourceField: "routeMiles", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-ENG-PERMIT-EACH", quantity: crossingCount(takeoff) + 1, sourceField: "crossingCount+1", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-PLOW-FOOT", quantity: civil.plowFeet, sourceField: "derived.plowFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-HDD-FOOT", quantity: civil.hddFeet, sourceField: "derived.hddFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-OPEN-TRENCH-FOOT", quantity: civil.openTrenchFeet, sourceField: "derived.openTrenchFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-URBAN-FOOT", quantity: civil.urbanFeet, sourceField: "derived.urbanFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-ROAD-BORE-EACH", quantity: takeoff.roadCrossingCount, sourceField: "roadCrossingCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-RAILROAD-BORE-EACH", quantity: takeoff.railCrossingCount, sourceField: "railCrossingCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-WATER-CROSSING-EACH", quantity: takeoff.waterCrossingCount, sourceField: "waterCrossingCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-BRIDGE-ATTACHMENT-EACH", quantity: takeoff.bridgeCrossingCount, sourceField: "bridgeCrossingCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-CIVIL-UNKNOWN-CONSTRAINT-EACH", quantity: takeoff.unknownConstraintCount, sourceField: "unknownConstraintCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-MAT-CONDUIT-FOOT", quantity: takeoff.ductFeet, sourceField: "ductFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-MAT-FIBER-FOOT", quantity: takeoff.fiberFeet, sourceField: "fiberFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-MAT-VAULT-EACH", quantity: takeoff.vaultCount, sourceField: "vaultCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-MAT-HANDHOLE-EACH", quantity: takeoff.handholeCount, sourceField: "handholeCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-MAT-MARKER-EACH", quantity: takeoff.markerPostCount, sourceField: "markerPostCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-MAT-SPLICE-CASE-EACH", quantity: takeoff.splicePointCount, sourceField: "splicePointCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-LABOR-FIBER-PLACEMENT-FOOT", quantity: takeoff.fiberFeet, sourceField: "fiberFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-LABOR-SPLICING-EACH", quantity: takeoff.splicePointCount, sourceField: "splicePointCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-LABOR-TESTING-EACH", quantity: Math.max(1, takeoff.splicePointCount), sourceField: "splicePointCount", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-LABOR-RESTORATION-FOOT", quantity: Math.round(takeoff.routeFeet * 0.05), sourceField: "derived.restorationFeet", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-GC-MOBILIZATION-ALLOWANCE", quantity: 1, sourceField: "projectAllowance", sourceId, sourceCorridor, assumptionSet }),
    budgetLine({ proposalId, itemId: "COMM-GC-TRAFFIC-CONTROL-EACH", quantity: takeoff.roadCrossingCount + takeoff.vaultCount + takeoff.handholeCount, sourceField: "roadCrossingCount+vaultCount+handholeCount", sourceId, sourceCorridor, assumptionSet }),
  ];
  const baseLines = candidateLines.filter((line): line is ItemizedBudgetLine => Boolean(line));
  const categoryDirectCost =
    categoryTotal(baseLines, "CIVIL") +
    categoryTotal(baseLines, "MATERIALS") +
    categoryTotal(baseLines, "LABOR") +
    categoryTotal(baseLines, "ENGINEERING");
  const projectManagementRate = findUnitCost("COMM-GC-PROJECT-MANAGEMENT-PERCENT")?.unitCost ?? 0;
  const qaqcRate = findUnitCost("COMM-GC-QAQC-PERCENT")?.unitCost ?? 0;
  const generalConditionLines = [
    budgetLine({ proposalId, itemId: "COMM-GC-PROJECT-MANAGEMENT-PERCENT", quantity: categoryDirectCost, sourceType: "DirectCost", sourceField: "directCost", sourceId, sourceCorridor, assumptionSet, unitOverride: "ALLOWANCE", unitCostOverride: projectManagementRate }),
    budgetLine({ proposalId, itemId: "COMM-GC-QAQC-PERCENT", quantity: categoryDirectCost, sourceType: "DirectCost", sourceField: "directCost", sourceId, sourceCorridor, assumptionSet, unitOverride: "ALLOWANCE", unitCostOverride: qaqcRate }),
  ].filter((line): line is ItemizedBudgetLine => Boolean(line));
  const linesBeforeContingency = [...baseLines, ...generalConditionLines];
  const generalConditionsBeforeContingency = categoryTotal(linesBeforeContingency, "GENERAL_CONDITIONS");
  const directCost = categoryDirectCost + generalConditionsBeforeContingency;
  const markup = roundMoney(directCost * (args.markupPercent ?? 0));
  const contingencyRate = findUnitCost("COMM-GC-CONTINGENCY-PERCENT")?.unitCost ?? 0;
  const contingencyLine = budgetLine({
    proposalId,
    itemId: "COMM-GC-CONTINGENCY-PERCENT",
    quantity: directCost + markup,
    sourceType: "DirectCost",
    sourceField: "directCost+markup",
    sourceId,
    sourceCorridor,
    assumptionSet,
    unitOverride: "ALLOWANCE",
    unitCostOverride: contingencyRate,
  });
  const lines = contingencyLine ? [...linesBeforeContingency, contingencyLine] : linesBeforeContingency;
  const contingency = contingencyLine?.extendedCost ?? 0;
  const totals = {
    civil: categoryTotal(lines, "CIVIL"),
    materials: categoryTotal(lines, "MATERIALS"),
    labor: categoryTotal(lines, "LABOR"),
    engineering: categoryTotal(lines, "ENGINEERING"),
    generalConditions: generalConditionsBeforeContingency,
    directCost,
    markup,
    contingency,
    totalBudget: directCost + markup + contingency,
  };
  return {
    budgetId: `BUDGET-${proposalId}`,
    proposalId,
    source: "COMMERCIAL_FOUNDATION",
    budgetAssumptionSetId: assumptionSet.assumptionSetId,
    budgetAssumptionSetVersion: assumptionSet.version,
    sourceCorridor,
    lines,
    totals,
    currency: "USD",
    unitCostLibraryVersion: UNIT_COST_LIBRARY_VERSION,
    assumptions: [
      "Representative development unit costs only; not production pricing.",
      `Budget references BudgetAssumptionSet ${assumptionSet.assumptionSetId} version ${assumptionSet.version}.`,
      "Budget derives from CorridorTakeoff through CommercialQuantityMapping and UnitCostLibrary.",
      "No budget lock, contract, SOF, procurement, Control, or Field authority is created.",
      "All quantities remain pending engineering validation.",
    ],
    diagnostics: [
      `[COMMERCIAL_BUDGET_CREATED] proposalId=${proposalId}`,
      `unitCostLibraryVersion=${UNIT_COST_LIBRARY_VERSION}`,
      `assumptionSetId=${assumptionSet.assumptionSetId}`,
      `lineCount=${lines.length}`,
      `takeoffId=${takeoff.takeoffId}`,
    ],
    readOnly: true,
    preliminary: true,
    nonContractual: true,
    noBudgetLock: true,
    noExecutionAuthority: true,
    generatedAt: new Date().toISOString(),
  };
}

export function createItemizedBudgetFromGraph(graph: ProposedGraph): ItemizedBudget | null {
  if (!graph.takeoff) return null;
  return createItemizedBudgetFromTakeoff({
    proposalId: graph.proposalId,
    takeoff: graph.takeoff,
  });
}

export function estimateMonthlyRecurringFromRouteMiles(routeMiles: number) {
  const perMile = findUnitCost("COMM-GC-OANDM-MILE-MONTH");
  const minimum = findUnitCost("COMM-GC-OANDM-MINIMUM-MONTH");
  const mileageBased = routeMiles * (perMile?.unitCost ?? 0);
  const minimumMonthly = minimum?.unitCost ?? 0;
  return {
    estimatedMrc: Math.round(Math.max(minimumMonthly, mileageBased)),
    unitCostLibraryVersion: UNIT_COST_LIBRARY_VERSION,
    traceability: [
      "CorridorTakeoff.routeMiles",
      perMile?.itemId ?? "COMM-GC-OANDM-MILE-MONTH",
      minimum?.itemId ?? "COMM-GC-OANDM-MINIMUM-MONTH",
      UNIT_COST_LIBRARY_VERSION,
      "PreliminaryQuotePackage.estimatedMrc",
    ],
  };
}
