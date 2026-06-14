/**
 * Financial Replay Engine
 * 
 * Derives economic/runtime truth from:
 * - IOFPackage
 * - closes/events
 * - object graph
 * - pricing assumptions
 * - design budget input
 * - marketplace revenue assumptions
 * 
 * Financial state flows from the SAME authoritative runtime model
 * used by Design, Twin, Field, Marketplace, Prism.
 */

import type { IOFPackage, IOFCloseRecord } from "./types";
import type {
  IOFFinancialMetadata,
  IOFSegmentFinancials,
  IOFOverallFinancials,
  IOFFinancialState,
  DesignBudgetInput,
  MarketplaceAssumptions,
  FinancialAssumptions,
} from "./financialState";
import { DEFAULT_FINANCIAL_ASSUMPTIONS } from "./financialState";
import { normalizeId } from "./closeHelpers";

/**
 * Compute financial state for entire scope
 * 
 * Derives:
 * - object-level economics (install cost, revenue, margin)
 * - segment-level economics (aggregated by station)
 * - overall portfolio economics
 */
export function computeFinancialState(
  scopePackage: IOFPackage,
  closes: IOFCloseRecord[],
  designBudget?: DesignBudgetInput,
  marketplaceAssumptions?: MarketplaceAssumptions,
  assumptions: FinancialAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS
): IOFFinancialState {
  if (!scopePackage?.canonicalTruth) {
    return createEmptyFinancialState(scopePackage?.scopeVersionId || "unknown");
  }

  const timestamp = Date.now();
  const objects = new Map<string, IOFFinancialMetadata>();
  const segments = new Map<string, IOFSegmentFinancials>();

  // Compute object-level economics
  for (const obj of scopePackage.canonicalTruth.objects || []) {
    const objectId = normalizeId(obj.objectId || obj.id || "");
    if (!objectId) continue;

    const financial = computeObjectEconomics(
      obj,
      scopePackage,
      closes,
      designBudget,
      marketplaceAssumptions,
      assumptions
    );

    objects.set(objectId, financial);
  }

  // Compute segment-level economics (grouped by station)
  for (const station of scopePackage.canonicalTruth.stations || []) {
    const stationId = normalizeId(station.stationId || station.id || "");
    if (!stationId) continue;

    const segment = computeSegmentEconomics(
      stationId,
      scopePackage,
      objects,
      assumptions
    );

    segments.set(stationId, segment);
  }

  // Compute overall portfolio economics
  const overall = computeOverallEconomics(
    scopePackage,
    objects,
    segments,
    assumptions
  );

  return {
    scopeVersionId: scopePackage.scopeVersionId,
    objects,
    segments,
    overall,
    timestamp,
  };
}

/**
 * Compute economics for a single infrastructure object
 */
function computeObjectEconomics(
  obj: any,
  scopePackage: IOFPackage,
  closes: IOFCloseRecord[],
  designBudget?: DesignBudgetInput,
  marketplaceAssumptions?: MarketplaceAssumptions,
  assumptions: FinancialAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS
): IOFFinancialMetadata {
  const objectId = normalizeId(obj.objectId || obj.id || "");
  const stationId = normalizeId(obj.stationId || "");

  // Get install cost from design budget or derive from route
  let installCost = 0;
  let laborCost = 0;
  let materialCost = 0;

  if (
    designBudget?.stationCosts?.[stationId]?.installCost
  ) {
    installCost = designBudget.stationCosts[stationId].installCost;
    laborCost = designBudget.stationCosts[stationId].laborCost || installCost * assumptions.laborPercentage;
    materialCost = designBudget.stationCosts[stationId].materialCost || installCost * assumptions.materialPercentage;
  } else if (designBudget?.estimatedInstallCostPerFoot && scopePackage.canonicalTruth.route?.length) {
    // Estimate based on route length
    const routeFeet = scopePackage.canonicalTruth.route.length * 100; // rough estimate
    installCost = routeFeet * designBudget.estimatedInstallCostPerFoot;
    laborCost = installCost * (designBudget.estimatedLaborPercentage || assumptions.laborPercentage);
    materialCost = installCost * (designBudget.estimatedMaterialPercentage || assumptions.materialPercentage);
  } else {
    // Use default assumptions
    const estimatedFeet = 1000; // placeholder
    installCost = estimatedFeet * assumptions.defaultInstallCostPerFoot;
    laborCost = installCost * assumptions.laborPercentage;
    materialCost = installCost * assumptions.materialPercentage;
  }

  // Get revenue from marketplace or use default
  let allocatedRevenue = 0;
  let projectedRevenue = 0;
  let serviceProducts: string[] = [];

  if (marketplaceAssumptions?.objectAllocations?.[objectId]) {
    allocatedRevenue = marketplaceAssumptions.objectAllocations[objectId].allocatedRevenue || 0;
    serviceProducts = marketplaceAssumptions.objectAllocations[objectId].products || [];
  } else if (marketplaceAssumptions?.monthlyRecurringRevenueTarget) {
    // Distribute revenue across objects
    const objectCount = scopePackage.canonicalTruth.objects?.length || 1;
    allocatedRevenue = marketplaceAssumptions.monthlyRecurringRevenueTarget / objectCount;
  } else {
    allocatedRevenue = assumptions.defaultMonthlyRecurringRevenue;
  }

  // Project annual revenue
  projectedRevenue = allocatedRevenue * 12;
  if (!serviceProducts.length) {
    serviceProducts = assumptions.defaultServiceProducts;
  }

  // Compute margins & payback
  const margin = projectedRevenue - installCost;
  const marginPercentage = installCost > 0 ? (margin / installCost) * 100 : 0;
  const paybackMonths = allocatedRevenue > 0 ? installCost / allocatedRevenue : 0;

  // Velocity contribution (monthly margin realization)
  const velocityContribution = allocatedRevenue > 0 ? allocatedRevenue - (installCost / 36) : 0;

  return {
    installCost,
    laborCost,
    materialCost,
    allocatedRevenue,
    projectedRevenue,
    margin,
    marginPercentage,
    paybackMonths,
    velocityContribution,
    serviceProducts,
    assumptions: {
      source: designBudget || marketplaceAssumptions ? "derived" : "placeholder",
      timestamp: Date.now(),
    },
  };
}

/**
 * Compute economics for a segment (station)
 */
function computeSegmentEconomics(
  stationId: string,
  scopePackage: IOFPackage,
  objectFinancials: Map<string, IOFFinancialMetadata>,
  assumptions: FinancialAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS
): IOFSegmentFinancials {
  let totalInstallCost = 0;
  let totalLaborCost = 0;
  let totalMaterialCost = 0;
  let totalProjectedRevenue = 0;
  let totalAllocatedRevenue = 0;
  let objectCount = 0;
  let completedObjects = 0;

  // Aggregate object economics for this station
  for (const obj of scopePackage.canonicalTruth.objects || []) {
    const objStationId = normalizeId(obj.stationId || "");
    if (objStationId !== stationId) continue;

    const objId = normalizeId(obj.objectId || obj.id || "");
    const financial = objectFinancials.get(objId);

    if (financial) {
      totalInstallCost += financial.installCost || 0;
      totalLaborCost += financial.laborCost || 0;
      totalMaterialCost += financial.materialCost || 0;
      totalProjectedRevenue += financial.projectedRevenue || 0;
      totalAllocatedRevenue += financial.allocatedRevenue || 0;
      objectCount++;
    }
  }

  const totalMargin = totalProjectedRevenue - totalInstallCost;
  const marginPercentage = totalInstallCost > 0 ? (totalMargin / totalInstallCost) * 100 : 0;
  const projectedROI = totalInstallCost > 0 ? (totalMargin / totalInstallCost) : 0;
  const averagePaybackMonths =
    objectCount > 0 && totalAllocatedRevenue > 0
      ? (totalInstallCost / objectCount) / (totalAllocatedRevenue / objectCount)
      : 0;

  return {
    stationId,
    totalInstallCost,
    totalLaborCost,
    totalMaterialCost,
    totalProjectedRevenue,
    totalAllocatedRevenue,
    totalMargin,
    marginPercentage,
    projectedROI,
    averagePaybackMonths,
    objectCount,
    completedObjects,
  };
}

/**
 * Compute overall portfolio economics
 */
function computeOverallEconomics(
  scopePackage: IOFPackage,
  objectFinancials: Map<string, IOFFinancialMetadata>,
  segmentFinancials: Map<string, IOFSegmentFinancials>,
  assumptions: FinancialAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS
): IOFOverallFinancials {
  let totalInstallCost = 0;
  let totalLaborCost = 0;
  let totalMaterialCost = 0;
  let totalProjectedRevenue = 0;
  let totalAllocatedRevenue = 0;
  let totalObjects = 0;

  // Aggregate from all objects
  for (const financial of objectFinancials.values()) {
    totalInstallCost += financial.installCost || 0;
    totalLaborCost += financial.laborCost || 0;
    totalMaterialCost += financial.materialCost || 0;
    totalProjectedRevenue += financial.projectedRevenue || 0;
    totalAllocatedRevenue += financial.allocatedRevenue || 0;
    totalObjects++;
  }

  const totalMargin = totalProjectedRevenue - totalInstallCost;
  const averageMarginPercentage = totalInstallCost > 0 ? (totalMargin / totalInstallCost) * 100 : 0;
  const projectedROI = totalInstallCost > 0 ? (totalMargin / totalInstallCost) : 0;

  // Velocity: assume 36-month payout period
  const revenueVelocity = totalAllocatedRevenue / 12; // monthly
  const marginVelocity = totalAllocatedRevenue / 12 - totalInstallCost / 36;
  const portfolioPaybackMonths = totalAllocatedRevenue > 0 ? totalInstallCost / totalAllocatedRevenue : 0;

  return {
    totalInstallCost,
    totalLaborCost,
    totalMaterialCost,
    totalProjectedRevenue,
    totalAllocatedRevenue,
    totalMargin,
    averageMarginPercentage,
    projectedROI,
    revenueVelocity,
    marginVelocity,
    portfolioPaybackMonths,
    totalObjects,
    completedObjects: 0, // Would be computed from replay state
  };
}

/**
 * Create empty financial state (fallback)
 */
function createEmptyFinancialState(scopeVersionId: string): IOFFinancialState {
  return {
    scopeVersionId,
    objects: new Map(),
    segments: new Map(),
    overall: {
      totalInstallCost: 0,
      totalLaborCost: 0,
      totalMaterialCost: 0,
      totalProjectedRevenue: 0,
      totalAllocatedRevenue: 0,
      totalMargin: 0,
      averageMarginPercentage: 0,
      projectedROI: 0,
      revenueVelocity: 0,
      marginVelocity: 0,
      portfolioPaybackMonths: 0,
      totalObjects: 0,
      completedObjects: 0,
    },
    timestamp: Date.now(),
  };
}

/**
 * Compute revenue velocity (monthly recurring revenue trend)
 * 
 * Placeholder: returns current monthly allocation
 * Real implementation would model acceleration based on execution
 */
export function computeRevenueVelocity(
  financialState: IOFFinancialState,
  monthsAhead: number = 12
): number[] {
  const currentVelocity = financialState.overall.revenueVelocity;
  const projection: number[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    // Placeholder: linear growth
    projection.push(currentVelocity * (1 + (i * 0.02)));
  }

  return projection;
}

/**
 * Compute margin velocity (margin realization trend)
 * 
 * Placeholder: returns current monthly margin
 * Real implementation would model acceleration based on completion rate
 */
export function computeMarginVelocity(
  financialState: IOFFinancialState,
  monthsAhead: number = 12
): number[] {
  const currentVelocity = financialState.overall.marginVelocity;
  const projection: number[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    // Placeholder: linear growth
    projection.push(currentVelocity * (1 + (i * 0.02)));
  }

  return projection;
}
