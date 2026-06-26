import type { DALCoordinate } from "../types/dal";

export type RouteConstraintType =
  | "MAJOR_HIGHWAY_CROSSING"
  | "STATE_HIGHWAY_CROSSING"
  | "RAILROAD_CROSSING"
  | "RIVER_CREEK_CROSSING"
  | "LARGE_WATER_BODY"
  | "URBAN_AREA"
  | "STEEP_TERRAIN"
  | "BRIDGE_CROSSING"
  | "ENVIRONMENTAL_AREA"
  | "UTILITY_CORRIDOR"
  | "UNKNOWN_CONSTRAINT";

export interface RouteConstraint {
  constraintId: string;
  constraintType: RouteConstraintType;
  segmentId: string;
  estimatedLocation: DALCoordinate;
  estimatedCost: number;
  confidence: number;
  classificationBasis: string;
  estimatedOnly: true;
}

export interface EngineeringConstraintCandidate {
  constraintId: string;
  constraintType: RouteConstraintType;
  estimatedLocation: DALCoordinate;
  confidence: number;
  engineeringStatus: "PENDING_VERIFICATION";
  sourceRouteCandidateId: string;
  sourceSegmentId: string;
  estimatedOnly: true;
}
