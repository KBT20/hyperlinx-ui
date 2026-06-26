export type ProposedGraphNodeType =
  | "A_SITE"
  | "Z_SITE"
  | "INTERMEDIATE_SITE"
  | "VAULT"
  | "REGENERATION_SITE"
  | "POP"
  | "CARRIER_HOTEL"
  | "DATA_CENTER"
  | "SPLICE"
  | "CABINET";

export type ProposedGraphConstructionType = "BURIED" | "AERIAL" | "MIXED" | "UNKNOWN";

export type ProposedGraphNodeStatus = "PROPOSED" | "CUSTOMER_REVIEW" | "CUSTOMER_APPROVED" | "BLOCKED";

export interface ProposedGraphNode {
  id: string;
  type: ProposedGraphNodeType;
  name: string;
  lat: number;
  lng: number;
  stationLabel: string;
  estimatedCost: number;
  estimatedConstructionType: ProposedGraphConstructionType;
  status: ProposedGraphNodeStatus;
  comments: string[];
  confidence: number;
  readiness: "READY_FOR_PROPOSAL" | "READY_FOR_ENGINEERING" | "BLOCKED";
  metadata: Record<string, unknown>;
  readOnly: true;
}
