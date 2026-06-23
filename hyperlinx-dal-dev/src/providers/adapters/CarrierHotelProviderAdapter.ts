import { createStubProviderAdapter } from "./StubProviderAdapter";

export const CarrierHotelProviderAdapter = createStubProviderAdapter({
  providerId: "provider-carrier-hotel",
  providerType: "CARRIER_HOTEL_PROVIDER",
  capabilities: ["CARRIER_HOTEL_LOOKUP", "INTERCONNECTION_LOOKUP"],
  supportedRoles: ["AI_FABRIC", "INTERCONNECTION", "BACKBONE_INTERCONNECT", "METRO_AGGREGATION"],
});

