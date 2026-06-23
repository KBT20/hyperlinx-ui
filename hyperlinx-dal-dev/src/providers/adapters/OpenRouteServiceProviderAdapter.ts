import { createStubProviderAdapter } from "./StubProviderAdapter";

export const OpenRouteServiceProviderAdapter = createStubProviderAdapter({
  providerId: "provider-openrouteservice",
  providerType: "OPENROUTESERVICE",
  capabilities: ["ROUTING", "ROUTE_GEOMETRY"],
  supportedRoles: ["MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
});

