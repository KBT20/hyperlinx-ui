export type CorridorInventoryObjectType =
  | "DUCT"
  | "FIBER"
  | "VAULT"
  | "HANDHOLE"
  | "REGEN_SITE"
  | "SPLICE_POINT"
  | "MARKER_POST"
  | "ROAD_CROSSING"
  | "RAIL_CROSSING"
  | "WATER_CROSSING"
  | "BRIDGE_CROSSING"
  | "UNKNOWN_CONSTRAINT";

export interface CorridorInventoryObject {
  objectId: string;
  objectType: CorridorInventoryObjectType;
  stationId: string;
  stationLabel: string;
  lat: number;
  lng: number;
  quantity: number;
  unit: "EACH" | "FOOT";
  materialProfile: string;
  installMethod: string;
  estimatedCost: number;
  status: "PROPOSED";
  engineeringStatus: "PENDING_VERIFICATION";
  metadata: Record<string, unknown>;
}
