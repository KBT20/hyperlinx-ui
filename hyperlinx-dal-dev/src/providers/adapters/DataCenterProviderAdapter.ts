import { createStubProviderAdapter } from "./StubProviderAdapter";

export const DataCenterProviderAdapter = createStubProviderAdapter({
  providerId: "provider-data-center",
  providerType: "DATA_CENTER_PROVIDER",
  capabilities: ["DATA_CENTER_LOOKUP", "INTERCONNECTION_LOOKUP"],
  supportedRoles: ["AI_FABRIC", "INTERCONNECTION", "METRO_AGGREGATION", "CAMPUS"],
});

