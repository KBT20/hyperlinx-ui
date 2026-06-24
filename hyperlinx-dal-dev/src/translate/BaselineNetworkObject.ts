import type { CorridorLensObjectType } from "../corridor/CorridorLens";

export type BaselineNetworkObjectRole =
  | "ACCESS"
  | "AGGREGATION"
  | "BACKBONE"
  | "INTERCONNECTION"
  | "POWER_CONTEXT"
  | "TRANSPORT"
  | "WIRELESS"
  | "SEGMENT"
  | "CUSTOM";

export type BaselineNetworkObjectStatus = "SYNTHESIZED" | "REVIEW_REQUIRED" | "BLOCKED";

export interface BaselineNetworkObject {
  objectId: string;
  objectType: CorridorLensObjectType;
  objectName: string;
  objectRole: BaselineNetworkObjectRole;
  status: BaselineNetworkObjectStatus;
  quantity: number;
  designStandardIds: string[];
  objectCatalogReferences: CorridorLensObjectType[];
  evidenceIds: string[];
  traceability: {
    customerId: string;
    opportunityId: string;
    corridorId?: string;
    scopeVersionId?: string;
    architectureId: string;
  };
  notes?: string;
  nonAuthoritative: true;
}
