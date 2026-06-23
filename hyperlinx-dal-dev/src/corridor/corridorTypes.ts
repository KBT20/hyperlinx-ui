export type CorridorCoordinate = [longitude: number, latitude: number];

export type CorridorClass =
  | "METRO"
  | "MIDDLE_MILE"
  | "LONGHAUL"
  | "INTERSTATE"
  | "INTRASTATE"
  | "CAMPUS"
  | "REGIONAL"
  | "AI_CORRIDOR"
  | "INTERCONNECTION";

export type CorridorNetworkRole =
  | "CAMPUS"
  | "METRO_AGGREGATION"
  | "MSA_INTERCONNECT"
  | "BACKBONE_INTERCONNECT"
  | "AI_FABRIC"
  | "REGIONAL_AGGREGATION"
  | "INTERCONNECTION";

export type CorridorMsaRelationship =
  | "SAME_MSA"
  | "MSA_TO_MSA"
  | "REGIONAL_TO_MSA"
  | "INTERREGIONAL"
  | "UNKNOWN";

export type CorridorAggregationFunction =
  | "LSO_AGGREGATION"
  | "DATA_CENTER_AGGREGATION"
  | "AI_COMPUTE_AGGREGATION"
  | "REGIONAL_POP_AGGREGATION"
  | "TRANSPORT_BACKBONE"
  | "CAMPUS_DISTRIBUTION"
  | "INTERCONNECTION_HANDOFF"
  | "UNKNOWN";

export interface CorridorAggregationRole {
  aggregationFunction?: CorridorAggregationFunction;
  aggregationPointIds?: string[];
}

export type CorridorCustomerType =
  | "HYPERSCALER"
  | "NEOCLOUD"
  | "CARRIER"
  | "ISP"
  | "ENTERPRISE"
  | "MUNICIPAL"
  | "UTILITY";

export type CorridorStatus =
  | "DISCOVERED"
  | "NORMALIZED"
  | "SYNTHESIS_READY"
  | "CANDIDATE_GENERATED"
  | "PRISM_SCORED"
  | "ENGINEER_REVIEW"
  | "SCOPEVERSION_SELECTED"
  | "REJECTED"
  | "ARCHIVED";

export type CorridorTopology =
  | "LINEAR"
  | "RING"
  | "DUAL_RING"
  | "MULTI_RING"
  | "MESH"
  | "PROTECTED_PATH"
  | "DIVERSE_LINEAR";

export type CorridorCommercialPreference =
  | "DUCT_SALE"
  | "DARK_FIBER_IRU"
  | "TRANSPORT_RECURRING"
  | "HYBRID"
  | "LOWEST_NRC"
  | "LOWEST_MRC"
  | "FASTEST_DELIVERY"
  | "MAXIMUM_DIVERSITY";

export interface CorridorRequirement {
  requirementId: string;
  bandwidth?: string;
  serviceType?: "DUCT" | "DARK_FIBER" | "WAVE" | "ETHERNET" | "AI_INTERCONNECT" | "ROUTE_OPERATIONS";
  availabilityTarget?: string;
  designTopology: CorridorTopology;
  maxLatencyMs?: number;
  desiredDiversity?: "NONE" | "PATH_DIVERSE" | "ROUTE_DIVERSE" | "NODE_DIVERSE" | "GEO_DIVERSE";
  conduitCount?: number;
  fiberCount?: number;
  transportCapacity?: string;
  routeDiversityRequired: boolean;
  maintenanceRequirement?: string;
  restorationSLA?: string;
  commercialPreference?: CorridorCommercialPreference;
  evidenceIds: string[];
}

export interface Corridor {
  corridorId: string;
  corridorName: string;
  corridorClass: CorridorClass;
  networkRole?: CorridorNetworkRole;
  msaContext?: {
    aMsa?: string;
    zMsa?: string;
    sameMsa?: boolean;
    msaRelationship?: CorridorMsaRelationship;
  };
  aggregationRole?: CorridorAggregationRole;
  customerType: CorridorCustomerType;
  designObjective: string;
  endpointIds: string[];
  routeCandidateIds: string[];
  selectedScopeVersionId?: string;
  status: CorridorStatus;
  requirements: CorridorRequirement[];
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type CorridorEndpointType =
  | "DATA_CENTER"
  | "HYPERSCALER_CAMPUS"
  | "NEOCLOUD_FACILITY"
  | "CARRIER_HOTEL"
  | "CLOUD_ONRAMP"
  | "IX"
  | "GPU_FACILITY"
  | "POWER_SITE"
  | "ENTERPRISE_CAMPUS"
  | "MUNICIPAL_SITE";

export type CorridorEndpointRole = "A_END" | "Z_END" | "INTERMEDIATE" | "REGEN" | "INTERCONNECT";

export interface CorridorEndpoint {
  endpointId: string;
  name: string;
  type: CorridorEndpointType;
  address?: string;
  latitude?: number;
  longitude?: number;
  owner?: string;
  role: CorridorEndpointRole;
  evidenceIds: string[];
}

export type CorridorRouteCandidateSource =
  | "CUSTOMER_SUPPLIED"
  | "OSRM"
  | "GRAPHOPPER"
  | "OPENROUTESERVICE"
  | "GOOGLE_ROADS"
  | "DOT_GIS"
  | "HUMAN_ENGINEERED"
  | "HYBRID";

export type CorridorRouteClass =
  | "PRIMARY"
  | "DIVERSE"
  | "LOW_LATENCY"
  | "LOW_COST"
  | "LOW_RISK"
  | "MONETIZATION_OPTIMIZED"
  | "REFERENCE_ONLY";

export interface CorridorRouteCandidate {
  routeCandidateId: string;
  corridorId: string;
  source: CorridorRouteCandidateSource;
  geometry: CorridorCoordinate[];
  distanceMiles: number;
  estimatedLatencyMs?: number;
  routeClass: CorridorRouteClass;
  diversityGroupId?: string;
  constructabilityScore?: number;
  riskScore?: number;
  monetizationScore?: number;
  score?: number;
  evidenceIds: string[];
}

export interface ConduitSystem {
  conduitSystemId: string;
  corridorId: string;
  ductCount: number;
  ductSize?: string;
  occupiedDucts: number;
  reservedDucts: number;
  availableDucts: number;
  owner?: string;
  saleEligible: boolean;
  maintenanceRequired: boolean;
  maintenanceModel?: "OWNER_MAINTAINED" | "CUSTOMER_MAINTAINED" | "THIRD_PARTY" | "UNKNOWN";
  evidenceIds: string[];
}

export interface FiberStrandGroup {
  strandGroupId: string;
  strandCount: number;
  use: "CUSTOMER_RESERVED" | "TRANSPORT" | "MAINTENANCE" | "MONETIZATION" | "SPARE";
}

export interface FiberSystem {
  fiberSystemId: string;
  corridorId: string;
  fiberCount: number;
  fiberType?: "SMF" | "NZDSF" | "ULTRA_LOW_LOSS" | "UNKNOWN";
  strandGroups: FiberStrandGroup[];
  reservedStrands: number;
  availableStrands: number;
  iruEligible: boolean;
  transportEligible: boolean;
  evidenceIds: string[];
}

export type OpticalServiceStandard = "MEF" | "SONET" | "ETHERNET" | "DWDM" | "OTN" | "400G" | "800G" | "1.6T_FUTURE_READY";

export interface OpticalSystem {
  opticalSystemId: string;
  corridorId: string;
  designCapacity?: string;
  waveCapacity?: string;
  amplificationRequired: boolean;
  regenRequired: boolean;
  maxSpanMiles?: number;
  topology: CorridorTopology;
  serviceStandards: OpticalServiceStandard[];
  evidenceIds: string[];
}

export type InterconnectionNodeType =
  | "MEET_ME_ROOM"
  | "CLOUD_ONRAMP"
  | "IX_NODE"
  | "CARRIER_NODE"
  | "REGEN_NODE"
  | "POWER_INTERCONNECT"
  | "CUSTOMER_HANDOFF";

export interface InterconnectionNode {
  interconnectionNodeId: string;
  type: InterconnectionNodeType;
  facilityName: string;
  owner?: string;
  latitude?: number;
  longitude?: number;
  meetMeAvailable: boolean;
  cloudOnRampAvailable: boolean;
  crossConnectAvailable: boolean;
  strategicValue?: number;
  evidenceIds: string[];
}

export interface RegenerationSite {
  regenSiteId: string;
  corridorId: string;
  latitude?: number;
  longitude?: number;
  spacingMiles?: number;
  powerAvailable: boolean;
  generatorRequired: boolean;
  fuelRequirement?: string;
  securityRequirement?: string;
  shelterType?: "HUT" | "CABINET" | "COLO" | "CUSTOMER_FACILITY" | "UNKNOWN";
  opticalReason?: string;
  evidenceIds: string[];
}

export type JurisdictionType = "DOT" | "COUNTY" | "CITY" | "RAILROAD" | "UTILITY" | "FEDERAL" | "TRIBAL" | "PRIVATE";

export interface Jurisdiction {
  jurisdictionId: string;
  type: JurisdictionType;
  name: string;
  segmentIds: string[];
  permitRequired: boolean;
  permitComplexity?: number;
  expectedLeadTimeDays?: number;
  evidenceIds: string[];
}

export type CrossingType = "ROAD" | "HIGHWAY" | "RAIL" | "RIVER" | "CANAL" | "BRIDGE" | "PIPELINE" | "TRANSMISSION" | "ENVIRONMENTAL";
export type CrossingMethod = "BORE" | "BRIDGE_ATTACH" | "AERIAL" | "TRENCH" | "PLOW" | "EXISTING_CONDUIT" | "UNKNOWN";

export interface Crossing {
  crossingId: string;
  type: CrossingType;
  owner?: string;
  method: CrossingMethod;
  estimatedCost?: number;
  permitRequired: boolean;
  riskScore?: number;
  evidenceIds: string[];
}

export type ConstraintType =
  | "POWER"
  | "FIBER"
  | "ROW"
  | "RAIL"
  | "WATER"
  | "PERMIT"
  | "BUDGET"
  | "LATENCY"
  | "DIVERSITY"
  | "ENVIRONMENTAL"
  | "CONSTRUCTION";

export interface Constraint {
  constraintId: string;
  type: ConstraintType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedSegmentIds: string[];
  mitigation?: string;
  evidenceIds: string[];
}

export type UtilityAssetType = "ELECTRIC" | "GAS" | "WATER" | "WASTEWATER" | "TRANSMISSION" | "SUBSTATION";

export interface UtilityAsset {
  utilityAssetId: string;
  type: UtilityAssetType;
  owner?: string;
  latitude?: number;
  longitude?: number;
  distanceToCorridor?: number;
  capacityKnown: boolean;
  evidenceIds: string[];
}

export interface ServiceZone {
  serviceZoneId: string;
  restorationSLA?: string;
  nearestCrewBase?: string;
  truckRollDistance?: number;
  sparesLocation?: string;
  maintenanceCost?: number;
  riskScore?: number;
  evidenceIds: string[];
}

export interface ResidualCapacity {
  residualCapacityId: string;
  corridorId: string;
  ductAvailable?: number;
  fiberAvailable?: number;
  transportAvailable?: string;
  monetizationEligible: boolean;
  estimatedResidualValue?: number;
  evidenceIds: string[];
}

export type MonetizationOpportunityType =
  | "ISP"
  | "WISP"
  | "WIRELESS_TOWER"
  | "ENTERPRISE"
  | "SCHOOL"
  | "MUNICIPAL"
  | "UTILITY"
  | "DATA_CENTER"
  | "CARRIER"
  | "GOVERNMENT";

export interface MonetizationOpportunity {
  opportunityId: string;
  corridorId: string;
  type: MonetizationOpportunityType;
  name: string;
  latitude?: number;
  longitude?: number;
  distanceToCorridor?: number;
  requiredProduct?: CorridorProductType;
  estimatedNRC?: number;
  estimatedMRC?: number;
  estimatedTCV?: number;
  likelihood?: number;
  evidenceIds: string[];
}

export type CorridorProductType =
  | "DUCT_SALE"
  | "DUCT_MAINTENANCE"
  | "DARK_FIBER_IRU"
  | "MANAGED_FIBER"
  | "WAVE_SERVICE"
  | "ETHERNET_TRANSPORT"
  | "AI_INTERCONNECT"
  | "ROUTE_OPERATIONS";

export interface CorridorProduct {
  productId: string;
  corridorId: string;
  productType: CorridorProductType;
  commercialModel: "SALE" | "IRU" | "RECURRING" | "MAINTENANCE" | "HYBRID";
  nrc?: number;
  mrc?: number;
  termMonths?: number;
  capacity?: string;
  availabilityTarget?: string;
  sla?: string;
  evidenceIds: string[];
}

export type CorridorEvidenceSourceType =
  | "CUSTOMER_ROUTE_FILE"
  | "ENDPOINT_CSV"
  | "KML_KMZ"
  | "GEOJSON"
  | "SHAPEFILE"
  | "DOT_GIS"
  | "OSRM"
  | "GRAPHOPPER"
  | "OPENROUTESERVICE"
  | "POWER_DATASET"
  | "PARCEL_DATASET"
  | "DATA_CENTER_DATASET"
  | "HUMAN_ENGINEERING_REVIEW"
  | "FIELD_VALIDATION"
  | "PERMIT_RECORD";

export type CorridorEvidenceEntityType =
  | "CORRIDOR"
  | "ENDPOINT"
  | "ROUTE_CANDIDATE"
  | "CONDUIT_SYSTEM"
  | "FIBER_SYSTEM"
  | "OPTICAL_SYSTEM"
  | "INTERCONNECTION_NODE"
  | "REGENERATION_SITE"
  | "JURISDICTION"
  | "CROSSING"
  | "CONSTRAINT"
  | "UTILITY_ASSET"
  | "SERVICE_ZONE"
  | "RESIDUAL_CAPACITY"
  | "MONETIZATION_OPPORTUNITY"
  | "PRODUCT"
  | "SCOPEVERSION_REFERENCE";

export interface CorridorEvidence {
  evidenceId: string;
  sourceType: CorridorEvidenceSourceType;
  sourceName: string;
  collectedAt: string;
  confidence: number;
  entityType: CorridorEvidenceEntityType;
  entityId: string;
  rawReference?: string;
  normalizedValue?: unknown;
  notes?: string;
}

export type CorridorAuthorityOwner =
  | "TRANSLATE"
  | "CORRIDOR_SYNTHESIS"
  | "PRISM"
  | "MARKETPLACE"
  | "KERNEL"
  | "TWIN"
  | "OPERATIONAL_INTELLIGENCE"
  | "HUMAN_ENGINEERING";
