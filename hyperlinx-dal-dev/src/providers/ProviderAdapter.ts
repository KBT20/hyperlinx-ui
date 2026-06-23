import type { CorridorNetworkRole } from "../corridor/corridorTypes";
import type {
  ProviderCapability,
  ProviderEvidenceResult,
  ProviderRequest,
  ProviderStatus,
  ProviderType,
} from "./ProviderContract";

export interface ProviderAdapter {
  providerId: string;
  providerType: ProviderType;
  capabilities: ProviderCapability[];
  status: ProviderStatus;
  supportsRole(role: CorridorNetworkRole): boolean;
  createRequest(input: ProviderRequest): unknown;
  normalizeResponse(response: unknown): ProviderEvidenceResult;
}

