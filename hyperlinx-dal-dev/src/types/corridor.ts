import type { DALCoordinate } from "./dal";
import type { ConstructionType } from "./portfolio";

export type CorridorType = "ROAD" | "RAIL" | "UTILITY" | "HIGHWAY" | "CITY_STREET" | "UNKNOWN";

export type CorridorSegment = {
  id: string;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  distanceFeet: number;
  corridorType: CorridorType;
  estimatedCostPerFoot: number;
  riskScore: number;
  constructabilityScore: number;
  geometry: DALCoordinate[];
};

export type CorridorRisk = {
  railCrossingCount: number;
  highwayCrossingCount: number;
  waterCrossingCount: number;
  urbanDensity: number;
  rowComplexity: number;
  permitComplexity: number;
  riskScore: number;
};

export type CorridorCost = {
  constructionType: ConstructionType;
  labor: number;
  material: number;
  crossings: number;
  permits: number;
  engineering: number;
  contingency: number;
  nrcEstimate: number;
  costPerFoot: number;
};

export type CorridorPath = {
  id: string;
  siteId: string;
  attachmentRouteId?: string;
  attachmentNodeId?: string;
  attachmentStationId?: string;
  attachmentCoordinate: DALCoordinate;
  coordinates: DALCoordinate[];
  segments: CorridorSegment[];
  distanceFeet: number;
  buildMiles: number;
  estimatedRouteMiles: number;
  crossings: number;
  railCrossingCount: number;
  highwayCrossingCount: number;
  waterCrossingCount: number;
  turnCount: number;
  segmentCount: number;
  constructionType: ConstructionType;
  risk: CorridorRisk;
  cost: CorridorCost;
  constructabilityScore: number;
  weightedScore: number;
};

export type CorridorAnalysis = {
  candidateSiteId: string;
  inventoryId: string;
  graphId: string;
  paths: CorridorPath[];
  bestPath: CorridorPath;
  risk: CorridorRisk;
  cost: CorridorCost;
};

export type BestBuildPath = CorridorPath;
