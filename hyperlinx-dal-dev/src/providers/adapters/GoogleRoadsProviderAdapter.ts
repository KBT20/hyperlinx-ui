import { createStubProviderAdapter } from "./StubProviderAdapter";

export const GoogleRoadsProviderAdapter = createStubProviderAdapter({
  providerId: "provider-google-roads",
  providerType: "GOOGLE_ROADS",
  capabilities: ["ROAD_SNAP", "ROUTE_GEOMETRY"],
  supportedRoles: ["METRO_AGGREGATION", "CAMPUS", "INTERCONNECTION"],
});

