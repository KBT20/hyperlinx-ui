import type { CorridorEvidenceBundle } from "./CorridorNormalizedEvidence";
import type {
  CorridorCandidate,
  CorridorCandidateSource,
  CorridorCandidateType,
} from "./CorridorCandidate";
import type { CorridorCoordinate } from "./corridorTypes";

export type CorridorSynthesisInputType =
  | "ENDPOINT_PAIR"
  | "CUSTOMER_ROUTE"
  | "KML"
  | "KMZ"
  | "GEOJSON"
  | "SHAPEFILE"
  | "CORRIDOR_CONCEPT"
  | "EXISTING_FIBER_ROUTE"
  | "EXISTING_CONDUIT_ROUTE";

export type CorridorSynthesisProviderType =
  | "OSRM"
  | "GRAPHHOPPER"
  | "OPENROUTESERVICE"
  | "GOOGLE_ROADS"
  | "DOT_GIS"
  | "CUSTOMER_GEOMETRY"
  | "HUMAN_ENGINEERED"
  | "INTERNAL_TERALINX_MODEL";

export interface CorridorSynthesisProvider {
  providerId: string;
  providerType: CorridorSynthesisProviderType;
  displayName: string;
  evidenceOnly: true;
  supportedInputTypes: CorridorSynthesisInputType[];
  candidateTypes: CorridorCandidateType[];
  producesGeometry: boolean;
  producesAttributes: boolean;
  notes?: string;
}

export interface CorridorSynthesisInputReference {
  inputId: string;
  inputType: CorridorSynthesisInputType;
  evidenceIds: string[];
  description?: string;
}

export interface CorridorSynthesisRequest {
  requestId: string;
  corridorId?: string;
  endpointIds: string[];
  requirementIds: string[];
  inputs: CorridorSynthesisInputReference[];
  evidenceBundle: CorridorEvidenceBundle;
  requestedCandidateTypes: CorridorCandidateType[];
  allowedProviders: CorridorSynthesisProviderType[];
  preserveCustomerGeometry: true;
  desiredDiversity?: "NONE" | "PATH_DIVERSE" | "ROUTE_DIVERSE" | "NODE_DIVERSE" | "GEO_DIVERSE";
  constraints?: {
    maxLatencyMs?: number;
    maxDistanceMiles?: number;
    avoidEvidenceIds?: string[];
    preferEvidenceIds?: string[];
  };
}

export interface CorridorSynthesisDiagnostic {
  diagnosticId: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  code: string;
  message: string;
  providerId?: string;
  candidateId?: string;
  evidenceIds: string[];
}

export interface CorridorSynthesisResult {
  requestId: string;
  corridorId?: string;
  candidates: CorridorCandidate[];
  providersConsidered: CorridorSynthesisProvider[];
  preservedCustomerGeometryEvidenceIds: string[];
  diagnostics: CorridorSynthesisDiagnostic[];
  unsupportedInputs: CorridorSynthesisInputReference[];
  generatedAt: string;
}

export interface CorridorSynthesisCandidateDraft {
  candidateId: string;
  candidateType: CorridorCandidateType;
  candidateSource: CorridorCandidateSource;
  geometry: CorridorCoordinate[];
  evidenceIds: string[];
  providerId?: string;
}

