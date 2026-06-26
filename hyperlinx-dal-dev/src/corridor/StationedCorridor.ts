import type { CenterlineRoute } from "./CenterlineRoute";
import type { CorridorInventoryObject } from "./CorridorInventoryObject";
import type { CorridorSegment } from "./CorridorSegment";
import type { CorridorStation } from "./CorridorStation";
import type { CorridorTakeoff } from "./CorridorTakeoff";

export type StationedCorridorStatus = "READY_FOR_PROPOSAL" | "READY_FOR_ENGINEERING" | "BLOCKED";

export interface StationedCorridor {
  stationedCorridorId: string;
  centerlineRouteId: string;
  routeRequestId: string;
  designDoctrineId: string;
  centerlineRoute: CenterlineRoute;
  stations: CorridorStation[];
  segments: CorridorSegment[];
  inventoryObjects: CorridorInventoryObject[];
  takeoff: CorridorTakeoff;
  status: StationedCorridorStatus;
  diagnostics: string[];
  noEngineeringCertification: true;
  salesEstimateOnly: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}
