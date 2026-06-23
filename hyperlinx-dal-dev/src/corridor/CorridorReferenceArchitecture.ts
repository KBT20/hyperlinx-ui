import type { CorridorClass, CorridorNetworkRole } from "./corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "./CorridorLens";

export type ReferenceArchitectureType =
  | "HYPERSCALER_LONG_HAUL"
  | "HYPERSCALER_METRO"
  | "HYPERSCALER_MSA_INTERCONNECT"
  | "NEOCLOUD_INTERCONNECT"
  | "AI_POWER_EXPANSION"
  | "DARK_FIBER_IRU"
  | "DUCT_SALE_AND_MAINTENANCE"
  | "TRANSPORT_WAVE"
  | "ENTERPRISE_METRO_ACCESS"
  | "INTERCONNECTION_FABRIC"
  | "CARRIER_WHOLESALE"
  | "REGIONAL_AGGREGATION"
  | "CAMPUS_INTERCONNECT";

export type ReferenceArchitectureToolCategory =
  | "ROUTING"
  | "GIS_EVIDENCE"
  | "POWER"
  | "INTERCONNECTION"
  | "DESIGN_ENGINEERING"
  | "COMMERCIAL";

export type ReferenceArchitectureToolType =
  | "OSRM"
  | "GRAPHHOPPER"
  | "OPENROUTESERVICE"
  | "GOOGLE_ROADS"
  | "TERALINX_INTERNAL_CORRIDOR_MODEL"
  | "SHAPEFILE_TRANSLATE"
  | "KML_KMZ_TRANSLATE"
  | "GEOJSON_TRANSLATE"
  | "CSV_TRANSLATE"
  | "DOT_GIS"
  | "COUNTY_GIS"
  | "MUNICIPAL_GIS"
  | "UTILITY_GIS"
  | "PARCEL_GIS"
  | "SUBSTATION_PROVIDER"
  | "TRANSMISSION_PROVIDER"
  | "GENERATION_PROVIDER"
  | "POWER_PROXIMITY_EVALUATION"
  | "DATA_CENTER_PROVIDER"
  | "CARRIER_HOTEL_PROVIDER"
  | "IX_PROVIDER"
  | "CLOUD_ONRAMP_PROVIDER"
  | "OPTICAL_REACH_REVIEW"
  | "REGEN_SPACING_REVIEW"
  | "ADM_PLACEMENT_REVIEW"
  | "FIBER_COUNT_PLANNING"
  | "DUCT_CAPACITY_PLANNING"
  | "ROUTE_DIVERSITY_REVIEW"
  | "CROSSING_REVIEW"
  | "JURISDICTION_REVIEW"
  | "RESTORATION_REVIEW"
  | "MAINTENANCE_ACCESS_REVIEW"
  | "DUCT_SALE_MODEL"
  | "DARK_FIBER_IRU_MODEL"
  | "TRANSPORT_REVENUE_MODEL"
  | "RESIDUAL_CAPACITY_MODEL"
  | "ENTERPRISE_MONETIZATION_MODEL"
  | "HYPERSCALER_BUSINESS_CASE_MODEL";

export type ReferenceArchitectureFitLevel = "STRONG" | "MODERATE" | "WEAK" | "NOT_APPLICABLE";

export type ReferenceArchitectureDiagnosticCode =
  | "REFERENCE_ARCHITECTURE_MATCH_STARTED"
  | "REFERENCE_ARCHITECTURE_MATCHED"
  | "REFERENCE_ARCHITECTURE_TOOL_REQUIRED"
  | "REFERENCE_ARCHITECTURE_OBJECT_REQUIRED"
  | "REFERENCE_ARCHITECTURE_STANDARD_REQUIRED"
  | "REFERENCE_ARCHITECTURE_FIT_COMPLETE"
  | "REFERENCE_ARCHITECTURE_WARNING";

export interface ReferenceArchitectureToolRequirement {
  toolType: ReferenceArchitectureToolType;
  category: ReferenceArchitectureToolCategory;
  purpose: string;
  required: boolean;
  evidenceExpected: string[];
}

export interface ReferenceArchitectureComponent {
  componentId: string;
  componentName: string;
  purpose: string;
  requiredObjects: CorridorLensObjectType[];
  requiredStandards: string[];
  requiredTools: ReferenceArchitectureToolType[];
  humanReviewBoundary: string;
  routeEngineeringOutput: string;
}

export interface ReferenceArchitectureTopology {
  topologyType: "LINEAR" | "RING" | "DUAL_RING" | "MESH" | "HUB_AND_SPOKE" | "FABRIC" | "CAMPUS";
  diversityExpected: boolean;
  interconnectionExpected: boolean;
  notes: string;
}

export interface ReferenceArchitectureCapacityModel {
  capacityIntent: "DUCT" | "DARK_FIBER" | "TRANSPORT" | "HYBRID" | "ENTERPRISE_SERVICE" | "AI_EXPANSION";
  capacityQuestions: string[];
  routeEngineeringBoundary: string;
}

export interface ReferenceArchitectureProtectionModel {
  protectionIntent: "NONE" | "RESTORABLE" | "PROTECTED" | "DIVERSE" | "CUSTOMER_DEFINED";
  restorationQuestions: string[];
  routeEngineeringBoundary: string;
}

export interface ReferenceArchitectureExpansionModel {
  expansionIntent: "NONE" | "SPARE_DUCT" | "SPARE_STRANDS" | "AI_CAMPUS" | "REGIONAL_GROWTH" | "CUSTOMER_GROWTH";
  expansionQuestions: string[];
  routeEngineeringBoundary: string;
}

export interface ReferenceArchitectureValidationFinding {
  findingId: string;
  severity: "INFO" | "WARNING" | "BLOCKING_CONTEXT";
  message: string;
  relatedObjects?: CorridorLensObjectType[];
  relatedTools?: ReferenceArchitectureToolType[];
  relatedStandards?: string[];
}

export interface ReferenceArchitectureDiagnostic {
  code: ReferenceArchitectureDiagnosticCode;
  architectureId?: string;
  message: string;
  severity: "INFO" | "WARNING";
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ReferenceArchitecture {
  architectureId: string;
  architectureName: string;
  architectureType: ReferenceArchitectureType;
  applicableLensTypes: CorridorLensType[];
  applicableNetworkRoles: CorridorNetworkRole[];
  applicableCorridorClasses: CorridorClass[];
  customerAskPatterns: string[];
  requiredObjects: CorridorLensObjectType[];
  optionalObjects: CorridorLensObjectType[];
  requiredDesignStandards: string[];
  requiredTools: ReferenceArchitectureToolRequirement[];
  components: ReferenceArchitectureComponent[];
  topology: ReferenceArchitectureTopology;
  protectionModel: ReferenceArchitectureProtectionModel;
  capacityModel: ReferenceArchitectureCapacityModel;
  expansionModel: ReferenceArchitectureExpansionModel;
  commercialProducts: string[];
  engineeringReviewRequired: boolean;
  salesEditable: boolean;
  notes: string;
}

export interface ReferenceArchitectureFit {
  architectureId: string;
  fitLevel: ReferenceArchitectureFitLevel;
  matchedLensTypes: CorridorLensType[];
  matchedNetworkRoles: CorridorNetworkRole[];
  matchedCorridorClasses: CorridorClass[];
  matchedCustomerAskPatterns: string[];
  requiredObjects: CorridorLensObjectType[];
  missingObjects: CorridorLensObjectType[];
  requiredTools: ReferenceArchitectureToolRequirement[];
  missingToolEvidence: ReferenceArchitectureToolRequirement[];
  requiredStandards: string[];
  engineeringReviewRequired: boolean;
  warnings: string[];
  diagnostics: ReferenceArchitectureValidationFinding[];
}

function tool(
  toolType: ReferenceArchitectureToolType,
  category: ReferenceArchitectureToolCategory,
  purpose: string,
  evidenceExpected: string[],
  required = true,
): ReferenceArchitectureToolRequirement {
  return { toolType, category, purpose, evidenceExpected, required };
}

function component(input: ReferenceArchitectureComponent): ReferenceArchitectureComponent {
  return Object.freeze(input);
}

function architecture(input: ReferenceArchitecture): ReferenceArchitecture {
  return Object.freeze(input);
}

export const REFERENCE_ARCHITECTURE_COMPONENTS: readonly ReferenceArchitectureComponent[] = Object.freeze([
  component({
    componentId: "COMPONENT-CONDUIT-SYSTEM",
    componentName: "Conduit System",
    purpose: "Define conduit, duct, access, and residual capacity expectations.",
    requiredObjects: ["CONDUIT", "INNERDUCT", "RIGHT_OF_WAY"],
    requiredStandards: ["STANDARD-CONDUIT-001"],
    requiredTools: ["DUCT_CAPACITY_PLANNING", "RESIDUAL_CAPACITY_MODEL", "JURISDICTION_REVIEW"],
    humanReviewBoundary: "Route Engineering validates duct count, sale eligibility, and maintenance rights.",
    routeEngineeringOutput: "Approved conduit capacity and access assumptions.",
  }),
  component({
    componentId: "COMPONENT-FIBER-SYSTEM",
    componentName: "Fiber System",
    purpose: "Define fiber count, strand reservation, service eligibility, and growth capacity.",
    requiredObjects: ["FIBER", "FIBER_PAIR", "SPLICE"],
    requiredStandards: ["STANDARD-FIBER-001"],
    requiredTools: ["FIBER_COUNT_PLANNING", "DARK_FIBER_IRU_MODEL"],
    humanReviewBoundary: "Route Engineering validates fiber capacity and product eligibility.",
    routeEngineeringOutput: "Approved fiber and strand capacity basis.",
  }),
  component({
    componentId: "COMPONENT-OPTICAL-SYSTEM",
    componentName: "Optical System",
    purpose: "Define optical reach, wavelength, latency, and platform expectations.",
    requiredObjects: ["REGEN_SITE", "ADM_SITE", "POP"],
    requiredStandards: ["STANDARD-REGEN-SITE-001", "STANDARD-ADM-SITE-001"],
    requiredTools: ["OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ADM_PLACEMENT_REVIEW"],
    humanReviewBoundary: "Sales may not set optical reach, regen spacing, or ADM placement.",
    routeEngineeringOutput: "Reviewed optical and topology assumptions.",
  }),
  component({
    componentId: "COMPONENT-INTERCONNECTION",
    componentName: "Interconnection Plan",
    purpose: "Define handoff, carrier hotel, IX, cloud on-ramp, and cross-connect expectations.",
    requiredObjects: ["DATA_CENTER", "CARRIER_HOTEL", "IX", "CLOUD_ONRAMP"],
    requiredStandards: ["STANDARD-DATA-CENTER-001", "STANDARD-CARRIER-HOTEL-001", "STANDARD-CLOUD-ONRAMP-001", "STANDARD-IX-001"],
    requiredTools: ["DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "IX_PROVIDER", "CLOUD_ONRAMP_PROVIDER"],
    humanReviewBoundary: "Route Engineering validates handoff feasibility and service design.",
    routeEngineeringOutput: "Reviewed handoff and interconnection basis.",
  }),
  component({
    componentId: "COMPONENT-POWER-PROXIMITY",
    componentName: "Power Proximity Plan",
    purpose: "Define power-adjacent evidence for AI, hyperscaler, and expansion corridors.",
    requiredObjects: ["SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "POWER_FEED"],
    requiredStandards: ["STANDARD-SUBSTATION-001", "STANDARD-TRANSMISSION-001"],
    requiredTools: ["SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER", "GENERATION_PROVIDER", "POWER_PROXIMITY_EVALUATION"],
    humanReviewBoundary: "Power proximity is not capacity; Route Engineering requires evidence before capacity claims.",
    routeEngineeringOutput: "Reviewed power evidence context.",
  }),
  component({
    componentId: "COMPONENT-ROUTE-DIVERSITY",
    componentName: "Route Diversity Plan",
    purpose: "Define diversity, shared ROW, shared structure, and restoration expectations.",
    requiredObjects: ["RIGHT_OF_WAY", "CROSSING", "CONSTRAINT"],
    requiredStandards: ["STANDARD-CROSSING-001", "STANDARD-CONSTRAINT-001"],
    requiredTools: ["ROUTE_DIVERSITY_REVIEW", "DOT_GIS", "CROSSING_REVIEW"],
    humanReviewBoundary: "Route Engineering determines whether diversity is sufficient.",
    routeEngineeringOutput: "Approved or redlined diversity basis.",
  }),
  component({
    componentId: "COMPONENT-MAINTENANCE",
    componentName: "Maintenance Plan",
    purpose: "Define access, maintenance windows, repair rights, and operational constraints.",
    requiredObjects: ["MAINTENANCE_ZONE", "RIGHT_OF_WAY", "CONDUIT"],
    requiredStandards: ["STANDARD-CONDUIT-001", "STANDARD-JURISDICTION-001"],
    requiredTools: ["MAINTENANCE_ACCESS_REVIEW", "MUNICIPAL_GIS", "COUNTY_GIS"],
    humanReviewBoundary: "Route Engineering and operations validate maintainability.",
    routeEngineeringOutput: "Maintenance access and responsibility basis.",
  }),
  component({
    componentId: "COMPONENT-RESTORATION",
    componentName: "Restoration Plan",
    purpose: "Define restoration, SLA, protected path, and repair assumptions.",
    requiredObjects: ["RESTORATION_ZONE", "CROSSING", "CONSTRAINT"],
    requiredStandards: ["STANDARD-CROSSING-001", "STANDARD-CONSTRAINT-001"],
    requiredTools: ["RESTORATION_REVIEW", "ROUTE_DIVERSITY_REVIEW"],
    humanReviewBoundary: "Route Engineering validates restoration design and SLA feasibility.",
    routeEngineeringOutput: "Reviewed restoration assumptions.",
  }),
  component({
    componentId: "COMPONENT-PERMITTING-JURISDICTION",
    componentName: "Permitting / Jurisdiction Plan",
    purpose: "Define permit owners, lead times, authority, and jurisdiction risk.",
    requiredObjects: ["JURISDICTION", "PERMIT_ZONE", "CROSSING"],
    requiredStandards: ["STANDARD-JURISDICTION-001", "STANDARD-CROSSING-001"],
    requiredTools: ["JURISDICTION_REVIEW", "MUNICIPAL_GIS", "COUNTY_GIS", "DOT_GIS"],
    humanReviewBoundary: "Permitting assumptions remain evidence until reviewed.",
    routeEngineeringOutput: "Reviewed permit and jurisdiction context.",
  }),
  component({
    componentId: "COMPONENT-CROSSING",
    componentName: "Crossing Plan",
    purpose: "Define crossing method, owner, permit, cost, and schedule risk.",
    requiredObjects: ["CROSSING", "CONSTRAINT"],
    requiredStandards: ["STANDARD-CROSSING-001", "STANDARD-CONSTRAINT-001"],
    requiredTools: ["CROSSING_REVIEW", "DOT_GIS", "MUNICIPAL_GIS"],
    humanReviewBoundary: "Route Engineering validates crossing method and risk.",
    routeEngineeringOutput: "Reviewed crossing basis.",
  }),
  component({
    componentId: "COMPONENT-EVIDENCE",
    componentName: "Evidence Plan",
    purpose: "Define the evidence formats and providers required for architecture review.",
    requiredObjects: ["CONSTRAINT", "JURISDICTION"],
    requiredStandards: ["STANDARD-CONSTRAINT-001", "STANDARD-JURISDICTION-001"],
    requiredTools: ["CSV_TRANSLATE", "KML_KMZ_TRANSLATE", "GEOJSON_TRANSLATE", "SHAPEFILE_TRANSLATE"],
    humanReviewBoundary: "Evidence can be incomplete; Route Engineering requests missing inputs.",
    routeEngineeringOutput: "Evidence completeness and missing-input list.",
  }),
]);

function tools(...toolTypes: ReferenceArchitectureToolType[]): ReferenceArchitectureToolRequirement[] {
  const defaults: Record<ReferenceArchitectureToolType, ReferenceArchitectureToolRequirement> = {
    OSRM: tool("OSRM", "ROUTING", "Reference road-following evidence where applicable.", ["route geometry evidence"]),
    GRAPHHOPPER: tool("GRAPHHOPPER", "ROUTING", "Alternative route evidence provider.", ["route geometry evidence"], false),
    OPENROUTESERVICE: tool("OPENROUTESERVICE", "ROUTING", "Alternative route evidence provider.", ["route geometry evidence"], false),
    GOOGLE_ROADS: tool("GOOGLE_ROADS", "ROUTING", "Road snap and road context evidence.", ["road snap evidence"], false),
    TERALINX_INTERNAL_CORRIDOR_MODEL: tool("TERALINX_INTERNAL_CORRIDOR_MODEL", "ROUTING", "Internal corridor synthesis evidence.", ["corridor candidate evidence"]),
    SHAPEFILE_TRANSLATE: tool("SHAPEFILE_TRANSLATE", "GIS_EVIDENCE", "Normalize GIS shapefile evidence.", ["GIS source evidence"]),
    KML_KMZ_TRANSLATE: tool("KML_KMZ_TRANSLATE", "GIS_EVIDENCE", "Normalize KML or KMZ evidence.", ["KML/KMZ source evidence"]),
    GEOJSON_TRANSLATE: tool("GEOJSON_TRANSLATE", "GIS_EVIDENCE", "Normalize GeoJSON evidence.", ["GeoJSON source evidence"]),
    CSV_TRANSLATE: tool("CSV_TRANSLATE", "GIS_EVIDENCE", "Normalize CSV endpoint and object evidence.", ["CSV source evidence"]),
    DOT_GIS: tool("DOT_GIS", "GIS_EVIDENCE", "Provide DOT route, ROW, and crossing evidence.", ["DOT evidence"]),
    COUNTY_GIS: tool("COUNTY_GIS", "GIS_EVIDENCE", "Provide county parcel and jurisdiction evidence.", ["county GIS evidence"]),
    MUNICIPAL_GIS: tool("MUNICIPAL_GIS", "GIS_EVIDENCE", "Provide city permit and municipal evidence.", ["municipal GIS evidence"]),
    UTILITY_GIS: tool("UTILITY_GIS", "GIS_EVIDENCE", "Provide utility corridor evidence.", ["utility GIS evidence"]),
    PARCEL_GIS: tool("PARCEL_GIS", "GIS_EVIDENCE", "Provide parcel and ownership context.", ["parcel evidence"]),
    SUBSTATION_PROVIDER: tool("SUBSTATION_PROVIDER", "POWER", "Provide substation location and identity evidence.", ["substation evidence"]),
    TRANSMISSION_PROVIDER: tool("TRANSMISSION_PROVIDER", "POWER", "Provide transmission route evidence.", ["transmission evidence"]),
    GENERATION_PROVIDER: tool("GENERATION_PROVIDER", "POWER", "Provide generation-site evidence.", ["generation evidence"]),
    POWER_PROXIMITY_EVALUATION: tool("POWER_PROXIMITY_EVALUATION", "POWER", "Evaluate power proximity context.", ["power proximity evidence"]),
    DATA_CENTER_PROVIDER: tool("DATA_CENTER_PROVIDER", "INTERCONNECTION", "Provide data center and facility evidence.", ["data center evidence"]),
    CARRIER_HOTEL_PROVIDER: tool("CARRIER_HOTEL_PROVIDER", "INTERCONNECTION", "Provide carrier hotel evidence.", ["carrier hotel evidence"]),
    IX_PROVIDER: tool("IX_PROVIDER", "INTERCONNECTION", "Provide internet exchange evidence.", ["IX evidence"]),
    CLOUD_ONRAMP_PROVIDER: tool("CLOUD_ONRAMP_PROVIDER", "INTERCONNECTION", "Provide cloud on-ramp evidence.", ["cloud on-ramp evidence"]),
    OPTICAL_REACH_REVIEW: tool("OPTICAL_REACH_REVIEW", "DESIGN_ENGINEERING", "Review optical reach and platform assumptions.", ["optical review"]),
    REGEN_SPACING_REVIEW: tool("REGEN_SPACING_REVIEW", "DESIGN_ENGINEERING", "Review regen spacing requirements.", ["regen review"]),
    ADM_PLACEMENT_REVIEW: tool("ADM_PLACEMENT_REVIEW", "DESIGN_ENGINEERING", "Review ADM placement requirements.", ["ADM review"]),
    FIBER_COUNT_PLANNING: tool("FIBER_COUNT_PLANNING", "DESIGN_ENGINEERING", "Review fiber count and strand planning.", ["fiber count basis"]),
    DUCT_CAPACITY_PLANNING: tool("DUCT_CAPACITY_PLANNING", "DESIGN_ENGINEERING", "Review duct count and residual capacity.", ["duct capacity basis"]),
    ROUTE_DIVERSITY_REVIEW: tool("ROUTE_DIVERSITY_REVIEW", "DESIGN_ENGINEERING", "Review route diversity sufficiency.", ["diversity review"]),
    CROSSING_REVIEW: tool("CROSSING_REVIEW", "DESIGN_ENGINEERING", "Review crossing owner, method, permit, cost, and schedule.", ["crossing review"]),
    JURISDICTION_REVIEW: tool("JURISDICTION_REVIEW", "DESIGN_ENGINEERING", "Review permit authority and jurisdiction context.", ["jurisdiction review"]),
    RESTORATION_REVIEW: tool("RESTORATION_REVIEW", "DESIGN_ENGINEERING", "Review restoration and SLA assumptions.", ["restoration review"]),
    MAINTENANCE_ACCESS_REVIEW: tool("MAINTENANCE_ACCESS_REVIEW", "DESIGN_ENGINEERING", "Review maintenance access and operating constraints.", ["maintenance evidence"]),
    DUCT_SALE_MODEL: tool("DUCT_SALE_MODEL", "COMMERCIAL", "Evaluate duct sale commercial model.", ["duct commercial basis"]),
    DARK_FIBER_IRU_MODEL: tool("DARK_FIBER_IRU_MODEL", "COMMERCIAL", "Evaluate dark fiber IRU commercial model.", ["IRU commercial basis"]),
    TRANSPORT_REVENUE_MODEL: tool("TRANSPORT_REVENUE_MODEL", "COMMERCIAL", "Evaluate transport revenue model.", ["transport commercial basis"]),
    RESIDUAL_CAPACITY_MODEL: tool("RESIDUAL_CAPACITY_MODEL", "COMMERCIAL", "Evaluate residual capacity monetization.", ["residual capacity basis"]),
    ENTERPRISE_MONETIZATION_MODEL: tool("ENTERPRISE_MONETIZATION_MODEL", "COMMERCIAL", "Evaluate enterprise service monetization.", ["enterprise commercial basis"]),
    HYPERSCALER_BUSINESS_CASE_MODEL: tool("HYPERSCALER_BUSINESS_CASE_MODEL", "COMMERCIAL", "Evaluate hyperscaler business case.", ["hyperscaler business case basis"]),
  };
  return toolTypes.map((toolType) => defaults[toolType]);
}

const componentById = new Map(REFERENCE_ARCHITECTURE_COMPONENTS.map((item) => [item.componentId, item]));

function selectComponents(ids: string[]): ReferenceArchitectureComponent[] {
  return ids.map((id) => {
    const found = componentById.get(id);
    if (!found) throw new Error(`Missing reference architecture component ${id}`);
    return found;
  });
}

export const REFERENCE_ARCHITECTURE_CATALOG: readonly ReferenceArchitecture[] = Object.freeze([
  architecture({
    architectureId: "REF-ARCH-HYPERSCALER-LONG-HAUL",
    architectureName: "Hyperscaler Long Haul",
    architectureType: "HYPERSCALER_LONG_HAUL",
    applicableLensTypes: ["HYPERSCALER"],
    applicableNetworkRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT"],
    applicableCorridorClasses: ["LONGHAUL", "AI_CORRIDOR", "INTERSTATE"],
    customerAskPatterns: ["400G", "800G", "route diversity", "future AI expansion", "data center interconnect"],
    requiredObjects: ["CONDUIT", "FIBER", "REGEN_SITE", "DATA_CENTER", "SUBSTATION", "TRANSMISSION_LINE", "CARRIER_HOTEL", "CLOUD_ONRAMP"],
    optionalObjects: ["GENERATION_SITE", "IX", "PARCEL", "DEVELOPMENT_SITE", "ADM_SITE"],
    requiredDesignStandards: ["STANDARD-CONDUIT-001", "STANDARD-FIBER-001", "STANDARD-REGEN-SITE-001", "STANDARD-DATA-CENTER-001", "STANDARD-SUBSTATION-001", "STANDARD-TRANSMISSION-001", "LENS-STANDARD-HYPERSCALER-001"],
    requiredTools: tools("DOT_GIS", "SHAPEFILE_TRANSLATE", "KML_KMZ_TRANSLATE", "SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ROUTE_DIVERSITY_REVIEW", "DARK_FIBER_IRU_MODEL", "TRANSPORT_REVENUE_MODEL", "HYPERSCALER_BUSINESS_CASE_MODEL"),
    components: selectComponents(["COMPONENT-CONDUIT-SYSTEM", "COMPONENT-FIBER-SYSTEM", "COMPONENT-OPTICAL-SYSTEM", "COMPONENT-ROUTE-DIVERSITY", "COMPONENT-INTERCONNECTION", "COMPONENT-POWER-PROXIMITY", "COMPONENT-RESTORATION"]),
    topology: { topologyType: "LINEAR", diversityExpected: true, interconnectionExpected: true, notes: "Long-haul AI/hyperscaler corridors require diversity and restoration review." },
    protectionModel: { protectionIntent: "DIVERSE", restorationQuestions: ["Are routes physically diverse?", "Are restoration commitments SLA-backed?"], routeEngineeringBoundary: "Route Engineering approves diversity sufficiency." },
    capacityModel: { capacityIntent: "HYBRID", capacityQuestions: ["Is 400G/800G transport feasible?", "Is future fiber and conduit capacity reserved?"], routeEngineeringBoundary: "Route Engineering approves optical and capacity assumptions." },
    expansionModel: { expansionIntent: "AI_CAMPUS", expansionQuestions: ["Are future campus, power, and data center expansion objects present?"], routeEngineeringBoundary: "Expansion remains advisory until reviewed." },
    commercialProducts: ["dark fiber IRU", "transport wave", "hyperscaler private network", "future conduit capacity"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Reference architecture for Dallas-to-Kansas-City-style hyperscaler backbone asks.",
  }),
  architecture({
    architectureId: "REF-ARCH-HYPERSCALER-METRO",
    architectureName: "Hyperscaler Metro",
    architectureType: "HYPERSCALER_METRO",
    applicableLensTypes: ["HYPERSCALER"],
    applicableNetworkRoles: ["METRO_AGGREGATION", "INTERCONNECTION"],
    applicableCorridorClasses: ["METRO", "INTERCONNECTION"],
    customerAskPatterns: ["data center to carrier hotel", "metro cloud access", "same MSA"],
    requiredObjects: ["CONDUIT", "FIBER", "DATA_CENTER", "CARRIER_HOTEL", "CLOUD_ONRAMP", "JURISDICTION", "CROSSING"],
    optionalObjects: ["IX", "PARCEL", "MAINTENANCE_ZONE"],
    requiredDesignStandards: ["STANDARD-CONDUIT-001", "STANDARD-FIBER-001", "STANDARD-DATA-CENTER-001", "STANDARD-CARRIER-HOTEL-001", "STANDARD-CLOUD-ONRAMP-001", "STANDARD-JURISDICTION-001", "STANDARD-CROSSING-001", "LENS-STANDARD-HYPERSCALER-001"],
    requiredTools: tools("KML_KMZ_TRANSLATE", "GEOJSON_TRANSLATE", "MUNICIPAL_GIS", "COUNTY_GIS", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "DUCT_CAPACITY_PLANNING", "FIBER_COUNT_PLANNING", "JURISDICTION_REVIEW", "CROSSING_REVIEW"),
    components: selectComponents(["COMPONENT-CONDUIT-SYSTEM", "COMPONENT-FIBER-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-PERMITTING-JURISDICTION", "COMPONENT-CROSSING", "COMPONENT-MAINTENANCE"]),
    topology: { topologyType: "FABRIC", diversityExpected: true, interconnectionExpected: true, notes: "Metro hyperscaler asks emphasize facility handoff and jurisdiction complexity." },
    protectionModel: { protectionIntent: "PROTECTED", restorationQuestions: ["Is metro path protectable?", "Are alternate entrances available?"], routeEngineeringBoundary: "Route Engineering reviews protection and building entry." },
    capacityModel: { capacityIntent: "HYBRID", capacityQuestions: ["Are fiber and conduit capacity sufficient for metro scale?"], routeEngineeringBoundary: "Capacity claims require approval." },
    expansionModel: { expansionIntent: "SPARE_DUCT", expansionQuestions: ["Is spare conduit capacity preserved for growth?"], routeEngineeringBoundary: "Spare capacity must be validated." },
    commercialProducts: ["metro transport", "dark fiber", "cloud access", "private wave"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Metro hyperscaler architecture for same-MSA facility access.",
  }),
  architecture({
    architectureId: "REF-ARCH-HYPERSCALER-MSA-INTERCONNECT",
    architectureName: "Hyperscaler MSA Interconnect",
    architectureType: "HYPERSCALER_MSA_INTERCONNECT",
    applicableLensTypes: ["HYPERSCALER"],
    applicableNetworkRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT"],
    applicableCorridorClasses: ["MIDDLE_MILE", "REGIONAL", "INTERSTATE"],
    customerAskPatterns: ["MSA interconnect", "regional data center", "high capacity"],
    requiredObjects: ["FIBER", "CONDUIT", "DATA_CENTER", "CARRIER_HOTEL", "REGEN_SITE", "JURISDICTION"],
    optionalObjects: ["SUBSTATION", "TRANSMISSION_LINE", "IX", "ADM_SITE"],
    requiredDesignStandards: ["STANDARD-FIBER-001", "STANDARD-CONDUIT-001", "STANDARD-DATA-CENTER-001", "STANDARD-REGEN-SITE-001", "STANDARD-JURISDICTION-001", "LENS-STANDARD-HYPERSCALER-001"],
    requiredTools: tools("DOT_GIS", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ROUTE_DIVERSITY_REVIEW", "TRANSPORT_REVENUE_MODEL"),
    components: selectComponents(["COMPONENT-FIBER-SYSTEM", "COMPONENT-CONDUIT-SYSTEM", "COMPONENT-OPTICAL-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-ROUTE-DIVERSITY", "COMPONENT-PERMITTING-JURISDICTION"]),
    topology: { topologyType: "LINEAR", diversityExpected: true, interconnectionExpected: true, notes: "Regional MSA interconnect architecture." },
    protectionModel: { protectionIntent: "DIVERSE", restorationQuestions: ["What shared ROW exists?", "What restoration is expected?"], routeEngineeringBoundary: "Diversity must be approved." },
    capacityModel: { capacityIntent: "TRANSPORT", capacityQuestions: ["What transport platform and fiber count are required?"], routeEngineeringBoundary: "Route Engineering validates platform assumptions." },
    expansionModel: { expansionIntent: "REGIONAL_GROWTH", expansionQuestions: ["What future MSA demand exists?"], routeEngineeringBoundary: "Growth assumptions remain advisory." },
    commercialProducts: ["regional transport", "dark fiber", "private network"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Hyperscaler MSA interconnect sits between metro and long-haul architecture.",
  }),
  architecture({
    architectureId: "REF-ARCH-NEOCLOUD-INTERCONNECT",
    architectureName: "Neocloud Interconnect",
    architectureType: "NEOCLOUD_INTERCONNECT",
    applicableLensTypes: ["NEOCLOUD"],
    applicableNetworkRoles: ["INTERCONNECTION", "AI_FABRIC"],
    applicableCorridorClasses: ["INTERCONNECTION", "AI_CORRIDOR", "METRO"],
    customerAskPatterns: ["GPU array to cloud on-ramp", "AI fabric", "low latency"],
    requiredObjects: ["GPU_ARRAY", "DATA_CENTER", "CARRIER_HOTEL", "IX", "CLOUD_ONRAMP", "FIBER", "POWER_FEED"],
    optionalObjects: ["SUBSTATION", "TRANSMISSION_LINE", "REGEN_SITE"],
    requiredDesignStandards: ["STANDARD-GPU-ARRAY-001", "STANDARD-DATA-CENTER-001", "STANDARD-CARRIER-HOTEL-001", "STANDARD-CLOUD-ONRAMP-001", "STANDARD-FIBER-001", "LENS-STANDARD-NEOCLOUD-001"],
    requiredTools: tools("DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "IX_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "POWER_PROXIMITY_EVALUATION", "FIBER_COUNT_PLANNING", "TRANSPORT_REVENUE_MODEL"),
    components: selectComponents(["COMPONENT-FIBER-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-POWER-PROXIMITY", "COMPONENT-OPTICAL-SYSTEM"]),
    topology: { topologyType: "FABRIC", diversityExpected: true, interconnectionExpected: true, notes: "Neocloud interconnect emphasizes dense facilities and high-capacity optionality." },
    protectionModel: { protectionIntent: "CUSTOMER_DEFINED", restorationQuestions: ["Does customer require protected or best-effort interconnect?"], routeEngineeringBoundary: "Protection model requires engineering review." },
    capacityModel: { capacityIntent: "HYBRID", capacityQuestions: ["Is dark fiber, wave, or mixed product desired?"], routeEngineeringBoundary: "Product feasibility requires Route Engineering." },
    expansionModel: { expansionIntent: "AI_CAMPUS", expansionQuestions: ["Does GPU footprint require expansion capacity?"], routeEngineeringBoundary: "Expansion assumptions need evidence." },
    commercialProducts: ["dark fiber", "transport wave", "cloud interconnect"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Neocloud architecture maps AI demand to interconnection and power context.",
  }),
  architecture({
    architectureId: "REF-ARCH-AI-POWER-EXPANSION",
    architectureName: "AI Power Expansion",
    architectureType: "AI_POWER_EXPANSION",
    applicableLensTypes: ["POWER_AI_EXPANSION"],
    applicableNetworkRoles: ["AI_FABRIC", "REGIONAL_AGGREGATION"],
    applicableCorridorClasses: ["AI_CORRIDOR", "REGIONAL", "LONGHAUL"],
    customerAskPatterns: ["West Texas data center footprint", "power-adjacent land", "future AI campus"],
    requiredObjects: ["SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "PARCEL", "DEVELOPMENT_SITE", "FIBER"],
    optionalObjects: ["DATA_CENTER", "GPU_ARRAY", "POWER_FEED"],
    requiredDesignStandards: ["STANDARD-SUBSTATION-001", "STANDARD-TRANSMISSION-001", "STANDARD-PARCEL-DEVELOPMENT-001", "STANDARD-FIBER-001", "LENS-STANDARD-POWER-AI-EXPANSION-001"],
    requiredTools: tools("SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER", "GENERATION_PROVIDER", "PARCEL_GIS", "POWER_PROXIMITY_EVALUATION", "HYPERSCALER_BUSINESS_CASE_MODEL"),
    components: selectComponents(["COMPONENT-POWER-PROXIMITY", "COMPONENT-FIBER-SYSTEM", "COMPONENT-EVIDENCE", "COMPONENT-PERMITTING-JURISDICTION"]),
    topology: { topologyType: "LINEAR", diversityExpected: false, interconnectionExpected: false, notes: "AI expansion architecture is strategic evidence before network design." },
    protectionModel: { protectionIntent: "NONE", restorationQuestions: ["What future service would require protection?"], routeEngineeringBoundary: "Protection is not assumed." },
    capacityModel: { capacityIntent: "AI_EXPANSION", capacityQuestions: ["Is power capacity real?", "Is fiber expansion feasible?"], routeEngineeringBoundary: "Power and fiber availability require evidence." },
    expansionModel: { expansionIntent: "AI_CAMPUS", expansionQuestions: ["Are parcel, power, and fiber suitable for campus growth?"], routeEngineeringBoundary: "Campus suitability remains advisory." },
    commercialProducts: ["future campus", "fiber expansion", "transport-ready corridor"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Power AI architecture is evidence-heavy and not a serviceability declaration.",
  }),
  architecture({
    architectureId: "REF-ARCH-DARK-FIBER-IRU",
    architectureName: "Dark Fiber IRU",
    architectureType: "DARK_FIBER_IRU",
    applicableLensTypes: ["DARK_FIBER_IRU"],
    applicableNetworkRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    applicableCorridorClasses: ["METRO", "MIDDLE_MILE", "LONGHAUL", "INTERCONNECTION"],
    customerAskPatterns: ["fiber pair IRU", "diverse route", "strand reservation"],
    requiredObjects: ["FIBER", "FIBER_PAIR", "SPLICE", "DATA_CENTER", "CARRIER_HOTEL"],
    optionalObjects: ["BACKBONE_NODE", "CONDUIT", "RIGHT_OF_WAY"],
    requiredDesignStandards: ["STANDARD-FIBER-001", "STANDARD-DATA-CENTER-001", "STANDARD-CARRIER-HOTEL-001", "LENS-STANDARD-DARK-FIBER-IRU-001"],
    requiredTools: tools("FIBER_COUNT_PLANNING", "DARK_FIBER_IRU_MODEL", "ROUTE_DIVERSITY_REVIEW", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"),
    components: selectComponents(["COMPONENT-FIBER-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-ROUTE-DIVERSITY", "COMPONENT-MAINTENANCE"]),
    topology: { topologyType: "LINEAR", diversityExpected: true, interconnectionExpected: true, notes: "IRU architecture centers on strand reservation and boundaries." },
    protectionModel: { protectionIntent: "CUSTOMER_DEFINED", restorationQuestions: ["Is diverse IRU required?", "What restoration terms apply?"], routeEngineeringBoundary: "IRU terms require approval." },
    capacityModel: { capacityIntent: "DARK_FIBER", capacityQuestions: ["Which strands are eligible and reserved?"], routeEngineeringBoundary: "Strand truth requires engineering approval." },
    expansionModel: { expansionIntent: "SPARE_STRANDS", expansionQuestions: ["What future growth reserve is required?"], routeEngineeringBoundary: "Reserve cannot be overwritten by sales." },
    commercialProducts: ["dark fiber IRU"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Dark fiber architecture cannot sell unapproved capacity.",
  }),
  architecture({
    architectureId: "REF-ARCH-DUCT-SALE-MAINTENANCE",
    architectureName: "Duct Sale And Maintenance",
    architectureType: "DUCT_SALE_AND_MAINTENANCE",
    applicableLensTypes: ["DUCT_MONETIZATION"],
    applicableNetworkRoles: ["METRO_AGGREGATION", "REGIONAL_AGGREGATION", "INTERCONNECTION"],
    applicableCorridorClasses: ["METRO", "REGIONAL", "MIDDLE_MILE"],
    customerAskPatterns: ["spare duct sale", "maintenance responsibility", "residual capacity"],
    requiredObjects: ["CONDUIT", "INNERDUCT", "RIGHT_OF_WAY", "JURISDICTION"],
    optionalObjects: ["WIRELESS_SITE", "PARCEL", "UTILITY"],
    requiredDesignStandards: ["STANDARD-CONDUIT-001", "STANDARD-JURISDICTION-001", "LENS-STANDARD-DUCT-MONETIZATION-001"],
    requiredTools: tools("DUCT_CAPACITY_PLANNING", "RESIDUAL_CAPACITY_MODEL", "DUCT_SALE_MODEL", "MUNICIPAL_GIS", "COUNTY_GIS", "JURISDICTION_REVIEW", "MAINTENANCE_ACCESS_REVIEW"),
    components: selectComponents(["COMPONENT-CONDUIT-SYSTEM", "COMPONENT-MAINTENANCE", "COMPONENT-PERMITTING-JURISDICTION"]),
    topology: { topologyType: "LINEAR", diversityExpected: false, interconnectionExpected: false, notes: "Duct monetization depends on capacity and access rights." },
    protectionModel: { protectionIntent: "NONE", restorationQuestions: ["What maintenance obligations apply?"], routeEngineeringBoundary: "Maintenance and restoration obligations require review." },
    capacityModel: { capacityIntent: "DUCT", capacityQuestions: ["What duct is occupied, spare, reserved, sale-eligible?"], routeEngineeringBoundary: "Residual capacity must be approved." },
    expansionModel: { expansionIntent: "SPARE_DUCT", expansionQuestions: ["What capacity remains after sale?"], routeEngineeringBoundary: "Spare capacity is a protected assumption." },
    commercialProducts: ["duct sale", "duct lease", "residual capacity monetization"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Duct sale architecture emphasizes residual capacity and maintenance responsibility.",
  }),
  architecture({
    architectureId: "REF-ARCH-TRANSPORT-WAVE",
    architectureName: "Transport Wave",
    architectureType: "TRANSPORT_WAVE",
    applicableLensTypes: ["TRANSPORT"],
    applicableNetworkRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    applicableCorridorClasses: ["METRO", "MIDDLE_MILE", "LONGHAUL", "INTERCONNECTION"],
    customerAskPatterns: ["protected wavelength", "transport wave", "SLA", "optical service"],
    requiredObjects: ["REGEN_SITE", "ADM_SITE", "POP", "DATA_CENTER", "CARRIER_HOTEL"],
    optionalObjects: ["IX", "CLOUD_ONRAMP", "FIBER"],
    requiredDesignStandards: ["STANDARD-REGEN-SITE-001", "STANDARD-ADM-SITE-001", "STANDARD-DATA-CENTER-001", "STANDARD-CARRIER-HOTEL-001", "LENS-STANDARD-TRANSPORT-001"],
    requiredTools: tools("OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ADM_PLACEMENT_REVIEW", "RESTORATION_REVIEW", "TRANSPORT_REVENUE_MODEL", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"),
    components: selectComponents(["COMPONENT-OPTICAL-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-RESTORATION", "COMPONENT-FIBER-SYSTEM"]),
    topology: { topologyType: "LINEAR", diversityExpected: true, interconnectionExpected: true, notes: "Transport wave architecture requires optical and restoration review." },
    protectionModel: { protectionIntent: "PROTECTED", restorationQuestions: ["Is protected path available?", "Does SLA require restoration?"], routeEngineeringBoundary: "SLA and restoration require review." },
    capacityModel: { capacityIntent: "TRANSPORT", capacityQuestions: ["What wave capacity and platform are required?"], routeEngineeringBoundary: "Optical platform requires approval." },
    expansionModel: { expansionIntent: "CUSTOMER_GROWTH", expansionQuestions: ["What future wave growth is expected?"], routeEngineeringBoundary: "Future growth remains advisory." },
    commercialProducts: ["protected wavelength", "transport wave"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Transport architecture focuses on optical truth, not only route geometry.",
  }),
  architecture({
    architectureId: "REF-ARCH-ENTERPRISE-METRO-ACCESS",
    architectureName: "Enterprise Metro Access",
    architectureType: "ENTERPRISE_METRO_ACCESS",
    applicableLensTypes: ["ENTERPRISE"],
    applicableNetworkRoles: ["METRO_AGGREGATION", "CAMPUS", "INTERCONNECTION"],
    applicableCorridorClasses: ["METRO", "CAMPUS", "INTERCONNECTION"],
    customerAskPatterns: ["enterprise building lateral", "building entry", "commercial serviceability"],
    requiredObjects: ["ENTERPRISE_BUILDING", "CONDUIT", "FIBER", "PARCEL", "JURISDICTION"],
    optionalObjects: ["DATA_CENTER", "CLOUD_ONRAMP", "CARRIER_HOTEL"],
    requiredDesignStandards: ["STANDARD-CONDUIT-001", "STANDARD-FIBER-001", "STANDARD-PARCEL-DEVELOPMENT-001", "STANDARD-JURISDICTION-001", "LENS-STANDARD-ENTERPRISE-001"],
    requiredTools: tools("CSV_TRANSLATE", "PARCEL_GIS", "MUNICIPAL_GIS", "ENTERPRISE_MONETIZATION_MODEL", "MAINTENANCE_ACCESS_REVIEW", "JURISDICTION_REVIEW"),
    components: selectComponents(["COMPONENT-CONDUIT-SYSTEM", "COMPONENT-FIBER-SYSTEM", "COMPONENT-PERMITTING-JURISDICTION", "COMPONENT-MAINTENANCE"]),
    topology: { topologyType: "HUB_AND_SPOKE", diversityExpected: false, interconnectionExpected: false, notes: "Enterprise access centers on laterals and building entry." },
    protectionModel: { protectionIntent: "CUSTOMER_DEFINED", restorationQuestions: ["Does enterprise service require protection?"], routeEngineeringBoundary: "Service terms drive protection review." },
    capacityModel: { capacityIntent: "ENTERPRISE_SERVICE", capacityQuestions: ["What fiber/service capacity is needed?"], routeEngineeringBoundary: "Service availability needs review." },
    expansionModel: { expansionIntent: "CUSTOMER_GROWTH", expansionQuestions: ["Is building or campus expansion expected?"], routeEngineeringBoundary: "Growth remains advisory." },
    commercialProducts: ["enterprise access", "internet access", "private line"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Enterprise architecture separates commercial interest from constructability.",
  }),
  architecture({
    architectureId: "REF-ARCH-INTERCONNECTION-FABRIC",
    architectureName: "Interconnection Fabric",
    architectureType: "INTERCONNECTION_FABRIC",
    applicableLensTypes: ["INTERCONNECTION", "TRANSPORT", "NEOCLOUD"],
    applicableNetworkRoles: ["INTERCONNECTION", "METRO_AGGREGATION"],
    applicableCorridorClasses: ["INTERCONNECTION", "METRO"],
    customerAskPatterns: ["carrier hotel mesh", "cloud fabric", "IX access"],
    requiredObjects: ["CARRIER_HOTEL", "IX", "CLOUD_ONRAMP", "DATA_CENTER", "FIBER"],
    optionalObjects: ["ADM_SITE", "POP", "MEET_ME_ROOM"],
    requiredDesignStandards: ["STANDARD-CARRIER-HOTEL-001", "STANDARD-IX-001", "STANDARD-CLOUD-ONRAMP-001", "STANDARD-DATA-CENTER-001", "STANDARD-FIBER-001"],
    requiredTools: tools("CARRIER_HOTEL_PROVIDER", "IX_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "DATA_CENTER_PROVIDER", "FIBER_COUNT_PLANNING", "TRANSPORT_REVENUE_MODEL"),
    components: selectComponents(["COMPONENT-INTERCONNECTION", "COMPONENT-FIBER-SYSTEM", "COMPONENT-MAINTENANCE"]),
    topology: { topologyType: "FABRIC", diversityExpected: true, interconnectionExpected: true, notes: "Fabric architecture emphasizes facility density and handoff optionality." },
    protectionModel: { protectionIntent: "CUSTOMER_DEFINED", restorationQuestions: ["Are multiple fabric nodes required?"], routeEngineeringBoundary: "Fabric design needs review." },
    capacityModel: { capacityIntent: "HYBRID", capacityQuestions: ["What product mix is expected?"], routeEngineeringBoundary: "Product truth requires Route Engineering." },
    expansionModel: { expansionIntent: "REGIONAL_GROWTH", expansionQuestions: ["Can more fabric nodes be added?"], routeEngineeringBoundary: "Expansion remains advisory." },
    commercialProducts: ["cloud connect", "transport", "dark fiber", "interconnection"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Interconnection fabric is a reference pattern, not a final topology.",
  }),
  architecture({
    architectureId: "REF-ARCH-CARRIER-WHOLESALE",
    architectureName: "Carrier Wholesale",
    architectureType: "CARRIER_WHOLESALE",
    applicableLensTypes: ["CARRIER_WHOLESALE", "TRANSPORT", "DARK_FIBER_IRU"],
    applicableNetworkRoles: ["BACKBONE_INTERCONNECT", "MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
    applicableCorridorClasses: ["MIDDLE_MILE", "LONGHAUL", "REGIONAL", "INTERSTATE"],
    customerAskPatterns: ["carrier wholesale", "backbone node", "POP interconnect"],
    requiredObjects: ["POP", "BACKBONE_NODE", "FIBER", "CONDUIT", "CARRIER_HOTEL"],
    optionalObjects: ["REGEN_SITE", "ADM_SITE", "IX"],
    requiredDesignStandards: ["STANDARD-FIBER-001", "STANDARD-CONDUIT-001", "STANDARD-CARRIER-HOTEL-001", "LENS-STANDARD-TRANSPORT-001"],
    requiredTools: tools("FIBER_COUNT_PLANNING", "DUCT_CAPACITY_PLANNING", "CARRIER_HOTEL_PROVIDER", "TRANSPORT_REVENUE_MODEL", "DARK_FIBER_IRU_MODEL"),
    components: selectComponents(["COMPONENT-FIBER-SYSTEM", "COMPONENT-CONDUIT-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-OPTICAL-SYSTEM"]),
    topology: { topologyType: "LINEAR", diversityExpected: true, interconnectionExpected: true, notes: "Carrier wholesale references POPs, backbone nodes, and wholesale product optionality." },
    protectionModel: { protectionIntent: "CUSTOMER_DEFINED", restorationQuestions: ["Does wholesale buyer require protected or diverse service?"], routeEngineeringBoundary: "Protection model requires review." },
    capacityModel: { capacityIntent: "HYBRID", capacityQuestions: ["Is product dark fiber, duct, wave, or mixed?"], routeEngineeringBoundary: "Capacity truth needs approval." },
    expansionModel: { expansionIntent: "REGIONAL_GROWTH", expansionQuestions: ["What future wholesale demand exists?"], routeEngineeringBoundary: "Growth remains advisory." },
    commercialProducts: ["dark fiber", "transport", "duct", "wholesale interconnect"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Carrier wholesale uses multiple product standards.",
  }),
  architecture({
    architectureId: "REF-ARCH-REGIONAL-AGGREGATION",
    architectureName: "Regional Aggregation",
    architectureType: "REGIONAL_AGGREGATION",
    applicableLensTypes: ["TRANSPORT", "ENTERPRISE", "CARRIER_WHOLESALE"],
    applicableNetworkRoles: ["REGIONAL_AGGREGATION", "MSA_INTERCONNECT"],
    applicableCorridorClasses: ["REGIONAL", "MIDDLE_MILE"],
    customerAskPatterns: ["regional aggregation", "multi-site aggregation", "LSO aggregation"],
    requiredObjects: ["AGGREGATION_NODE", "FIBER", "CONDUIT", "POP", "JURISDICTION"],
    optionalObjects: ["LSO", "DATA_CENTER", "ADM_SITE"],
    requiredDesignStandards: ["STANDARD-FIBER-001", "STANDARD-CONDUIT-001", "STANDARD-JURISDICTION-001"],
    requiredTools: tools("GEOJSON_TRANSLATE", "CSV_TRANSLATE", "DOT_GIS", "COUNTY_GIS", "FIBER_COUNT_PLANNING", "TRANSPORT_REVENUE_MODEL"),
    components: selectComponents(["COMPONENT-FIBER-SYSTEM", "COMPONENT-CONDUIT-SYSTEM", "COMPONENT-PERMITTING-JURISDICTION", "COMPONENT-EVIDENCE"]),
    topology: { topologyType: "HUB_AND_SPOKE", diversityExpected: false, interconnectionExpected: false, notes: "Regional aggregation collects distributed demand." },
    protectionModel: { protectionIntent: "RESTORABLE", restorationQuestions: ["What restoration is expected across aggregation sites?"], routeEngineeringBoundary: "Restoration design needs review." },
    capacityModel: { capacityIntent: "TRANSPORT", capacityQuestions: ["What aggregate bandwidth is expected?"], routeEngineeringBoundary: "Aggregation capacity must be approved." },
    expansionModel: { expansionIntent: "REGIONAL_GROWTH", expansionQuestions: ["Can additional sites be aggregated later?"], routeEngineeringBoundary: "Growth remains advisory." },
    commercialProducts: ["regional transport", "enterprise aggregation", "wholesale aggregation"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Regional aggregation architecture supports multiple lenses.",
  }),
  architecture({
    architectureId: "REF-ARCH-CAMPUS-INTERCONNECT",
    architectureName: "Campus Interconnect",
    architectureType: "CAMPUS_INTERCONNECT",
    applicableLensTypes: ["ENTERPRISE", "HYPERSCALER", "NEOCLOUD"],
    applicableNetworkRoles: ["CAMPUS", "INTERCONNECTION"],
    applicableCorridorClasses: ["CAMPUS", "INTERCONNECTION"],
    customerAskPatterns: ["campus interconnect", "building to building", "data center campus"],
    requiredObjects: ["FIBER", "CONDUIT", "DATA_CENTER", "PARCEL"],
    optionalObjects: ["GPU_ARRAY", "CLOUD_ONRAMP", "MEET_ME_ROOM"],
    requiredDesignStandards: ["STANDARD-FIBER-001", "STANDARD-CONDUIT-001", "STANDARD-DATA-CENTER-001", "STANDARD-PARCEL-DEVELOPMENT-001"],
    requiredTools: tools("CSV_TRANSLATE", "GEOJSON_TRANSLATE", "PARCEL_GIS", "FIBER_COUNT_PLANNING", "DUCT_CAPACITY_PLANNING", "ENTERPRISE_MONETIZATION_MODEL"),
    components: selectComponents(["COMPONENT-FIBER-SYSTEM", "COMPONENT-CONDUIT-SYSTEM", "COMPONENT-INTERCONNECTION", "COMPONENT-MAINTENANCE"]),
    topology: { topologyType: "CAMPUS", diversityExpected: false, interconnectionExpected: true, notes: "Campus interconnect architecture emphasizes internal paths and handoffs." },
    protectionModel: { protectionIntent: "CUSTOMER_DEFINED", restorationQuestions: ["Does campus require ring or protected topology?"], routeEngineeringBoundary: "Campus protection needs review." },
    capacityModel: { capacityIntent: "HYBRID", capacityQuestions: ["What building-to-building capacity is needed?"], routeEngineeringBoundary: "Capacity remains engineered truth." },
    expansionModel: { expansionIntent: "CUSTOMER_GROWTH", expansionQuestions: ["What campus expansion path exists?"], routeEngineeringBoundary: "Expansion remains advisory." },
    commercialProducts: ["campus fiber", "enterprise access", "private network"],
    engineeringReviewRequired: true,
    salesEditable: false,
    notes: "Campus interconnect maps a customer ask to components, not execution.",
  }),
]);
