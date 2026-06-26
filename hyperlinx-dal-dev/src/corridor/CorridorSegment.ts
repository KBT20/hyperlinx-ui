import type { DALCoordinate } from "../types/dal";
import type { RouteConstructionMethod } from "../routeGeneration/RouteSegment";

export interface CorridorSegment {
  segmentId: string;
  fromStationId: string;
  toStationId: string;
  fromStationFeet: number;
  toStationFeet: number;
  lengthFeet: number;
  lengthMiles: number;
  geometry: DALCoordinate[];
  constructionMethod: RouteConstructionMethod;
  estimatedCost: number;
  confidence: number;
  constraintIds: string[];
  inventoryObjectIds: string[];
  engineeringStatus: "PENDING_VERIFICATION";
  metadata: Record<string, unknown>;
}
