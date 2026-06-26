import type { DALCoordinate } from "../types/dal";
import type { ProposedGraphConstructionType } from "./ProposedGraphNode";
import type { RouteConstraint } from "../routeGeneration/RouteConstraint";
import type { RouteConstructionMethod } from "../routeGeneration/RouteSegment";

export interface ProposedGraphCrossing {
  crossingId: string;
  crossingType: "ROAD" | "RAIL" | "WATER" | "UTILITY" | "UNKNOWN";
  label: string;
  estimatedCost: number;
}

export interface ProposedGraphEdge {
  id: string;
  segmentId?: string;
  from: string;
  to: string;
  estimatedDistance: number;
  roadName?: string;
  county?: string;
  constructionMethod?: RouteConstructionMethod;
  estimatedFiberFeet: number;
  estimatedDuctFeet: number;
  estimatedCost?: number;
  constructionType: ProposedGraphConstructionType;
  crossings: ProposedGraphCrossing[];
  estimatedConstraints?: RouteConstraint[];
  confidence: number;
  comments: string[];
  engineeringNotes?: string[];
  coordinates: DALCoordinate[];
  metadata: Record<string, unknown>;
  readOnly: true;
}
