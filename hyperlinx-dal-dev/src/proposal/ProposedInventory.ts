import type { TeralinxNetworkType, TeralinxPrimaryProduct, TeralinxProtection } from "../teralinx/TeralinxDesignIntent";

export type EstimatedConstructionType = "BURIED" | "AERIAL" | "MIXED" | "UNKNOWN";

export interface ProposedInventory {
  proposalId: string;
  proposedGraphId?: string;
  routeCandidateId?: string;
  centerlineRouteId?: string;
  stationedCorridorId?: string;
  takeoffId?: string;
  customerId: string;
  opportunityId: string;
  routeRequestId: string;
  networkType: TeralinxNetworkType;
  protection: TeralinxProtection;
  primaryProduct: TeralinxPrimaryProduct;
  estimatedMileage: number;
  estimatedSegments: number;
  estimatedStations: number;
  estimatedCrossings: number;
  estimatedVaults: number;
  estimatedFiberFeet: number;
  estimatedDuctFeet: number;
  estimatedConstructionType: EstimatedConstructionType;
  generatedAt: string;
  readOnly: true;
  noInventoryCreation: true;
  noScopeVersionCreation: true;
  noGraphMutation: true;
}
