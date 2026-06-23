import type { ProviderType } from "../providers/ProviderContract";
import type { CorridorObjectType } from "./CorridorObjectCatalog";
import type { PrismScoreCategory } from "./PrismScoreContract";

export type CorridorLensType =
  | "HYPERSCALER"
  | "NEOCLOUD"
  | "ENTERPRISE"
  | "DUCT_MONETIZATION"
  | "DARK_FIBER_IRU"
  | "TRANSPORT"
  | "INTERCONNECTION"
  | "POWER_AI_EXPANSION"
  | "MUNICIPAL"
  | "UTILITY"
  | "CARRIER_WHOLESALE";

export type CorridorLensFutureObjectType =
  | "HYPERSCALER_CAMPUS"
  | "GPU_ARRAY"
  | "ENTERPRISE_BUILDING"
  | "OFFICE_PARK"
  | "INDUSTRIAL_PARK"
  | "HOSPITAL"
  | "UNIVERSITY"
  | "GOVERNMENT_SITE"
  | "ISP"
  | "WISP"
  | "MUNICIPAL_SITE"
  | "UTILITY"
  | "SCHOOL";

export type CorridorLensObjectType = CorridorObjectType | CorridorLensFutureObjectType;

export type CorridorLensFutureProviderType =
  | "WIRELESS_SITE_PROVIDER"
  | "ENTERPRISE_DATA_PROVIDER"
  | "BUILDING_DATA_PROVIDER"
  | "MUNICIPAL_SITE_PROVIDER"
  | "SCHOOL_PROVIDER"
  | "UTILITY_SITE_PROVIDER";

export type CorridorLensProviderType = ProviderType | CorridorLensFutureProviderType;

export type CorridorLensPriority = "PRIMARY" | "SECONDARY" | "LOW" | "IGNORED";
export type CorridorLensScoringEmphasis = "HIGH" | "MEDIUM" | "LOW" | "IGNORED";

export interface CorridorLensObjectPriority {
  objectType: CorridorLensObjectType;
  priority: CorridorLensPriority;
  reason: string;
}

export interface CorridorLensProviderPriority {
  providerType: CorridorLensProviderType;
  priority: CorridorLensPriority;
  reason: string;
}

export interface CorridorLensScoringPriority {
  category: PrismScoreCategory;
  emphasis: CorridorLensScoringEmphasis;
  reason: string;
}

export interface CorridorLensDiagnostic {
  code:
    | "CORRIDOR_LENS_SELECTED"
    | "CORRIDOR_LENS_OBJECT_PRIORITY"
    | "CORRIDOR_LENS_PROVIDER_PRIORITY"
    | "CORRIDOR_LENS_SCORING_PRIORITY"
    | "CORRIDOR_LENS_APPLIED"
    | "CORRIDOR_LENS_WARNING";
  lensType?: CorridorLensType;
  severity: "INFO" | "WARNING";
  message: string;
  details?: Record<string, unknown>;
}

export interface CorridorLensDefinition {
  lensType: CorridorLensType;
  displayName: string;
  purpose: string;
  objectPriorities: CorridorLensObjectPriority[];
  providerPriorities: CorridorLensProviderPriority[];
  scoringPriorities: CorridorLensScoringPriority[];
  monetizationRelevance: string[];
  risksToElevate: string[];
}

export interface CorridorLensApplication {
  lensType: CorridorLensType;
  prioritizedObjectTypes: CorridorLensObjectType[];
  prioritizedProviderTypes: CorridorLensProviderType[];
  prioritizedScoringCategories: PrismScoreCategory[];
  ignoredObjectTypes: CorridorLensObjectType[];
  warnings: string[];
  diagnostics: CorridorLensDiagnostic[];
}

