import { createStubProviderAdapter } from "./StubProviderAdapter";

export const TeralinxModelAdapter = createStubProviderAdapter({
  providerId: "provider-teralinx-model",
  providerType: "TERALINX_MODEL",
  capabilities: ["CORRIDOR_MODELING", "EVIDENCE_NORMALIZATION"],
  supportedRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "CAMPUS", "METRO_AGGREGATION", "REGIONAL_AGGREGATION"],
});

