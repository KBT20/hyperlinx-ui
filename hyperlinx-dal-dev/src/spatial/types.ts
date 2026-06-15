import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate } from "../types/dal";
import type { BuildPath } from "../types/networkAffinity";

export type ParcelClassification =
  | "Municipal"
  | "County"
  | "State"
  | "Federal"
  | "Utility"
  | "Commercial"
  | "Industrial"
  | "Residential"
  | "Unknown";

export type RoadType = "Interstate" | "Highway" | "Farm To Market" | "County Road" | "City Street" | "Private Road";

export type WaterCrossingType = "Stream" | "River" | "Lake" | "Canal";

export type PermitAuthority = "TxDOT" | "County" | "Municipality" | "Railroad" | "Federal" | "Utility";

export type Parcel = {
  parcelId: string;
  coordinate?: DALCoordinate;
  parcelType: ParcelClassification;
  landUse: ParcelClassification;
  ownershipType: ParcelClassification;
  confidence: number;
};

export type RoadSegment = {
  roadId: string;
  name: string;
  roadType: RoadType;
  geometry?: DALCoordinate[];
};

export type RailSegment = {
  railId: string;
  name: string;
  operator?: string;
  geometry?: DALCoordinate[];
};

export type WaterCrossing = {
  crossingId: string;
  name: string;
  crossingType: WaterCrossingType;
  coordinate?: DALCoordinate;
  riskScore: number;
};

export type MunicipalBoundary = {
  boundaryId: string;
  name: string;
  geometry?: DALCoordinate[][];
};

export type CountyBoundary = {
  boundaryId: string;
  name: string;
  state: string;
  geometry?: DALCoordinate[][];
};

export type StateBoundary = {
  boundaryId: string;
  name: string;
  geometry?: DALCoordinate[][];
};

export type SpatialLayers = {
  parcels?: Parcel[];
  roads?: RoadSegment[];
  rails?: RailSegment[];
  waters?: WaterCrossing[];
  municipalities?: MunicipalBoundary[];
  counties?: CountyBoundary[];
  states?: StateBoundary[];
};

export type ParcelIntelligence = {
  parcel: Parcel;
  parcelScore: number;
  notes: string[];
};

export type RoadIntelligence = {
  nearestRoad: RoadSegment;
  roadDistanceFeet: number;
  roadAccessScore: number;
  notes: string[];
};

export type RailIntelligence = {
  railCrossingCount: number;
  railRiskScore: number;
  crossings: RailSegment[];
  notes: string[];
};

export type WaterIntelligence = {
  waterCrossingCount: number;
  waterRiskScore: number;
  crossings: WaterCrossing[];
  notes: string[];
};

export type PermittingAssessment = {
  authorities: PermitAuthority[];
  permitComplexityScore: number;
  likelyPermits: string[];
  notes: string[];
};

export type ConstructabilityStatus = "BUILDABLE" | "CONSTRAINED" | "HIGH_RISK" | "UNKNOWN";

export type ConstructabilityAssessment = {
  assessmentId: string;
  siteId: string;
  createdAt: string;
  parcel: ParcelIntelligence;
  road: RoadIntelligence;
  rail: RailIntelligence;
  water: WaterIntelligence;
  permitting: PermittingAssessment;
  rowComplexity: number;
  permitComplexity: number;
  crossingComplexity: number;
  utilityConflictRisk: number;
  environmentalRisk: number;
  constructionDifficulty: number;
  constructabilityScore: number;
  parcelScore: number;
  roadAccessScore: number;
  permitScore: number;
  crossingScore: number;
  riskScore: number;
  buildableStatus: ConstructabilityStatus;
  estimatedPermitCost: number;
  estimatedCrossingCost: number;
  estimatedEnvironmentalCost: number;
  estimatedEngineeringCost: number;
  notes: string[];
};

export type ConstructabilityInput = {
  site: CandidateSite;
  buildPath?: BuildPath;
  layers?: SpatialLayers;
};
