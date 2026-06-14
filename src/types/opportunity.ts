export type OpportunityStage =
  | "prism_recommended"
  | "pending_control"
  | "marketplace_review"
  | "approved"
  | "rejected";

export type Opportunity = {
  id: string;
  type: "new_scopeversion";

  lifecycle: {
    stage: OpportunityStage;
    status: string;
    source: "human_asserted" | "sweep";
    createdAt: string;
  };

  parent: {
    scopeVersionId: string;
    stationId: string;
    stationLabel: string;
  };

  account: {
    name: string;
    type: string;
    address: string;
    lat: number;
    lon: number;
  };

  service: {
    type: string;
    category: string;
    profileTemplate: string;
  };

  route: {
    distanceFeet: number;
    geometry: [number, number][];
  };

  economics: {
    revenueMonthly: number;
    buildCost: number;

    pricingModel: {
      standardMonthlyRate: number;
      targetPaybackMonths: number;
      calculatedPaybackMonths: number;
      roi: number;
      nrc: number;
      nrcRequired: boolean;
      nrcDelta: number;
    };

    segment: {
      segmentRevenueMonthly: number;
      sva: number;
    };
  };

  capacity: {
    requiredMbps: number;
    concurrencyFactor: number;
    effectiveLoadMbps: number;
  };

  backboneImpact: {
    percentCapacityUsed: number;
    upgradeContributionMonthly: number;
    monthsToUpgradeDelta: number;

    upgradeTrigger: {
      isNearThreshold: boolean;
      remainingCapacityEstimateMbps: number;
    };
  };

  decision: {
    recommendation: "pursue" | "review" | "reject";
    confidence: number;
    rationale: string[];
  };

  execution: {
    readyForMarketplace: boolean;
    readyForControl: boolean;
    requiresVendorPricing: boolean;
    estimatedComplexity: "low" | "medium" | "high";
  };

  graph: {
    createsNewScopeVersion: boolean;
    childScopeVersionId: string | null;
    contributesToParent: boolean;
  };
};