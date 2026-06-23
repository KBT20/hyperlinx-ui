import { createStubProviderAdapter } from "./StubProviderAdapter";

export const DotGisProviderAdapter = createStubProviderAdapter({
  providerId: "provider-dot-gis",
  providerType: "DOT_GIS",
  capabilities: ["GIS_GEOMETRY", "JURISDICTION_LOOKUP", "CROSSING_DETECTION"],
  supportedRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "REGIONAL_AGGREGATION"],
});

