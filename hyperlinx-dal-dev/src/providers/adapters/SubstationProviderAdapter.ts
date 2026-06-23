import { createStubProviderAdapter } from "./StubProviderAdapter";

export const SubstationProviderAdapter = createStubProviderAdapter({
  providerId: "provider-substation",
  providerType: "SUBSTATION_PROVIDER",
  capabilities: ["POWER_SUBSTATION", "POWER_TRANSMISSION"],
  supportedRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT"],
});

