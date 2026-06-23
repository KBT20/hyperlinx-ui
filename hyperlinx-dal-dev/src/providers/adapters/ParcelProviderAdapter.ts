import { createStubProviderAdapter } from "./StubProviderAdapter";

export const ParcelProviderAdapter = createStubProviderAdapter({
  providerId: "provider-parcel",
  providerType: "PARCEL_PROVIDER",
  capabilities: ["PARCEL_LOOKUP", "LAND_OWNERSHIP", "CONSTRAINT_GEOMETRY"],
  supportedRoles: ["METRO_AGGREGATION", "AI_FABRIC", "INTERCONNECTION", "CAMPUS", "REGIONAL_AGGREGATION"],
});

