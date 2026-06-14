export type IOFFinancialOptions = {
  routeFeet: number;
  riskPercent?: number;
  marginPercent?: number;
  engineeringPerFt?: number;
  permittingPerFt?: number;
  mobilization?: number;
  pmOverheadPercent?: number;
  insurancePercent?: number;
  qcPercent?: number;
  materialsEscalationPercent?: number;
  materialUnit?: {
    conduitPerFt: number;
    innerductPerFt: number;
    fiberPerFt: number;
    tracerWirePerFt: number;
    restorationPerFt: number;
  };
  ductCount?: number;
};

export type IOFFinancialSummary = {
  routeFeet: number;
  routeMiles: number;
  directCivilLabor: number;
  materialsBase: number;
  materialsEscalated: number;
  engineering: number;
  permitting: number;
  crossings: number;
  subtotal: number;
  contingency: number;
  riskedCost: number;
  margin: number;
  totalBid: number;
  costPerFoot: number;
  costPerMile: number;
};

const DEFAULT_MATERIAL_UNIT = {
  conduitPerFt: 3.2,
  innerductPerFt: 1.6,
  fiberPerFt: 0.12,
  tracerWirePerFt: 0.02,
  restorationPerFt: 2.1,
};

export function estimateIOFFinancials(options: IOFFinancialOptions): IOFFinancialSummary {
  const {
    routeFeet,
    riskPercent = 8,
    marginPercent = 12,
    engineeringPerFt = 1.75,
    permittingPerFt = 0.55,
    mobilization = 20000,
    pmOverheadPercent = 10,
    insurancePercent = 7,
    qcPercent = 3,
    materialsEscalationPercent = 14,
    materialUnit = DEFAULT_MATERIAL_UNIT,
    ductCount = 2,
  } = options;

  const routeMiles = routeFeet / 5280;
  const directCivilLabor = routeFeet * 12.5;
  const materialsBase = routeFeet * (materialUnit.conduitPerFt + materialUnit.innerductPerFt);
  const materialsEscalated = materialsBase * (1 + materialsEscalationPercent / 100);
  const engineering = engineeringPerFt * routeFeet;
  const permitting = permittingPerFt * routeFeet;
  const crossings = 15000;
  const subtotal =
    directCivilLabor +
    materialsEscalated +
    engineering +
    permitting +
    mobilization +
    crossings;

  const contingency = subtotal * 0.1;
  const riskedCost = subtotal + contingency;
  const overhead = (pmOverheadPercent + insurancePercent + qcPercent) / 100;
  const margin = riskedCost * (marginPercent / 100);
  const totalBid = riskedCost * (1 + overhead) + margin;
  const costPerFoot = routeFeet > 0 ? totalBid / routeFeet : 0;

  return {
    routeFeet,
    routeMiles,
    directCivilLabor,
    materialsBase,
    materialsEscalated,
    engineering,
    permitting,
    crossings,
    subtotal,
    contingency,
    riskedCost,
    margin,
    totalBid,
    costPerFoot,
    costPerMile: costPerFoot * 5280,
  };
}

/* ==============================================
   FINANCIAL STATE ENGINE
   
   Embeds economic/runtime intelligence directly 
   into the IOF object graph.
   
   Every infrastructure object carries:
   - operational truth (from replayEngine)
   - execution truth (from replayEngine)
   - economic truth (from design/marketplace)
   - monetization truth (from marketplace)
============================================== */

export type IOFFinancialMetadata = {
  // Installation economics
  installCost?: number;        // Total install cost for object
  laborCost?: number;          // Labor component
  materialCost?: number;       // Material component
  
  // Revenue & monetization
  allocatedRevenue?: number;   // Revenue allocated to this object
  projectedRevenue?: number;   // Projected recurring revenue
  serviceProducts?: string[];  // Products/services this object enables
  
  // Margins & returns
  margin?: number;             // Absolute margin (projected - cost)
  marginPercentage?: number;   // Margin as percentage
  
  // Payback & velocity
  paybackMonths?: number;      // Months to recover install cost
  velocityContribution?: number; // Contribution to revenue velocity
  
  // Metadata
  assumptions?: {
    source?: 'design' | 'marketplace' | 'derived' | 'manual';
    timestamp?: number;
  };
};

export type IOFSegmentFinancials = {
  stationId?: string;
  
  // Costs
  totalInstallCost: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  
  // Revenue
  totalProjectedRevenue: number;
  totalAllocatedRevenue: number;
  
  // Returns
  totalMargin: number;
  marginPercentage: number;
  projectedROI: number;
  
  // Payback
  averagePaybackMonths: number;
  
  // Scale
  objectCount: number;
  completedObjects: number;
};

export type IOFOverallFinancials = {
  // Costs
  totalInstallCost: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  
  // Revenue
  totalProjectedRevenue: number;
  totalAllocatedRevenue: number;
  
  // Returns
  totalMargin: number;
  averageMarginPercentage: number;
  projectedROI: number;
  
  // Velocity
  revenueVelocity: number;      // Revenue per month across execution
  marginVelocity: number;        // Margin realization per month
  
  // Payback
  portfolioPaybackMonths: number;
  
  // Scale
  totalObjects: number;
  completedObjects: number;
};

export type IOFFinancialState = {
  scopeVersionId: string;
  
  // Financial state per object
  objects: Map<string, IOFFinancialMetadata>;
  
  // Financial state per segment/station
  segments: Map<string, IOFSegmentFinancials>;
  
  // Overall financial truth
  overall: IOFOverallFinancials;
  
  // Timestamp when computed
  timestamp: number;
};

/**
 * Design budget input from DesignMode
 * Contributes install cost basis to financial engine
 */
export type DesignBudgetInput = {
  scopeVersionId: string;
  corridorId: string;
  segmentId: string;
  
  // Cost basis
  estimatedInstallCostPerFoot?: number;
  estimatedLaborPercentage?: number;
  estimatedMaterialPercentage?: number;
  
  // Route economics
  routeLengthFeet?: number;
  routeTotalCost?: number;
  
  // Per-station overrides
  stationCosts?: Record<string, {
    installCost?: number;
    laborCost?: number;
    materialCost?: number;
  }>;
  
  timestamp?: number;
};

/**
 * Marketplace assumptions input
 * Contributes revenue/product mappings to financial engine
 */
export type MarketplaceAssumptions = {
  scopeVersionId: string;
  corridorId: string;
  segmentId: string;
  
  // Revenue assumptions
  monthlyRecurringRevenueTarget?: number;
  projectedGrowthRate?: number;
  
  // Product mappings
  serviceProducts?: Record<string, {
    name: string;
    monthlyPrice?: number;
    objectTypes?: string[];
  }>;
  
  // Per-object revenue allocation
  objectAllocations?: Record<string, {
    objectId: string;
    allocatedRevenue?: number;
    products?: string[];
  }>;
  
  timestamp?: number;
};

/**
 * Pricing model for deriving financial state
 */
export type FinancialAssumptions = {
  // Installation
  defaultInstallCostPerFoot: number;
  laborPercentage: number;
  materialPercentage: number;
  
  // Revenue
  defaultMonthlyRecurringRevenue: number;
  defaultServiceProducts: string[];
  
  // Constraints
  minMarginPercentage: number;
  targetPaybackMonths: number;
};

export const DEFAULT_FINANCIAL_ASSUMPTIONS: FinancialAssumptions = {
  defaultInstallCostPerFoot: 50,
  laborPercentage: 0.4,
  materialPercentage: 0.6,
  defaultMonthlyRecurringRevenue: 1500,
  defaultServiceProducts: ['DIA', 'EPL'],
  minMarginPercentage: 0.15,
  targetPaybackMonths: 36,
};
