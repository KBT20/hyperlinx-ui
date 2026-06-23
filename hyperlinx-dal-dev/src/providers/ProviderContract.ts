import type { CorridorCoordinate, CorridorEvidenceEntityType, CorridorNetworkRole } from "../corridor/corridorTypes";

export type ProviderType =
  | "OSRM"
  | "GRAPHHOPPER"
  | "OPENROUTESERVICE"
  | "GOOGLE_ROADS"
  | "DOT_GIS"
  | "COUNTY_GIS"
  | "MUNICIPAL_GIS"
  | "UTILITY_GIS"
  | "SUBSTATION_PROVIDER"
  | "TRANSMISSION_PROVIDER"
  | "GENERATION_PROVIDER"
  | "DATA_CENTER_PROVIDER"
  | "CARRIER_HOTEL_PROVIDER"
  | "IX_PROVIDER"
  | "CLOUD_ONRAMP_PROVIDER"
  | "PARCEL_PROVIDER"
  | "LAND_PROVIDER"
  | "TERALINX_MODEL";

export type ProviderCapability =
  | "ROUTING"
  | "ROAD_SNAP"
  | "ROUTE_GEOMETRY"
  | "GIS_GEOMETRY"
  | "CONSTRAINT_GEOMETRY"
  | "CROSSING_DETECTION"
  | "JURISDICTION_LOOKUP"
  | "PARCEL_LOOKUP"
  | "LAND_OWNERSHIP"
  | "POWER_SUBSTATION"
  | "POWER_TRANSMISSION"
  | "POWER_GENERATION"
  | "UTILITY_INFRASTRUCTURE"
  | "INTERCONNECTION_LOOKUP"
  | "DATA_CENTER_LOOKUP"
  | "CARRIER_HOTEL_LOOKUP"
  | "IX_LOOKUP"
  | "CLOUD_ONRAMP_LOOKUP"
  | "CORRIDOR_MODELING"
  | "EVIDENCE_NORMALIZATION";

export type ProviderStatus =
  | "REGISTERED"
  | "AVAILABLE"
  | "DISABLED"
  | "NOT_IMPLEMENTED"
  | "DEPRECATED";

export type ProviderDiagnosticCode =
  | "PROVIDER_REGISTERED"
  | "PROVIDER_SELECTED"
  | "PROVIDER_ROLE_MATCH"
  | "PROVIDER_NOT_IMPLEMENTED"
  | "PROVIDER_RESPONSE_NORMALIZED"
  | "PROVIDER_WARNING"
  | "PROVIDER_ERROR";

export interface ProviderDiagnostic {
  code: ProviderDiagnosticCode;
  providerId?: string;
  providerType?: ProviderType;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ProviderRequest {
  requestId: string;
  corridorId?: string;
  role?: CorridorNetworkRole;
  providerType?: ProviderType;
  capabilities: ProviderCapability[];
  geometry?: CorridorCoordinate[];
  coordinates?: CorridorCoordinate[];
  evidenceIds: string[];
  input?: unknown;
  createdAt: string;
}

export interface ProviderEvidenceResult {
  resultId: string;
  providerId: string;
  providerType: ProviderType;
  capabilities: ProviderCapability[];
  entityType?: CorridorEvidenceEntityType;
  normalizedValue?: unknown;
  geometry?: CorridorCoordinate[];
  confidence: number;
  evidenceIds: string[];
  diagnostics: ProviderDiagnostic[];
  notes?: string;
}

export interface ProviderResponse {
  responseId: string;
  requestId: string;
  providerId: string;
  providerType: ProviderType;
  status: ProviderStatus;
  evidenceResults: ProviderEvidenceResult[];
  diagnostics: ProviderDiagnostic[];
  rawResponse?: unknown;
  receivedAt: string;
}

export interface ProviderDefinition {
  providerId: string;
  name: string;
  providerType: ProviderType;
  category: "ROUTING" | "INFRASTRUCTURE" | "POWER" | "INTERCONNECTION" | "PROPERTY" | "INTERNAL";
  capabilities: ProviderCapability[];
  status: ProviderStatus;
  implementationStatus: ProviderStatus;
  preferredRoles: CorridorNetworkRole[];
  description: string;
}
