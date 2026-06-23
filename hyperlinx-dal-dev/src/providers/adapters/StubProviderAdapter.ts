import type { CorridorNetworkRole } from "../../corridor/corridorTypes";
import type { ProviderAdapter } from "../ProviderAdapter";
import type {
  ProviderCapability,
  ProviderDiagnostic,
  ProviderEvidenceResult,
  ProviderRequest,
  ProviderType,
} from "../ProviderContract";

function diagnostic(
  providerId: string,
  providerType: ProviderType,
  message: string,
  details?: Record<string, unknown>,
): ProviderDiagnostic {
  return {
    code: "PROVIDER_NOT_IMPLEMENTED",
    providerId,
    providerType,
    message,
    severity: "INFO",
    timestamp: new Date().toISOString(),
    details,
  };
}

export function createStubProviderAdapter(input: {
  providerId: string;
  providerType: ProviderType;
  capabilities: ProviderCapability[];
  supportedRoles: CorridorNetworkRole[];
}): ProviderAdapter {
  return {
    providerId: input.providerId,
    providerType: input.providerType,
    capabilities: input.capabilities,
    status: "NOT_IMPLEMENTED",
    supportsRole(role: CorridorNetworkRole): boolean {
      const supported = input.supportedRoles.includes(role);
      console.log("[PROVIDER_ROLE_MATCH]", {
        providerId: input.providerId,
        providerType: input.providerType,
        role,
        supported,
      });
      return supported;
    },
    createRequest(request: ProviderRequest): unknown {
      const result = {
        providerId: input.providerId,
        providerType: input.providerType,
        request,
        status: "NOT_IMPLEMENTED",
      };

      console.log("[PROVIDER_NOT_IMPLEMENTED]", {
        providerId: input.providerId,
        providerType: input.providerType,
        requestId: request.requestId,
      });

      return result;
    },
    normalizeResponse(response: unknown): ProviderEvidenceResult {
      const result: ProviderEvidenceResult = {
        resultId: `${input.providerId}-not-implemented`,
        providerId: input.providerId,
        providerType: input.providerType,
        capabilities: input.capabilities,
        normalizedValue: {
          response,
          status: "NOT_IMPLEMENTED",
        },
        confidence: 0,
        evidenceIds: [],
        diagnostics: [
          diagnostic(input.providerId, input.providerType, "Provider adapter is registered but not implemented.", {
            response,
          }),
        ],
        notes: "Stub adapter only. No live API call was made.",
      };

      console.log("[PROVIDER_RESPONSE_NORMALIZED]", {
        providerId: input.providerId,
        providerType: input.providerType,
        resultId: result.resultId,
        evidenceCount: result.evidenceIds.length,
      });

      return result;
    },
  };
}

