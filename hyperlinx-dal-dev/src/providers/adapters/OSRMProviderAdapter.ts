import { createStubProviderAdapter } from "./StubProviderAdapter";

export const OSRMProviderAdapter = createStubProviderAdapter({
  providerId: "provider-osrm",
  providerType: "OSRM",
  capabilities: ["ROUTING", "ROAD_SNAP", "ROUTE_GEOMETRY"],
  supportedRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
});

