import { createStubProviderAdapter } from "./StubProviderAdapter";

export const TransmissionProviderAdapter = createStubProviderAdapter({
  providerId: "provider-transmission",
  providerType: "TRANSMISSION_PROVIDER",
  capabilities: ["POWER_TRANSMISSION", "CONSTRAINT_GEOMETRY"],
  supportedRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "MSA_INTERCONNECT", "REGIONAL_AGGREGATION"],
});

