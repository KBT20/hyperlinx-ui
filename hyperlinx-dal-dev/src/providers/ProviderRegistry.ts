import type { CorridorNetworkRole } from "../corridor/corridorTypes";
import type { ProviderCapability, ProviderDefinition, ProviderType } from "./ProviderContract";

export const PROVIDER_TYPES_BY_ROLE: Readonly<Record<CorridorNetworkRole, readonly ProviderType[]>> = Object.freeze({
  CAMPUS: ["MUNICIPAL_GIS", "UTILITY_GIS", "PARCEL_PROVIDER", "DATA_CENTER_PROVIDER", "TERALINX_MODEL"],
  METRO_AGGREGATION: ["MUNICIPAL_GIS", "PARCEL_PROVIDER", "UTILITY_GIS", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
  MSA_INTERCONNECT: ["DOT_GIS", "COUNTY_GIS", "UTILITY_GIS", "TRANSMISSION_PROVIDER", "OSRM", "GRAPHHOPPER"],
  BACKBONE_INTERCONNECT: ["DOT_GIS", "TRANSMISSION_PROVIDER", "GENERATION_PROVIDER", "CARRIER_HOTEL_PROVIDER", "TERALINX_MODEL"],
  AI_FABRIC: [
    "SUBSTATION_PROVIDER",
    "TRANSMISSION_PROVIDER",
    "GENERATION_PROVIDER",
    "DATA_CENTER_PROVIDER",
    "CARRIER_HOTEL_PROVIDER",
    "CLOUD_ONRAMP_PROVIDER",
    "PARCEL_PROVIDER",
    "TERALINX_MODEL",
  ],
  REGIONAL_AGGREGATION: ["COUNTY_GIS", "DOT_GIS", "UTILITY_GIS", "PARCEL_PROVIDER", "TRANSMISSION_PROVIDER"],
  INTERCONNECTION: ["CARRIER_HOTEL_PROVIDER", "IX_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "DATA_CENTER_PROVIDER", "PARCEL_PROVIDER"],
});

const DEFAULT_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    providerId: "provider-osrm",
    name: "OSRM",
    providerType: "OSRM",
    category: "ROUTING",
    capabilities: ["ROUTING", "ROAD_SNAP", "ROUTE_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
    description: "Future OSRM routing and nearest-road evidence adapter.",
  },
  {
    providerId: "provider-graphhopper",
    name: "GraphHopper",
    providerType: "GRAPHHOPPER",
    category: "ROUTING",
    capabilities: ["ROUTING", "ROUTE_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
    description: "Future GraphHopper routing evidence adapter.",
  },
  {
    providerId: "provider-openrouteservice",
    name: "OpenRouteService",
    providerType: "OPENROUTESERVICE",
    category: "ROUTING",
    capabilities: ["ROUTING", "ROUTE_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
    description: "Future OpenRouteService routing evidence adapter.",
  },
  {
    providerId: "provider-google-roads",
    name: "Google Roads",
    providerType: "GOOGLE_ROADS",
    category: "ROUTING",
    capabilities: ["ROAD_SNAP", "ROUTE_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["METRO_AGGREGATION", "CAMPUS", "INTERCONNECTION"],
    description: "Future Google Roads evidence adapter.",
  },
  {
    providerId: "provider-dot-gis",
    name: "DOT GIS",
    providerType: "DOT_GIS",
    category: "INFRASTRUCTURE",
    capabilities: ["GIS_GEOMETRY", "JURISDICTION_LOOKUP", "CROSSING_DETECTION"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "REGIONAL_AGGREGATION"],
    description: "Future state DOT GIS evidence adapter.",
  },
  {
    providerId: "provider-county-gis",
    name: "County GIS",
    providerType: "COUNTY_GIS",
    category: "INFRASTRUCTURE",
    capabilities: ["GIS_GEOMETRY", "JURISDICTION_LOOKUP", "PARCEL_LOOKUP"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
    description: "Future county GIS evidence adapter.",
  },
  {
    providerId: "provider-municipal-gis",
    name: "Municipal GIS",
    providerType: "MUNICIPAL_GIS",
    category: "INFRASTRUCTURE",
    capabilities: ["GIS_GEOMETRY", "JURISDICTION_LOOKUP", "CONSTRAINT_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["METRO_AGGREGATION", "CAMPUS"],
    description: "Future municipal GIS evidence adapter.",
  },
  {
    providerId: "provider-utility-gis",
    name: "Utility GIS",
    providerType: "UTILITY_GIS",
    category: "INFRASTRUCTURE",
    capabilities: ["UTILITY_INFRASTRUCTURE", "CONSTRAINT_GEOMETRY", "GIS_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["METRO_AGGREGATION", "MSA_INTERCONNECT", "REGIONAL_AGGREGATION", "CAMPUS"],
    description: "Future utility GIS evidence adapter.",
  },
  {
    providerId: "provider-substation",
    name: "Substation Dataset",
    providerType: "SUBSTATION_PROVIDER",
    category: "POWER",
    capabilities: ["POWER_SUBSTATION", "POWER_TRANSMISSION"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT"],
    description: "Future substation evidence adapter.",
  },
  {
    providerId: "provider-transmission",
    name: "Transmission Dataset",
    providerType: "TRANSMISSION_PROVIDER",
    category: "POWER",
    capabilities: ["POWER_TRANSMISSION", "CONSTRAINT_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
    description: "Future transmission evidence adapter.",
  },
  {
    providerId: "provider-generation",
    name: "Generation Dataset",
    providerType: "GENERATION_PROVIDER",
    category: "POWER",
    capabilities: ["POWER_GENERATION"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT"],
    description: "Future generation evidence adapter.",
  },
  {
    providerId: "provider-data-center",
    name: "Data Center Dataset",
    providerType: "DATA_CENTER_PROVIDER",
    category: "INTERCONNECTION",
    capabilities: ["DATA_CENTER_LOOKUP", "INTERCONNECTION_LOOKUP"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "INTERCONNECTION", "METRO_AGGREGATION", "CAMPUS"],
    description: "Future data center evidence adapter.",
  },
  {
    providerId: "provider-carrier-hotel",
    name: "Carrier Hotel Dataset",
    providerType: "CARRIER_HOTEL_PROVIDER",
    category: "INTERCONNECTION",
    capabilities: ["CARRIER_HOTEL_LOOKUP", "INTERCONNECTION_LOOKUP"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "INTERCONNECTION", "BACKBONE_INTERCONNECT", "METRO_AGGREGATION"],
    description: "Future carrier hotel evidence adapter.",
  },
  {
    providerId: "provider-ix",
    name: "IX Dataset",
    providerType: "IX_PROVIDER",
    category: "INTERCONNECTION",
    capabilities: ["IX_LOOKUP", "INTERCONNECTION_LOOKUP"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["INTERCONNECTION", "AI_FABRIC"],
    description: "Future internet exchange evidence adapter.",
  },
  {
    providerId: "provider-cloud-onramp",
    name: "Cloud On-Ramp Dataset",
    providerType: "CLOUD_ONRAMP_PROVIDER",
    category: "INTERCONNECTION",
    capabilities: ["CLOUD_ONRAMP_LOOKUP", "INTERCONNECTION_LOOKUP"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["INTERCONNECTION", "AI_FABRIC"],
    description: "Future cloud on-ramp evidence adapter.",
  },
  {
    providerId: "provider-parcel",
    name: "Parcel Dataset",
    providerType: "PARCEL_PROVIDER",
    category: "PROPERTY",
    capabilities: ["PARCEL_LOOKUP", "LAND_OWNERSHIP", "CONSTRAINT_GEOMETRY"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["METRO_AGGREGATION", "AI_FABRIC", "INTERCONNECTION", "CAMPUS", "REGIONAL_AGGREGATION"],
    description: "Future parcel evidence adapter.",
  },
  {
    providerId: "provider-land",
    name: "Land Ownership Dataset",
    providerType: "LAND_PROVIDER",
    category: "PROPERTY",
    capabilities: ["LAND_OWNERSHIP", "PARCEL_LOOKUP"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "REGIONAL_AGGREGATION", "CAMPUS"],
    description: "Future land ownership evidence adapter.",
  },
  {
    providerId: "provider-teralinx-model",
    name: "Teralinx Model",
    providerType: "TERALINX_MODEL",
    category: "INTERNAL",
    capabilities: ["CORRIDOR_MODELING", "EVIDENCE_NORMALIZATION"],
    status: "REGISTERED",
    implementationStatus: "NOT_IMPLEMENTED",
    preferredRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "CAMPUS", "METRO_AGGREGATION", "REGIONAL_AGGREGATION"],
    description: "Future internal Teralinx modeling evidence adapter.",
  },
];

export const DEFAULT_PROVIDER_REGISTRY: readonly ProviderDefinition[] = Object.freeze(DEFAULT_PROVIDER_DEFINITIONS);

export function registerProvider(
  provider: ProviderDefinition,
  registry: readonly ProviderDefinition[] = DEFAULT_PROVIDER_REGISTRY,
): readonly ProviderDefinition[] {
  console.log("[PROVIDER_REGISTERED]", {
    providerId: provider.providerId,
    providerType: provider.providerType,
    status: provider.status,
    implementationStatus: provider.implementationStatus,
  });

  return Object.freeze([...registry.filter((entry) => entry.providerId !== provider.providerId), provider]);
}

export function getProvider(
  providerId: string,
  registry: readonly ProviderDefinition[] = DEFAULT_PROVIDER_REGISTRY,
): ProviderDefinition | undefined {
  return registry.find((provider) => provider.providerId === providerId);
}

export function listProviders(registry: readonly ProviderDefinition[] = DEFAULT_PROVIDER_REGISTRY): readonly ProviderDefinition[] {
  return registry;
}

export function listProvidersByCapability(
  capability: ProviderCapability,
  registry: readonly ProviderDefinition[] = DEFAULT_PROVIDER_REGISTRY,
): ProviderDefinition[] {
  return registry.filter((provider) => provider.capabilities.includes(capability));
}

export function getProvidersForRole(
  role: CorridorNetworkRole,
  registry: readonly ProviderDefinition[] = DEFAULT_PROVIDER_REGISTRY,
): ProviderDefinition[] {
  const preferredTypes = PROVIDER_TYPES_BY_ROLE[role];
  const providers = registry.filter(
    (provider) => preferredTypes.includes(provider.providerType) || provider.preferredRoles.includes(role),
  );

  console.log("[PROVIDER_SELECTED]", {
    role,
    providerIds: providers.map((provider) => provider.providerId),
  });

  return providers;
}

export function providerTypesForRole(role: CorridorNetworkRole): readonly ProviderType[] {
  console.log("[PROVIDER_ROLE_MATCH]", {
    role,
    providerTypes: PROVIDER_TYPES_BY_ROLE[role],
  });

  return PROVIDER_TYPES_BY_ROLE[role];
}
