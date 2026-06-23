import { createStubProviderAdapter } from "./StubProviderAdapter";

export const UtilityGisProviderAdapter = createStubProviderAdapter({
  providerId: "provider-utility-gis",
  providerType: "UTILITY_GIS",
  capabilities: ["UTILITY_INFRASTRUCTURE", "CONSTRAINT_GEOMETRY", "GIS_GEOMETRY"],
  supportedRoles: ["METRO_AGGREGATION", "MSA_INTERCONNECT", "REGIONAL_AGGREGATION", "CAMPUS"],
});

