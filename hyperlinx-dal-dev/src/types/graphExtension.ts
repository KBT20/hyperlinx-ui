import type { DALCoordinate } from "./dal";

export type GraphExtensionStatus = "DRAFT" | "CANDIDATE" | "APPROVED" | "ACTIVE" | "SUPERSEDED";

export type GraphExtensionType =
  | "NEW_ROUTE"
  | "NEW_NODE"
  | "NEW_STATION"
  | "BUILDING_CONNECTION"
  | "LATERAL_BUILD"
  | "REGENERATION_SITE"
  | "DATA_CENTER_CONNECTION";

export type GraphExtensionNode = {
  extensionNodeId: string;
  lat: number;
  lng: number;
  name: string;
  type: string;
  source: string;
};

export type GraphExtensionEdge = {
  extensionEdgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  lengthFeet: number;
  geometry: DALCoordinate[];
  source: string;
};

export type GraphExtensionRoute = {
  extensionRouteId: string;
  name: string;
  geometry: DALCoordinate[];
  lengthFeet?: number;
  source: string;
};

export type GraphExtensionStation = {
  extensionStationId: string;
  routeId?: string;
  lat: number;
  lng: number;
  feet: number;
  label: string;
  source: string;
};

export type GraphExtension = {
  extensionId: string;
  inventoryId: string;
  graphId: string;
  type: GraphExtensionType;
  status: GraphExtensionStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  nodes: GraphExtensionNode[];
  edges: GraphExtensionEdge[];
  stations: GraphExtensionStation[];
  routes: GraphExtensionRoute[];
};

export type ScopeVersion = {
  scopeVersionId: string;
  inventoryId: string;
  graphId: string;
  extensionIds: string[];
  status: GraphExtensionStatus;
  createdAt: string;
  updatedAt: string;
};
