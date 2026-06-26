import type { CenterlineRouteConfidence } from "./CenterlineRoute";

export interface CorridorTakeoff {
  takeoffId: string;
  centerlineRouteId: string;
  stationedCorridorId: string;
  routeFeet: number;
  routeMiles: number;
  ductFeet: number;
  fiberFeet: number;
  vaultCount: number;
  handholeCount: number;
  regenSiteCount: number;
  splicePointCount: number;
  markerPostCount: number;
  roadCrossingCount: number;
  railCrossingCount: number;
  waterCrossingCount: number;
  bridgeCrossingCount: number;
  unknownConstraintCount: number;
  estimatedConstructionCost: number;
  confidence: CenterlineRouteConfidence;
  assumptions: string[];
  diagnostics: string[];
}
