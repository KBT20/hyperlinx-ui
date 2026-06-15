import type { DALCoordinate } from "./dal";
import type { BestBuildPath, CorridorAnalysis, CorridorCost, CorridorPath, CorridorRisk } from "./corridor";
import type { ConstructionType } from "./portfolio";
import type { ConstructabilityAssessment } from "../spatial/types";

export type AttachmentType =
  | "LATERAL"
  | "NEW_SEGMENT"
  | "MIDSPAN_SPLICE"
  | "EXISTING_NODE_ATTACH"
  | "EXISTING_STATION_ATTACH"
  | "RING_EXTENSION"
  | "REGEN_EXTENSION"
  | "DATACENTER_EXTENSION";

export type CapacityStatus = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type NearestRouteResult = {
  routeId?: string;
  routeName?: string;
  coordinate?: DALCoordinate;
  distanceFeet: number;
};

export type NearestNodeResult = {
  nodeId?: string;
  coordinate?: DALCoordinate;
  distanceFeet: number;
};

export type NearestStationResult = {
  stationId?: string;
  routeId?: string;
  coordinate?: DALCoordinate;
  distanceFeet: number;
};

export type BuildPath = {
  siteId: string;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType: AttachmentType;
  buildFeet: number;
  buildMiles?: number;
  estimatedRouteMiles?: number;
  estimatedCrossings: number;
  estimatedBores: number;
  estimatedAerialFeet: number;
  estimatedUndergroundFeet: number;
  railCrossingCount?: number;
  highwayCrossingCount?: number;
  waterCrossingCount?: number;
  turnCount?: number;
  segmentCount?: number;
  constructionType?: ConstructionType;
  estimatedCost?: number;
  riskScore?: number;
  constructabilityScore?: number;
  constructabilityAssessment?: ConstructabilityAssessment;
  parcelScore?: number;
  roadAccessScore?: number;
  permitScore?: number;
  crossingScore?: number;
  estimatedPermitCost?: number;
  estimatedCrossingCost?: number;
  estimatedEnvironmentalCost?: number;
  estimatedEngineeringCost?: number;
  corridorPath?: CorridorPath;
  corridorCost?: CorridorCost;
  corridorRisk?: CorridorRisk;
  geometry: DALCoordinate[];
};

export type CapacityAnalysis = {
  routeUtilization: CapacityStatus;
  nodeUtilization: CapacityStatus;
  stationUtilization: CapacityStatus;
  projectedUtilization: CapacityStatus;
};

export type AttachmentStrategy = {
  attachmentType: AttachmentType;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  buildFeet: number;
  estimatedCost: number;
  estimatedRevenueAnnual: number;
  paybackMonths: number;
  roi: number;
  margin: number;
  riskScore: number;
  constructionType: ConstructionType;
  constructabilityScore?: number;
  parcelScore?: number;
  roadAccessScore?: number;
  permitScore?: number;
  crossingScore?: number;
  estimatedPermitCost?: number;
  estimatedCrossingCost?: number;
  estimatedEnvironmentalCost?: number;
  estimatedEngineeringCost?: number;
  constructabilityAssessment?: ConstructabilityAssessment;
  engineeringScore: number;
  financialScore: number;
  strategicScore: number;
  compositeScore: number;
  buildPath: BuildPath;
  capacity: CapacityAnalysis;
};

export type NetworkAffinity = {
  siteId: string;
  inventoryId: string;
  graphId: string;
  nearestRoute: NearestRouteResult;
  nearestNode: NearestNodeResult;
  nearestStation: NearestStationResult;
  preferredAttachmentPoint?: DALCoordinate;
  preferredStrategy: AttachmentStrategy;
  strategies: AttachmentStrategy[];
  buildPath: BuildPath;
  capacity: CapacityAnalysis;
  networkSegmentUtilized?: string;
  estimatedBuildFootage: number;
  estimatedLateralFootage: number;
  corridorAnalysis?: CorridorAnalysis;
  corridorPath?: BestBuildPath;
  constructabilityAssessment?: ConstructabilityAssessment;
  constructabilityScore?: number;
  permitScore?: number;
  parcelScore?: number;
  roadAccessScore?: number;
  crossingScore?: number;
  estimatedPermitCost?: number;
  estimatedCrossingCost?: number;
  estimatedEnvironmentalCost?: number;
  estimatedEngineeringCost?: number;
  riskScore: number;
  constructionType: ConstructionType;
  estimatedCost: number;
  estimatedPayback: number;
  roi: number;
  affinityScore: number;
};
