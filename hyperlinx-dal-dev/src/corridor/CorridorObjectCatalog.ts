import type { ProviderType } from "../providers/ProviderContract";
import type { CorridorNetworkRole } from "./corridorTypes";

export type CorridorObjectCategory =
  | "INFRASTRUCTURE"
  | "POWER"
  | "INTERCONNECTION"
  | "PROPERTY"
  | "NETWORK"
  | "OPERATIONAL"
  | "MONETIZATION";

export type CorridorObjectType =
  | "CONDUIT"
  | "INNERDUCT"
  | "FIBER"
  | "FIBER_PAIR"
  | "SPLICE"
  | "HANDHOLE"
  | "MANHOLE"
  | "VAULT"
  | "REGEN_SITE"
  | "ADM_SITE"
  | "POP"
  | "SUBSTATION"
  | "TRANSMISSION_LINE"
  | "GENERATION_SITE"
  | "POWER_FEED"
  | "POWER_CORRIDOR"
  | "DATA_CENTER"
  | "CARRIER_HOTEL"
  | "IX"
  | "CLOUD_ONRAMP"
  | "MEET_ME_ROOM"
  | "INTERCONNECT_FACILITY"
  | "PARCEL"
  | "DEVELOPMENT_SITE"
  | "RIGHT_OF_WAY"
  | "UTILITY_EASEMENT"
  | "LSO"
  | "CO"
  | "WIRELESS_SITE"
  | "AGGREGATION_NODE"
  | "BACKBONE_NODE"
  | "JURISDICTION"
  | "CROSSING"
  | "CONSTRAINT"
  | "ENVIRONMENTAL_AREA"
  | "PERMIT_ZONE"
  | "MAINTENANCE_ZONE"
  | "RESTORATION_ZONE"
  | "DUCT_OPPORTUNITY"
  | "DARK_FIBER_OPPORTUNITY"
  | "TRANSPORT_OPPORTUNITY"
  | "IRU_OPPORTUNITY"
  | "EXPANSION_OPPORTUNITY";

export type CorridorObjectImportance = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CONTEXTUAL";

export type CorridorObjectMonetization =
  | "DUCT_SALE"
  | "DARK_FIBER_IRU"
  | "TRANSPORT_REVENUE"
  | "INTERCONNECTION_REVENUE"
  | "AI_EXPANSION_POTENTIAL"
  | "FUTURE_CAMPUS_OPPORTUNITY"
  | "RESIDUAL_CAPACITY"
  | "COST_AVOIDANCE"
  | "NONE";

export type CorridorObjectRisk =
  | "CONSTRUCTION_RISK"
  | "PERMIT_RISK"
  | "ENVIRONMENTAL_RISK"
  | "POWER_RISK"
  | "COMMERCIAL_RISK"
  | "OPERATIONAL_RISK"
  | "LOW_RISK"
  | "NONE";

export interface CorridorObjectDefinition {
  objectType: CorridorObjectType;
  category: CorridorObjectCategory;
  description: string;
  corridorRoles: CorridorNetworkRole[];
  importance: CorridorObjectImportance;
  monetizationImpact: CorridorObjectMonetization[];
  riskImpact: CorridorObjectRisk[];
  providerSources: ProviderType[];
  evidenceRequirements: string[];
}

const ALL_ROLES: CorridorNetworkRole[] = [
  "CAMPUS",
  "METRO_AGGREGATION",
  "MSA_INTERCONNECT",
  "BACKBONE_INTERCONNECT",
  "AI_FABRIC",
  "REGIONAL_AGGREGATION",
  "INTERCONNECTION",
];

const METRO_ROLES: CorridorNetworkRole[] = ["CAMPUS", "METRO_AGGREGATION", "INTERCONNECTION"];
const TRANSPORT_ROLES: CorridorNetworkRole[] = ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "REGIONAL_AGGREGATION", "AI_FABRIC"];
const AI_ROLES: CorridorNetworkRole[] = ["AI_FABRIC", "BACKBONE_INTERCONNECT"];

export const CORRIDOR_OBJECT_CATALOG: readonly CorridorObjectDefinition[] = Object.freeze([
  {
    objectType: "CONDUIT",
    category: "INFRASTRUCTURE",
    description: "Physical conduit system capable of carrying innerduct, fiber, or future capacity.",
    corridorRoles: ALL_ROLES,
    importance: "CRITICAL",
    monetizationImpact: ["DUCT_SALE", "RESIDUAL_CAPACITY"],
    riskImpact: ["CONSTRUCTION_RISK"],
    providerSources: ["TERALINX_MODEL", "UTILITY_GIS", "DOT_GIS"],
    evidenceRequirements: ["duct count", "route association", "ownership or control evidence"],
  },
  {
    objectType: "INNERDUCT",
    category: "INFRASTRUCTURE",
    description: "Subduct or innerduct allocation inside conduit.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["DUCT_SALE", "RESIDUAL_CAPACITY"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["innerduct count", "available capacity", "occupancy evidence"],
  },
  {
    objectType: "FIBER",
    category: "INFRASTRUCTURE",
    description: "Fiber cable or strand inventory available for corridor service.",
    corridorRoles: ALL_ROLES,
    importance: "CRITICAL",
    monetizationImpact: ["DARK_FIBER_IRU", "TRANSPORT_REVENUE", "RESIDUAL_CAPACITY"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["fiber count", "strand allocation", "fiber type or unknown status"],
  },
  {
    objectType: "FIBER_PAIR",
    category: "INFRASTRUCTURE",
    description: "Assignable pair of strands for dark fiber, transport, or operations.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["DARK_FIBER_IRU", "TRANSPORT_REVENUE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["strand IDs or allocation placeholder", "availability evidence"],
  },
  {
    objectType: "SPLICE",
    category: "INFRASTRUCTURE",
    description: "Splice point or splice case affecting continuity, restoration, and handoff options.",
    corridorRoles: ALL_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["location", "asset association", "splice function"],
  },
  {
    objectType: "HANDHOLE",
    category: "INFRASTRUCTURE",
    description: "Access structure for fiber placement, lateral access, and maintenance.",
    corridorRoles: METRO_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["CONSTRUCTION_RISK", "OPERATIONAL_RISK"],
    providerSources: ["MUNICIPAL_GIS", "UTILITY_GIS", "TERALINX_MODEL"],
    evidenceRequirements: ["location", "access type", "ownership or planned status"],
  },
  {
    objectType: "MANHOLE",
    category: "INFRASTRUCTURE",
    description: "Underground access structure for larger conduit and fiber access.",
    corridorRoles: METRO_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["CONSTRUCTION_RISK", "OPERATIONAL_RISK"],
    providerSources: ["MUNICIPAL_GIS", "UTILITY_GIS"],
    evidenceRequirements: ["location", "structure type", "access constraints"],
  },
  {
    objectType: "VAULT",
    category: "INFRASTRUCTURE",
    description: "Vault used for access, slack, splicing, or network handoff.",
    corridorRoles: METRO_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["INTERCONNECTION_REVENUE", "COST_AVOIDANCE"],
    riskImpact: ["CONSTRUCTION_RISK", "OPERATIONAL_RISK"],
    providerSources: ["MUNICIPAL_GIS", "UTILITY_GIS", "TERALINX_MODEL"],
    evidenceRequirements: ["location", "vault type", "handoff or access purpose"],
  },
  {
    objectType: "REGEN_SITE",
    category: "INFRASTRUCTURE",
    description: "Regeneration or amplification site needed for optical reach.",
    corridorRoles: ["BACKBONE_INTERCONNECT", "AI_FABRIC", "MSA_INTERCONNECT"],
    importance: "HIGH",
    monetizationImpact: ["TRANSPORT_REVENUE"],
    riskImpact: ["POWER_RISK", "OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL", "SUBSTATION_PROVIDER", "PARCEL_PROVIDER"],
    evidenceRequirements: ["span need", "power signal", "site or parcel evidence"],
  },
  {
    objectType: "ADM_SITE",
    category: "INFRASTRUCTURE",
    description: "Add/drop multiplexer or transport node site.",
    corridorRoles: TRANSPORT_ROLES,
    importance: "HIGH",
    monetizationImpact: ["TRANSPORT_REVENUE", "INTERCONNECTION_REVENUE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    evidenceRequirements: ["node role", "service capability", "facility evidence"],
  },
  {
    objectType: "POP",
    category: "INFRASTRUCTURE",
    description: "Point of presence used for aggregation, transport, or interconnection.",
    corridorRoles: ["METRO_AGGREGATION", "BACKBONE_INTERCONNECT", "AI_FABRIC", "INTERCONNECTION"],
    importance: "HIGH",
    monetizationImpact: ["TRANSPORT_REVENUE", "INTERCONNECTION_REVENUE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["CARRIER_HOTEL_PROVIDER", "DATA_CENTER_PROVIDER", "TERALINX_MODEL"],
    evidenceRequirements: ["facility name", "role", "interconnection capability"],
  },
  {
    objectType: "SUBSTATION",
    category: "POWER",
    description: "Electrical substation relevant to AI, data center, regen, and power-aware expansion.",
    corridorRoles: AI_ROLES,
    importance: "CRITICAL",
    monetizationImpact: ["AI_EXPANSION_POTENTIAL", "FUTURE_CAMPUS_OPPORTUNITY"],
    riskImpact: ["POWER_RISK"],
    providerSources: ["SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER"],
    evidenceRequirements: ["location", "capacity signal or unknown status", "distance to corridor"],
  },
  {
    objectType: "TRANSMISSION_LINE",
    category: "POWER",
    description: "High-voltage transmission asset relevant to AI fabric and regional power access.",
    corridorRoles: AI_ROLES,
    importance: "HIGH",
    monetizationImpact: ["AI_EXPANSION_POTENTIAL"],
    riskImpact: ["POWER_RISK", "CONSTRUCTION_RISK"],
    providerSources: ["TRANSMISSION_PROVIDER"],
    evidenceRequirements: ["geometry", "voltage or unknown status", "proximity to corridor"],
  },
  {
    objectType: "GENERATION_SITE",
    category: "POWER",
    description: "Generation asset that may support AI load, resiliency, or expansion planning.",
    corridorRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT"],
    importance: "MEDIUM",
    monetizationImpact: ["AI_EXPANSION_POTENTIAL"],
    riskImpact: ["POWER_RISK"],
    providerSources: ["GENERATION_PROVIDER"],
    evidenceRequirements: ["location", "generation type", "capacity signal or unknown status"],
  },
  {
    objectType: "POWER_FEED",
    category: "POWER",
    description: "Power feed evidence for facilities, regen, or interconnection sites.",
    corridorRoles: ["CAMPUS", "AI_FABRIC", "BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    importance: "HIGH",
    monetizationImpact: ["AI_EXPANSION_POTENTIAL", "COST_AVOIDANCE"],
    riskImpact: ["POWER_RISK"],
    providerSources: ["UTILITY_GIS", "SUBSTATION_PROVIDER"],
    evidenceRequirements: ["facility association", "feed status", "capacity signal or unknown status"],
  },
  {
    objectType: "POWER_CORRIDOR",
    category: "POWER",
    description: "Power infrastructure corridor relevant to long-term AI and data center development.",
    corridorRoles: ["AI_FABRIC", "REGIONAL_AGGREGATION", "BACKBONE_INTERCONNECT"],
    importance: "HIGH",
    monetizationImpact: ["AI_EXPANSION_POTENTIAL", "FUTURE_CAMPUS_OPPORTUNITY"],
    riskImpact: ["POWER_RISK", "CONSTRUCTION_RISK"],
    providerSources: ["TRANSMISSION_PROVIDER", "GENERATION_PROVIDER"],
    evidenceRequirements: ["corridor geometry", "power infrastructure type", "relationship to fiber corridor"],
  },
  {
    objectType: "DATA_CENTER",
    category: "INTERCONNECTION",
    description: "Data center facility relevant to demand, interconnection, and AI fabric planning.",
    corridorRoles: ["AI_FABRIC", "INTERCONNECTION", "METRO_AGGREGATION", "CAMPUS"],
    importance: "CRITICAL",
    monetizationImpact: ["TRANSPORT_REVENUE", "INTERCONNECTION_REVENUE", "AI_EXPANSION_POTENTIAL"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["DATA_CENTER_PROVIDER"],
    evidenceRequirements: ["facility name", "location", "operator or unknown status"],
  },
  {
    objectType: "CARRIER_HOTEL",
    category: "INTERCONNECTION",
    description: "Carrier hotel supporting network handoff and interconnection revenue.",
    corridorRoles: ["INTERCONNECTION", "BACKBONE_INTERCONNECT", "METRO_AGGREGATION", "AI_FABRIC"],
    importance: "HIGH",
    monetizationImpact: ["INTERCONNECTION_REVENUE", "TRANSPORT_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["CARRIER_HOTEL_PROVIDER"],
    evidenceRequirements: ["facility name", "location", "meet-me or cross-connect signal"],
  },
  {
    objectType: "IX",
    category: "INTERCONNECTION",
    description: "Internet exchange facility or node.",
    corridorRoles: ["INTERCONNECTION", "AI_FABRIC", "METRO_AGGREGATION"],
    importance: "HIGH",
    monetizationImpact: ["INTERCONNECTION_REVENUE", "TRANSPORT_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["IX_PROVIDER"],
    evidenceRequirements: ["exchange name", "facility association", "location"],
  },
  {
    objectType: "CLOUD_ONRAMP",
    category: "INTERCONNECTION",
    description: "Cloud on-ramp facility or service handoff.",
    corridorRoles: ["INTERCONNECTION", "AI_FABRIC", "METRO_AGGREGATION"],
    importance: "HIGH",
    monetizationImpact: ["INTERCONNECTION_REVENUE", "TRANSPORT_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["CLOUD_ONRAMP_PROVIDER"],
    evidenceRequirements: ["cloud provider", "facility association", "availability evidence"],
  },
  {
    objectType: "MEET_ME_ROOM",
    category: "INTERCONNECTION",
    description: "Meet-me room or physical handoff environment.",
    corridorRoles: ["CAMPUS", "INTERCONNECTION", "METRO_AGGREGATION"],
    importance: "MEDIUM",
    monetizationImpact: ["INTERCONNECTION_REVENUE", "COST_AVOIDANCE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["CARRIER_HOTEL_PROVIDER", "DATA_CENTER_PROVIDER"],
    evidenceRequirements: ["facility", "cross-connect availability", "access requirements"],
  },
  {
    objectType: "INTERCONNECT_FACILITY",
    category: "INTERCONNECTION",
    description: "Generic interconnection facility when exact facility type is unresolved.",
    corridorRoles: ["INTERCONNECTION", "AI_FABRIC", "METRO_AGGREGATION"],
    importance: "MEDIUM",
    monetizationImpact: ["INTERCONNECTION_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "CLOUD_ONRAMP_PROVIDER"],
    evidenceRequirements: ["facility type evidence", "location", "handoff capability"],
  },
  {
    objectType: "PARCEL",
    category: "PROPERTY",
    description: "Parcel evidence supporting ROW, development, or facility siting analysis.",
    corridorRoles: ALL_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["FUTURE_CAMPUS_OPPORTUNITY", "COST_AVOIDANCE"],
    riskImpact: ["PERMIT_RISK", "COMMERCIAL_RISK"],
    providerSources: ["PARCEL_PROVIDER", "COUNTY_GIS", "MUNICIPAL_GIS"],
    evidenceRequirements: ["parcel ID", "ownership or unknown status", "geometry or centroid"],
  },
  {
    objectType: "DEVELOPMENT_SITE",
    category: "PROPERTY",
    description: "Site with future campus, interconnection, or expansion potential.",
    corridorRoles: ["AI_FABRIC", "METRO_AGGREGATION", "REGIONAL_AGGREGATION", "CAMPUS"],
    importance: "HIGH",
    monetizationImpact: ["FUTURE_CAMPUS_OPPORTUNITY", "AI_EXPANSION_POTENTIAL"],
    riskImpact: ["COMMERCIAL_RISK", "PERMIT_RISK"],
    providerSources: ["LAND_PROVIDER", "PARCEL_PROVIDER", "DATA_CENTER_PROVIDER"],
    evidenceRequirements: ["site location", "availability or ownership signal", "development relevance"],
  },
  {
    objectType: "RIGHT_OF_WAY",
    category: "PROPERTY",
    description: "ROW evidence influencing constructability, cost, and diversity.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["PERMIT_RISK", "CONSTRUCTION_RISK"],
    providerSources: ["DOT_GIS", "COUNTY_GIS", "MUNICIPAL_GIS"],
    evidenceRequirements: ["ROW owner", "geometry", "access or permit requirement"],
  },
  {
    objectType: "UTILITY_EASEMENT",
    category: "PROPERTY",
    description: "Utility easement evidence affecting route feasibility and access.",
    corridorRoles: ALL_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["PERMIT_RISK", "CONSTRUCTION_RISK"],
    providerSources: ["UTILITY_GIS", "PARCEL_PROVIDER"],
    evidenceRequirements: ["easement geometry", "utility owner or unknown status", "access constraints"],
  },
  {
    objectType: "LSO",
    category: "NETWORK",
    description: "Local serving office or similar metro aggregation point.",
    corridorRoles: ["METRO_AGGREGATION"],
    importance: "CRITICAL",
    monetizationImpact: ["TRANSPORT_REVENUE", "DARK_FIBER_IRU"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["TERALINX_MODEL", "DATA_CENTER_PROVIDER"],
    evidenceRequirements: ["site ID", "location", "aggregation role"],
  },
  {
    objectType: "CO",
    category: "NETWORK",
    description: "Central office or carrier aggregation site.",
    corridorRoles: ["METRO_AGGREGATION", "INTERCONNECTION"],
    importance: "HIGH",
    monetizationImpact: ["TRANSPORT_REVENUE", "INTERCONNECTION_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["CARRIER_HOTEL_PROVIDER", "TERALINX_MODEL"],
    evidenceRequirements: ["site name", "location", "carrier role"],
  },
  {
    objectType: "WIRELESS_SITE",
    category: "NETWORK",
    description: "Wireless tower or site relevant to metro aggregation and monetization.",
    corridorRoles: ["METRO_AGGREGATION", "REGIONAL_AGGREGATION"],
    importance: "MEDIUM",
    monetizationImpact: ["TRANSPORT_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["TERALINX_MODEL", "MUNICIPAL_GIS", "COUNTY_GIS"],
    evidenceRequirements: ["site location", "site type", "proximity to corridor"],
  },
  {
    objectType: "AGGREGATION_NODE",
    category: "NETWORK",
    description: "Logical or physical aggregation point for metro, regional, or campus networks.",
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "REGIONAL_AGGREGATION"],
    importance: "HIGH",
    monetizationImpact: ["TRANSPORT_REVENUE", "RESIDUAL_CAPACITY"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["node role", "connected assets", "service function"],
  },
  {
    objectType: "BACKBONE_NODE",
    category: "NETWORK",
    description: "Backbone node supporting intercity transport and longhaul handoff.",
    corridorRoles: ["BACKBONE_INTERCONNECT", "AI_FABRIC", "MSA_INTERCONNECT"],
    importance: "CRITICAL",
    monetizationImpact: ["TRANSPORT_REVENUE", "INTERCONNECTION_REVENUE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL", "CARRIER_HOTEL_PROVIDER"],
    evidenceRequirements: ["node ID", "facility or location", "transport role"],
  },
  {
    objectType: "JURISDICTION",
    category: "OPERATIONAL",
    description: "Permitting or governmental authority affecting corridor execution.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["PERMIT_RISK"],
    providerSources: ["DOT_GIS", "COUNTY_GIS", "MUNICIPAL_GIS"],
    evidenceRequirements: ["authority name", "segment relationship", "permit requirement"],
  },
  {
    objectType: "CROSSING",
    category: "OPERATIONAL",
    description: "Road, rail, water, bridge, highway, or other crossing.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["CONSTRUCTION_RISK", "PERMIT_RISK"],
    providerSources: ["DOT_GIS", "COUNTY_GIS", "MUNICIPAL_GIS"],
    evidenceRequirements: ["crossing type", "location", "method or unknown status"],
  },
  {
    objectType: "CONSTRAINT",
    category: "OPERATIONAL",
    description: "General constraint that can affect route, cost, feasibility, or timing.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["CONSTRUCTION_RISK", "ENVIRONMENTAL_RISK", "PERMIT_RISK"],
    providerSources: ["DOT_GIS", "COUNTY_GIS", "MUNICIPAL_GIS", "UTILITY_GIS", "TERALINX_MODEL"],
    evidenceRequirements: ["constraint type", "severity", "affected segment or area"],
  },
  {
    objectType: "ENVIRONMENTAL_AREA",
    category: "OPERATIONAL",
    description: "Environmental area or restriction that may limit construction.",
    corridorRoles: ALL_ROLES,
    importance: "CRITICAL",
    monetizationImpact: ["NONE"],
    riskImpact: ["ENVIRONMENTAL_RISK", "PERMIT_RISK"],
    providerSources: ["DOT_GIS", "COUNTY_GIS", "MUNICIPAL_GIS"],
    evidenceRequirements: ["area type", "restriction status", "geometry"],
  },
  {
    objectType: "PERMIT_ZONE",
    category: "OPERATIONAL",
    description: "Area or segment with permit authority and process implications.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["PERMIT_RISK"],
    providerSources: ["DOT_GIS", "COUNTY_GIS", "MUNICIPAL_GIS"],
    evidenceRequirements: ["permit authority", "zone geometry", "lead-time or unknown status"],
  },
  {
    objectType: "MAINTENANCE_ZONE",
    category: "OPERATIONAL",
    description: "Zone affecting ongoing access, maintenance burden, or OPEX.",
    corridorRoles: ALL_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL", "UTILITY_GIS"],
    evidenceRequirements: ["zone definition", "access signal", "maintenance assumption"],
  },
  {
    objectType: "RESTORATION_ZONE",
    category: "OPERATIONAL",
    description: "Zone affecting restoration time, crew access, or spare path requirements.",
    corridorRoles: ALL_ROLES,
    importance: "MEDIUM",
    monetizationImpact: ["COST_AVOIDANCE"],
    riskImpact: ["OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL", "DOT_GIS", "COUNTY_GIS"],
    evidenceRequirements: ["zone definition", "crew access signal", "restoration assumption"],
  },
  {
    objectType: "DUCT_OPPORTUNITY",
    category: "MONETIZATION",
    description: "Opportunity to sell or lease duct capacity.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["DUCT_SALE", "RESIDUAL_CAPACITY"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["available duct", "buyer or market signal", "commercial assumption"],
  },
  {
    objectType: "DARK_FIBER_OPPORTUNITY",
    category: "MONETIZATION",
    description: "Opportunity to monetize dark fiber through IRU or managed fiber.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["DARK_FIBER_IRU"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["TERALINX_MODEL", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    evidenceRequirements: ["available strands", "demand signal", "term assumption"],
  },
  {
    objectType: "TRANSPORT_OPPORTUNITY",
    category: "MONETIZATION",
    description: "Opportunity to monetize lit transport, waves, or Ethernet.",
    corridorRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "MSA_INTERCONNECT", "INTERCONNECTION"],
    importance: "HIGH",
    monetizationImpact: ["TRANSPORT_REVENUE"],
    riskImpact: ["COMMERCIAL_RISK", "OPERATIONAL_RISK"],
    providerSources: ["TERALINX_MODEL", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "CLOUD_ONRAMP_PROVIDER"],
    evidenceRequirements: ["serviceable endpoints", "capacity signal", "customer or market signal"],
  },
  {
    objectType: "IRU_OPPORTUNITY",
    category: "MONETIZATION",
    description: "Opportunity to sell long-term IRU rights on fiber or conduit.",
    corridorRoles: ALL_ROLES,
    importance: "HIGH",
    monetizationImpact: ["DARK_FIBER_IRU", "DUCT_SALE"],
    riskImpact: ["COMMERCIAL_RISK"],
    providerSources: ["TERALINX_MODEL"],
    evidenceRequirements: ["asset capacity", "IRU term assumption", "buyer or market signal"],
  },
  {
    objectType: "EXPANSION_OPPORTUNITY",
    category: "MONETIZATION",
    description: "Future expansion opportunity tied to campuses, power, parcels, or adjacent demand.",
    corridorRoles: ["AI_FABRIC", "METRO_AGGREGATION", "REGIONAL_AGGREGATION", "CAMPUS"],
    importance: "HIGH",
    monetizationImpact: ["FUTURE_CAMPUS_OPPORTUNITY", "AI_EXPANSION_POTENTIAL"],
    riskImpact: ["COMMERCIAL_RISK", "PERMIT_RISK"],
    providerSources: ["LAND_PROVIDER", "PARCEL_PROVIDER", "SUBSTATION_PROVIDER", "DATA_CENTER_PROVIDER"],
    evidenceRequirements: ["expansion driver", "site or demand evidence", "capacity relationship"],
  },
]);

export function getCorridorObjectDefinition(objectType: CorridorObjectType): CorridorObjectDefinition | undefined {
  return CORRIDOR_OBJECT_CATALOG.find((definition) => definition.objectType === objectType);
}

export function listCorridorObjectsByCategory(category: CorridorObjectCategory): CorridorObjectDefinition[] {
  return CORRIDOR_OBJECT_CATALOG.filter((definition) => definition.category === category);
}

export function listCorridorObjectsForRole(role: CorridorNetworkRole): CorridorObjectDefinition[] {
  return CORRIDOR_OBJECT_CATALOG.filter((definition) => definition.corridorRoles.includes(role));
}

