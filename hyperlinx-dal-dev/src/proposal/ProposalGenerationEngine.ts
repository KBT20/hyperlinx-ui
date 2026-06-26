import type { ProposedGraph } from "../proposedGraph/ProposedGraph";
import { createItemizedBudgetFromGraph, estimateMonthlyRecurringFromRouteMiles } from "../commercial/CommercialFoundationEngine";
import type { ItemizedBudgetLine } from "../commercial/ItemizedBudget";
import { normalizeNetworkClass } from "../designDoctrine/NetworkClass";
import { normalizeProtectionClass } from "../designDoctrine/ProtectionClass";
import type { ProposedInventory } from "./ProposedInventory";
import { summarizeProposedInventory } from "./ProposedInventorySummary";
import type { EngineeringHandoffCandidate, PreliminaryQuotePackage } from "./PreliminaryQuotePackage";
import type { PreliminaryQuoteLineItem, PreliminaryQuoteLineItemCategory } from "./PreliminaryQuoteLineItem";
import type { QuoteConfidence, QuoteReadinessBlocker, QuoteReadinessDiagnostic } from "./QuoteReadiness";

function diagnostic(
  code: QuoteReadinessDiagnostic["code"],
  severity: QuoteReadinessDiagnostic["severity"],
  message: string,
  proposalId: string,
  details?: Record<string, unknown>,
): QuoteReadinessDiagnostic {
  const entry: QuoteReadinessDiagnostic = {
    diagnosticId: `${code}-${proposalId}`,
    code,
    severity,
    message,
    timestamp: new Date().toISOString(),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function lineItem(
  proposalId: string,
  category: PreliminaryQuoteLineItemCategory,
  description: string,
  quantity: number,
  unit: PreliminaryQuoteLineItem["unit"],
  unitCost: number,
  estimatedMrc = 0,
): PreliminaryQuoteLineItem {
  return {
    lineItemId: `${proposalId}:${category}`,
    category,
    description,
    quantity,
    unit,
    unitCost,
    estimatedNrc: Math.round(quantity * unitCost),
    estimatedMrc,
    readOnly: true,
  };
}

function preliminaryCategoryForCommercialItem(itemId: string, category: string): PreliminaryQuoteLineItemCategory {
  if (itemId.includes("HDD") || itemId.includes("BORE") || itemId.includes("CROSSING") || itemId.includes("BRIDGE")) return "DIRECTIONAL_DRILLING";
  if (itemId.includes("PLOW")) return "PLOWING";
  if (itemId.includes("OPEN") || itemId.includes("URBAN") || itemId.includes("RESTORATION")) return "OPEN_CUT";
  if (itemId.includes("VAULT") || itemId.includes("HANDHOLE")) return "VAULTS";
  if (itemId.includes("FIBER") && category === "MATERIALS") return "FIBER";
  if (itemId.includes("CONDUIT")) return "DUCT";
  if (itemId.includes("SPLICE")) return "SPLICING";
  if (itemId.includes("TESTING")) return "TESTING";
  if (itemId.includes("TRAFFIC")) return "TRAFFIC_CONTROL";
  if (itemId.includes("CONTINGENCY") || itemId.includes("PROJECT-MANAGEMENT") || itemId.includes("QAQC") || itemId.includes("MOBILIZATION")) return "CONTINGENCY";
  if (category === "ENGINEERING") return itemId.includes("PERMIT") ? "PERMITTING" : "ENGINEERING";
  return "CONTINGENCY";
}

function commercialLineToPreliminaryLineItem(proposalId: string, line: ItemizedBudgetLine): PreliminaryQuoteLineItem {
  const category = preliminaryCategoryForCommercialItem(line.commercialItemId, line.category);
  const unit = line.unit === "PERCENT" ? "ALLOWANCE" : line.unit;
  return {
    lineItemId: `${proposalId}:${line.budgetLineId}`,
    category,
    description: line.description,
    quantity: unit === "ALLOWANCE" && line.unit === "PERCENT" ? 1 : line.quantity,
    unit,
    unitCost: unit === "ALLOWANCE" && line.unit === "PERCENT" ? line.extendedCost : line.unitCost,
    estimatedNrc: line.extendedCost,
    estimatedMrc: 0,
    readOnly: true,
  };
}

export function createProposedInventoryFromGraph(graph: ProposedGraph): ProposedInventory {
  const inventory: ProposedInventory = {
    proposalId: graph.proposalId,
    proposedGraphId: graph.proposedGraphId,
    routeCandidateId: graph.routeCandidateId,
    centerlineRouteId: graph.centerlineRouteId,
    stationedCorridorId: graph.stationedCorridorId,
    takeoffId: graph.takeoffId,
    customerId: graph.customerId,
    opportunityId: graph.opportunityId,
    routeRequestId: graph.routeRequestId,
    networkType: graph.networkType,
    protection: graph.protection,
    primaryProduct: graph.primaryProduct,
    estimatedMileage: graph.takeoff?.routeMiles ?? graph.routeStatistics.totalRouteLengthMiles,
    estimatedSegments: graph.stationedCorridor?.segments.length ?? graph.routeCandidate.segments.length,
    estimatedStations: graph.stationedCorridor?.stations.length ?? graph.routeStatistics.estimatedStationCount,
    estimatedCrossings: graph.takeoff
      ? graph.takeoff.roadCrossingCount + graph.takeoff.railCrossingCount + graph.takeoff.waterCrossingCount + graph.takeoff.bridgeCrossingCount + graph.takeoff.unknownConstraintCount
      :
        graph.routeStatistics.estimatedHighwayCrossings +
        graph.routeStatistics.estimatedRailroadCrossings +
        graph.routeStatistics.estimatedWaterCrossings,
    estimatedVaults: graph.statistics.estimatedVaults,
    estimatedFiberFeet: graph.takeoff?.fiberFeet ?? graph.routeStatistics.fiberFeet,
    estimatedDuctFeet: graph.takeoff?.ductFeet ?? graph.routeStatistics.ductFeet,
    estimatedConstructionType: "BURIED",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    noInventoryCreation: true,
    noScopeVersionCreation: true,
    noGraphMutation: true,
  };
  diagnostic("PROPOSED_INVENTORY_CREATED", "INFO", "Proposed inventory estimate created from canonical ProposedGraph.", graph.proposalId, {
    proposedGraphId: graph.proposedGraphId,
  });
  return inventory;
}

export function evaluateQuoteBlockers(inventory: ProposedInventory | null): QuoteReadinessBlocker[] {
  if (!inventory) {
    return [
      {
        blockerId: "MISSING-PROPOSED-INVENTORY",
        blockerType: "MISSING_PROPOSED_INVENTORY",
        message: "Proposed inventory is required before preliminary quote generation.",
        requiredAction: "Generate proposed inventory from canonical ProposedGraph.",
      },
    ];
  }

  const blockers: QuoteReadinessBlocker[] = [];
  if (!inventory.customerId) {
    blockers.push({
      blockerId: `${inventory.proposalId}-MISSING-CUSTOMER`,
      blockerType: "MISSING_CUSTOMER",
      message: "Customer reference is required.",
      requiredAction: "Return to Teralinx Route intake.",
    });
  }
  if (!inventory.opportunityId) {
    blockers.push({
      blockerId: `${inventory.proposalId}-MISSING-OPPORTUNITY`,
      blockerType: "MISSING_OPPORTUNITY",
      message: "Opportunity reference is required.",
      requiredAction: "Return to Teralinx Route intake.",
    });
  }
  if (!inventory.primaryProduct) {
    blockers.push({
      blockerId: `${inventory.proposalId}-MISSING-PRODUCT`,
      blockerType: "MISSING_PRODUCT",
      message: "Primary product is required.",
      requiredAction: "Select Duct, Fiber, or Duct + Fiber.",
    });
  }
  if (!inventory.estimatedMileage || !inventory.estimatedSegments || !inventory.estimatedStations) {
    blockers.push({
      blockerId: `${inventory.proposalId}-MISSING-ESTIMATES`,
      blockerType: "MISSING_ESTIMATES",
      message: "Estimated route metrics are required.",
      requiredAction: "Regenerate Design Launch session.",
    });
  }
  return blockers;
}

export function estimateQuoteConfidence(inventory: ProposedInventory): QuoteConfidence {
  const protectionClass = normalizeProtectionClass(inventory.protection, normalizeNetworkClass(inventory.networkType));
  if (inventory.estimatedMileage > 120 || protectionClass === "PATH_PROTECTED" || protectionClass === "RING_PROTECTED" || protectionClass === "MESH_PROTECTED") return "MEDIUM";
  if (inventory.estimatedMileage <= 20 && inventory.primaryProduct !== "DUCT_PLUS_FIBER") return "HIGH";
  return "MEDIUM";
}

export function createPreliminaryQuotePackageFromGraph(graph: ProposedGraph): PreliminaryQuotePackage {
  const proposedInventory = createProposedInventoryFromGraph(graph);
  const summary = summarizeProposedInventory(proposedInventory);
  const blockers = evaluateQuoteBlockers(proposedInventory);
  const takeoff = graph.takeoff;
  const itemizedBudget = createItemizedBudgetFromGraph(graph);
  const lineItems: PreliminaryQuoteLineItem[] = itemizedBudget
    ? itemizedBudget.lines.map((item) => commercialLineToPreliminaryLineItem(proposedInventory.proposalId, item))
    : [
        lineItem(proposedInventory.proposalId, "ENGINEERING", "Commercial foundation unavailable; preliminary design allowance", proposedInventory.estimatedMileage, "MILE", 0),
      ];
  const estimatedNrc = Math.round(itemizedBudget?.totals.totalBudget ?? lineItems.reduce((sum, item) => sum + item.estimatedNrc, 0));
  const recurringEstimate = estimateMonthlyRecurringFromRouteMiles(takeoff?.routeMiles ?? proposedInventory.estimatedMileage);
  const estimatedMrc = recurringEstimate.estimatedMrc;
  const recommendedTermMonths = 60;
  const estimatedTcv = estimatedNrc + estimatedMrc * recommendedTermMonths;
  const diagnostics: QuoteReadinessDiagnostic[] = [
    diagnostic("PRELIMINARY_QUOTE_CREATED", "INFO", "Preliminary quote package created from canonical ProposedGraph.", proposedInventory.proposalId, {
      proposedGraphId: graph.proposedGraphId,
      estimatedNrc,
      estimatedMrc,
      recommendedTermMonths,
    }),
    diagnostic(blockers.length ? "QUOTE_BLOCKED" : "QUOTE_READY_FOR_CUSTOMER", blockers.length ? "ERROR" : "INFO", blockers.length ? "Preliminary quote package is blocked." : "Preliminary quote package is ready for customer review.", proposedInventory.proposalId, {
      blockerCount: blockers.length,
    }),
  ];

  return {
    quotePackageId: `QUOTE-${proposedInventory.proposalId}`,
    proposalId: proposedInventory.proposalId,
    proposedGraphId: graph.proposedGraphId,
    routeCandidateId: graph.routeCandidateId,
    centerlineRouteId: graph.centerlineRouteId,
    stationedCorridorId: graph.stationedCorridorId,
    takeoffId: graph.takeoffId,
    engineeringConstraintCandidateIds: graph.engineeringConstraintCandidates.map((candidate) => candidate.constraintId),
    customer: graph.customerName,
    customerId: proposedInventory.customerId,
    opportunity: graph.opportunityName,
    opportunityId: proposedInventory.opportunityId,
    routeRequestId: proposedInventory.routeRequestId,
    networkSummary: summary.networkSummary,
    estimatedRoute: summary.estimatedRoute,
    estimatedFootage: summary.estimatedFootage,
    primaryProduct: proposedInventory.primaryProduct,
    constructionSummary: summary.constructionSummary,
    estimatedNrc,
    estimatedMrc,
    recommendedTermMonths,
    estimatedTcv,
    lineItems,
    assumptions: [
      "Sales estimate only; engineering validation required before contractual commitment.",
      "This proposal is generated from the canonical ProposedGraph.",
      "Quantities are generated from the snapped centerline design candidate and remain subject to Route Engineering verification.",
      "Commercial values derive from the Commercial Foundation Unit Cost Library and Itemized Budget model.",
      `Recurring estimate derives from Unit Cost Library ${recurringEstimate.unitCostLibraryVersion}.`,
      ...(itemizedBudget?.assumptions ?? []),
      ...(takeoff?.assumptions ?? []),
      "No ScopeVersion, inventory graph, or construction package is created by this quote package.",
      "Permitting, crossing, and restoration costs are preliminary allowances.",
    ],
    confidence: estimateQuoteConfidence(proposedInventory),
    disclaimers: [
      "Preliminary and non-contractual.",
      "Customer is approving the proposed network, not the quote.",
      "Route generated from a centerline design candidate; final route geometry, permits, and construction quantities are established during Route Engineering.",
      "Subject to route engineering, inventory validation, permitting, and customer-approved scope.",
      "Does not authorize Control, Field, procurement, or construction.",
    ],
    readiness: blockers.length ? "BLOCKED" : "READY_FOR_CUSTOMER",
    blockers,
    diagnostics,
    generatedAt: new Date().toISOString(),
    readOnly: true,
    preliminary: true,
    nonContractual: true,
    engineeringValidationRequired: true,
  };
}

export function createEngineeringHandoffCandidate(args: {
  quotePackage: PreliminaryQuotePackage;
  proposedInventory: ProposedInventory;
  proposalAccepted: boolean;
}): EngineeringHandoffCandidate {
  const { quotePackage, proposedInventory, proposalAccepted } = args;
  if (proposalAccepted) {
    diagnostic("CUSTOMER_ACCEPTED", "INFO", "Customer accepted preliminary proposal for Route Engineering eligibility.", proposedInventory.proposalId);
    diagnostic("ENGINEERING_HANDOFF_ELIGIBLE", "INFO", "Proposal is eligible for Route Engineering navigation only.", proposedInventory.proposalId);
  } else {
    diagnostic("CUSTOMER_DECLINED", "WARNING", "Customer declined preliminary proposal.", proposedInventory.proposalId);
  }
  return {
    proposalId: proposedInventory.proposalId,
    proposedGraphId: proposedInventory.proposedGraphId,
    routeCandidateId: proposedInventory.routeCandidateId,
    centerlineRouteId: proposedInventory.centerlineRouteId,
    stationedCorridorId: proposedInventory.stationedCorridorId,
    takeoffId: proposedInventory.takeoffId,
    engineeringConstraintCandidateIds: quotePackage.engineeringConstraintCandidateIds ?? [],
    customerId: proposedInventory.customerId,
    opportunityId: proposedInventory.opportunityId,
    routeRequestId: proposedInventory.routeRequestId,
    proposalAccepted,
    estimatedInventory: proposedInventory,
    estimatedFinancials: {
      estimatedNrc: quotePackage.estimatedNrc,
      estimatedMrc: quotePackage.estimatedMrc,
      estimatedTcv: quotePackage.estimatedTcv,
      recommendedTermMonths: quotePackage.recommendedTermMonths,
    },
    noEngineeringExecution: true,
    engineeringCertificationRequired: true,
    noGeometryMutation: true,
    noScopeVersionCreation: true,
  };
}
