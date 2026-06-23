import { createStubProviderAdapter } from "./StubProviderAdapter";

export const GraphHopperProviderAdapter = createStubProviderAdapter({
  providerId: "provider-graphhopper",
  providerType: "GRAPHHOPPER",
  capabilities: ["ROUTING", "ROUTE_GEOMETRY"],
  supportedRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
});

