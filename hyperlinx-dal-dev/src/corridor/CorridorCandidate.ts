import type {
  CorridorClass,
  CorridorCoordinate,
  CorridorCustomerType,
  CorridorTopology,
} from "./corridorTypes";

export type CorridorCandidateType =
  | "PRIMARY"
  | "DIVERSE"
  | "LOW_LATENCY"
  | "LOW_COST"
  | "LOW_RISK"
  | "EXPANSION"
  | "AI_CORRIDOR"
  | "CUSTOMER_SUPPLIED"
  | "HYBRID";

export type CorridorCandidateSource =
  | "ENDPOINT_PAIR"
  | "CUSTOMER_ROUTE"
  | "KML"
  | "KMZ"
  | "GEOJSON"
  | "SHAPEFILE"
  | "CORRIDOR_CONCEPT"
  | "EXISTING_FIBER_ROUTE"
  | "EXISTING_CONDUIT_ROUTE"
  | "PROVIDER_GENERATED"
  | "HUMAN_ENGINEERED"
  | "HYBRID";

export type CorridorDiversityLevel =
  | "NO_DIVERSITY"
  | "PARTIAL_DIVERSITY"
  | "SUBSTANTIAL_DIVERSITY"
  | "FULL_DIVERSITY"
  | "UNKNOWN";

export type CorridorCandidateAttributeType =
  | "POWER_PROXIMITY"
  | "SUBSTATION_PROXIMITY"
  | "TRANSMISSION_PROXIMITY"
  | "DATA_CENTER_PROXIMITY"
  | "CARRIER_HOTEL_PROXIMITY"
  | "CLOUD_ONRAMP_PROXIMITY"
  | "INTERCONNECTION_DENSITY"
  | "EXPANSION_LAND"
  | "FUTURE_AI_DEMAND"
  | "LATENCY_SENSITIVITY"
  | "ROUTE_DIVERSITY"
  | "MONETIZATION_POTENTIAL"
  | "CONSTRUCTABILITY_SIGNAL"
  | "PERMITTING_SIGNAL";

export interface CorridorCandidateAttribute {
  attributeId: string;
  candidateId: string;
  type: CorridorCandidateAttributeType;
  label: string;
  value: string | number | boolean;
  unit?: string;
  confidence?: number;
  evidenceIds: string[];
}

export interface CorridorCandidateSegment {
  segmentId: string;
  candidateId: string;
  sequence: number;
  geometry: CorridorCoordinate[];
  distanceMiles?: number;
  jurisdictionIds: string[];
  crossingIds: string[];
  constraintIds: string[];
  evidenceIds: string[];
}

export interface CorridorCandidateScorePlaceholder {
  candidateId: string;
  scoreModel: "UNSCORED" | "PRISM_PENDING" | "HUMAN_REVIEW_PENDING";
  score?: number;
  latencyPlaceholder?: number;
  constructabilityPlaceholder?: number;
  diversityPlaceholder?: number;
  costPlaceholder?: number;
  riskPlaceholder?: number;
  monetizationPlaceholder?: number;
  notes?: string;
}

export interface CorridorCandidate {
  candidateId: string;
  corridorId: string;
  candidateType: CorridorCandidateType;
  candidateSource: CorridorCandidateSource;
  corridorClass?: CorridorClass;
  customerType?: CorridorCustomerType;
  topologyIntent?: CorridorTopology;
  name: string;
  description?: string;
  endpointIds: string[];
  requirementIds: string[];
  geometry: CorridorCoordinate[];
  distanceMiles?: number;
  estimatedLatencyMs?: number;
  providerIds: string[];
  sourceEvidenceIds: string[];
  preservedCustomerRouteEvidenceIds: string[];
  segmentIds: string[];
  attributes: CorridorCandidateAttribute[];
  diversityGroupId?: string;
  diversityLevel?: CorridorDiversityLevel;
  diversityEvidenceIds: string[];
  scorePlaceholder: CorridorCandidateScorePlaceholder;
  promotionEligible: boolean;
  createdAt: string;
}

