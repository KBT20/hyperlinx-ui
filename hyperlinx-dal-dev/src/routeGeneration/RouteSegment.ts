import type { DALCoordinate } from "../types/dal";
import type { RouteConstraint } from "./RouteConstraint";

export type RouteConstructionMethod =
  | "BURIED_BACKBONE"
  | "BURIED_MIDDLE_MILE"
  | "URBAN_UNDERGROUND"
  | "CAMPUS_DUCT"
  | "UNKNOWN_CONSTRUCTION";

export interface RouteSegment {
  segmentId: string;
  fromNode: string;
  toNode: string;
  geometry: DALCoordinate[];
  estimatedLength: number;
  roadName?: string;
  county?: string;
  constructionMethod: RouteConstructionMethod;
  estimatedFiberFeet: number;
  estimatedDuctFeet: number;
  estimatedCost: number;
  confidence: number;
  constraints: RouteConstraint[];
  engineeringNotes: string[];
  estimatedOnly: true;
}
