import type { DALCoordinate } from "../types/dal";

export interface CorridorStation {
  stationId: string;
  stationLabel: string;
  stationFeet: number;
  stationMiles: number;
  lat: number;
  lng: number;
  coordinate: DALCoordinate;
  visibleAtZoom: {
    stationMarkerVisibleZoom: number;
    stationLabelVisibleZoom: number;
  };
  inventoryObjectIds: string[];
  engineeringStatus: "PENDING_VERIFICATION";
  metadata: Record<string, unknown>;
}
