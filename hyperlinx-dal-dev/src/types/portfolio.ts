export type CandidateType = "enterprise" | "tower" | "data_center" | "wireless" | "carrier" | "hyperscaler" | "residential_cluster";

export type ConstructionType = "Aerial" | "Underground" | "Mixed";

export interface CandidateSite {
  id: string;
  name: string;
  candidateType: CandidateType;
  latitude: number;
  longitude: number;
  estimatedRevenueMonthly?: number;
  estimatedNRC?: number;
  tags?: string[];
}

export interface PricingModel {
  termMonths: number;
  revenueMultiplier: number;
}

export interface BuildCostModel {
  constructionType: ConstructionType;
  aerialCostPerFoot: number;
  undergroundCostPerFoot: number;
  mixedAerialShare: number;
  crossingCost: number;
  regenerationCost: number;
  popCost: number;
  crossingDistanceFeet: number;
  regenerationDistanceFeet: number;
  popDistanceFeet: number;
}

export interface DistanceAnalysis {
  nearestRouteId?: string;
  nearestNodeId?: string;
  nearestStationId?: string;
  nearestPopId?: string;
  distanceToNearestRouteFeet: number;
  distanceToNearestStationFeet: number;
  distanceToNearestNodeFeet: number;
  distanceToNearestPopFeet: number;
  distanceFeet: number;
}

export interface BuildCostEstimate {
  constructionType: ConstructionType;
  routeFeet: number;
  unitCostPerFoot: number;
  baseConstructionCost: number;
  crossingCost: number;
  regenerationCost: number;
  popCost: number;
  totalCost: number;
}

export interface RevenueEstimate {
  estimatedRevenueMonthly: number;
  estimatedRevenueAnnual: number;
  estimatedNRC: number;
  estimatedMRC: number;
  estimatedTCV: number;
}

export interface FinancialScore {
  paybackMonths: number;
  margin: number;
  irr: number;
  revenueDensity: number;
  capitalEfficiency: number;
  financialScore: number;
}

export interface StrategicScore {
  routeDiversity: number;
  metroDensity: number;
  longhaulValue: number;
  dataCenterProximity: number;
  hyperscalerAttractiveness: number;
  marketDensity: number;
  futureExpansionPotential: number;
  strategicScore: number;
}

export interface EngineeringScore {
  constructability: number;
  networkComplexity: number;
  existingFacilities: number;
  nodeAdjacency: number;
  engineeringScore: number;
}

export interface OpportunitySeed {
  id: string;

  inventoryId: string;
  graphId: string;

  scopeVersionId?: string;

  candidateType: CandidateType;

  latitude: number;
  longitude: number;

  nearestRouteId?: string;
  nearestNodeId?: string;
  nearestStationId?: string;

  distanceFeet: number;

  buildCost: number;

  estimatedRevenueMonthly: number;
  estimatedRevenueAnnual: number;

  estimatedNRC: number;
  estimatedMRC: number;
  estimatedTCV: number;

  paybackMonths: number;

  strategicScore: number;
  financialScore: number;
  engineeringScore: number;

  overallScore: number;

  confidence: number;

  createdAt: string;

  siteName?: string;
  candidateSiteId?: string;
  facilityType?: string;
  marketSegment?: string;
  nearestPopId?: string;
  distanceAnalysis?: DistanceAnalysis;
  buildCostEstimate?: BuildCostEstimate;
  revenueEstimate?: RevenueEstimate;
  financialAnalysis?: FinancialScore;
  strategicAnalysis?: StrategicScore;
  engineeringAnalysis?: EngineeringScore;
  networkAffinity?: import("./networkAffinity").NetworkAffinity;
  networkAffinityScore?: number;
  attachmentStrategy?: import("./networkAffinity").AttachmentStrategy;
  buildPath?: import("./networkAffinity").BuildPath;
  capacityStatus?: import("./networkAffinity").CapacityStatus;
  constructionType?: ConstructionType;
  riskScore?: number;
  constructabilityScore?: number;
  permitScore?: number;
  parcelScore?: number;
  roadAccessScore?: number;
  crossingScore?: number;
  utilityConflictRisk?: number;
  environmentalRisk?: number;
  estimatedPermitCost?: number;
  estimatedCrossingCost?: number;
  estimatedEnvironmentalCost?: number;
  estimatedEngineeringCost?: number;
  constructabilityAssessment?: import("../spatial/types").ConstructabilityAssessment;
  roi?: number;
  margin?: number;
  buildMiles?: number;
  rank?: number;
}

export type PortfolioScenarioSize = 10 | 25 | 50 | 100;

export interface PortfolioPhasePlan {
  phase: "Phase 1" | "Phase 2" | "Phase 3";
  opportunityIds: string[];
  opportunityCount: number;
  capex: number;
  revenueAnnual: number;
  tcv: number;
  averagePaybackMonths: number;
  averageScore: number;
}
