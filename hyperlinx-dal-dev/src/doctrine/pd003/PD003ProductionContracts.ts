import type { SpineObjectCatalog, SpineObjectCatalogEntry } from "../../spine/catalog/SpineObjectCatalogContracts";
import type { AuditObjectManifest } from "../../spine/manifest/AuditObjectManifestContracts";

export const PD003_PRODUCTION_DOCTRINE_ID = "PD-003";
export const PD003_PRODUCTION_DOCTRINE_VERSION = "24C.1";
export const PD003_PRODUCTION_AUTHORITY = "PD003_PRODUCTION_DOCTRINE_AUTHORITY" as const;
export const PRODUCTION_PROFILE_LIBRARY_AUTHORITY = "PRODUCTION_PROFILE_LIBRARY_AUTHORITY" as const;

export type ProductionProfileId =
  | "PLOW_STANDARD"
  | "BORE_DIRT_STANDARD"
  | "BORE_ROCK_STANDARD"
  | "OPEN_TRENCH_DIRT_STANDARD"
  | "OPEN_TRENCH_ROCK_STANDARD"
  | "FIBER_BLOW_STANDARD"
  | "FIBER_PULL_STANDARD"
  | "SPLICE_864_STANDARD"
  | "TESTING_INCLUDED_WITH_SPLICING"
  | "RESTORATION_INCLUDED_STANDARD"
  | "HYDROVAC_INCLUDED_STANDARD"
  | "PROJECT_MANAGEMENT_STANDARD"
  | "MATERIAL_CONDUIT_1_5_STANDARD"
  | "MATERIAL_FUTUREPATH_STANDARD"
  | "MATERIAL_FIBER_864_STANDARD"
  | "MATERIAL_HANDHOLE_STANDARD"
  | "MATERIAL_SPLICE_CASE_STANDARD";

export type ProductionScalar = number | "INCLUDED" | "UNKNOWN" | "CONFIGURABLE";
export type ProductionAuthorityMode = "AUDIT_AUTHORITY" | "DOCTRINE_DEFAULT" | "HUMAN_OVERRIDE";

export interface ProductionProfile {
  profileId: ProductionProfileId;
  displayName: string;
  description: string;
  applicableObjectClasses: string[];
  applicableObjectTypes: string[];
  productionUnit: string;
  productionRate: ProductionScalar;
  productionRateUnit: string;
  crewType: string;
  crewCountDefault: number;
  crewSizeDefault: number;
  equipmentRequired: string[];
  laborRate: ProductionScalar;
  laborRateUnit: string;
  materialRate: ProductionScalar;
  materialRateUnit: string;
  annualLoadedCost?: number;
  scheduleParticipation: boolean;
  costParticipation: boolean;
  paymentParticipation: boolean;
  defaultDurationFormula: string;
  defaultCostFormula: string;
  confidence: number;
  authorityMode: ProductionAuthorityMode;
  sourceWorkbook: string;
  sourceSheet: string;
  humanOverrideAllowed: boolean;
  requiresHumanReview: boolean;
  notes: string[];
  noScopeVersionCreation: true;
}

export interface ProductionProfileLibrary {
  libraryId: string;
  doctrineId: typeof PD003_PRODUCTION_DOCTRINE_ID;
  doctrineVersion: typeof PD003_PRODUCTION_DOCTRINE_VERSION;
  authority: typeof PRODUCTION_PROFILE_LIBRARY_AUTHORITY;
  profiles: ProductionProfile[];
  byProfileId: Record<string, ProductionProfile>;
  generatedAt: string;
  noScopeVersionCreation: true;
}

export interface ProductionHumanOverride {
  overrideId: string;
  profileId: ProductionProfileId;
  field: keyof Pick<ProductionProfile, "productionRate" | "laborRate" | "materialRate" | "crewCountDefault" | "crewSizeDefault">;
  overrideValue: ProductionScalar;
  overrideUnit: string;
  reason: string;
  actor: string;
  timestamp: string;
  confidence: number;
  authority: string;
  source: string;
  replacesProfileValue: ProductionScalar;
  requiresApproval: boolean;
  noSilentOverride: true;
  noScopeVersionCreation: true;
}

export interface ObjectProductionProfile {
  objectProductionProfileId: string;
  packageId: string;
  manifestEntryId: string;
  catalogEntryId: string;
  objectType: string;
  objectClass: string;
  profileId: ProductionProfileId;
  profile: ProductionProfile;
  quantity: number;
  quantityUnit: string;
  source: "AUDIT_OBJECT_MANIFEST";
  humanOverrides: ProductionHumanOverride[];
  requiresHumanReview: boolean;
  noScopeVersionCreation: true;
}

export interface ProductionScheduleProjectionItem {
  scheduleProjectionId: string;
  packageId: string;
  manifestEntryId: string;
  objectType: string;
  productionProfileId: ProductionProfileId;
  quantity: number;
  productionRate: ProductionScalar;
  durationDays: number;
  crewAdjustedDurationDays: number;
  weeklyProduction: number;
  crewType: string;
  crewCount: number;
  scheduleParticipation: boolean;
  concurrentProductionEligible: boolean;
  scheduleNote: string;
}

export interface ProductionCostProjectionItem {
  costProjectionId: string;
  packageId: string;
  manifestEntryId: string;
  objectType: string;
  productionProfileId: ProductionProfileId;
  quantity: number;
  laborCost: number;
  materialCost: number;
  projectManagementCost: number;
  totalForecastCost: number;
  costParticipation: boolean;
  costNote: string;
}

export interface ProductionPaymentProjection {
  paymentSegmentId: string;
  productionProfileId: ProductionProfileId;
  manifestEntryId: string;
  forecastWeeklyQuantity: number;
  forecastWeeklyValue: number;
  requiredCloses: string[];
  validationRequired: true;
  paymentEligible: false;
  reason: "Validation required";
  noPaymentAuthorization: true;
  noScopeVersionCreation: true;
}

export interface ProductionReviewObject {
  reviewObjectId: string;
  packageId: string;
  profileId?: ProductionProfileId;
  manifestEntryId?: string;
  reviewType: "UNKNOWN_PRODUCTION_VALUE" | "HUMAN_REVIEW_REQUIRED" | "PROFILE_MISSING" | "CONFIGURABLE_RATE";
  blocking: boolean;
  confidence: number;
  reason: string;
  engineeringActionRequired: boolean;
  noScopeVersionCreation: true;
}

export interface ProductionProjectionSummary {
  summaryId: string;
  packageId: string;
  productionProfileCount: number;
  objectProductionProfileCount: number;
  projectedCrewDays: number;
  projectedWeeklyProduction: number;
  projectedLaborCost: number;
  projectedMaterialCost: number;
  projectedProjectManagementCost: number;
  paymentProjectionCount: number;
  paymentAuthorized: false;
  unknownProductionReviewCount: number;
  status: "PASS" | "WARNING" | "FAIL";
  noScopeVersionCreation: true;
}

export interface ProductionValidation {
  validationId: string;
  packageId: string;
  status: "PASS" | "WARNING" | "FAIL";
  checkedProfileCount: number;
  checkedObjectProductionProfileCount: number;
  missingProfileReferenceCount: number;
  unknownProductionValueCount: number;
  paymentAuthorizationViolationCount: number;
  warnings: string[];
  failures: string[];
  authority: typeof PD003_PRODUCTION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface ProductionDoctrine {
  doctrineId: typeof PD003_PRODUCTION_DOCTRINE_ID;
  doctrineVersion: typeof PD003_PRODUCTION_DOCTRINE_VERSION;
  authority: typeof PD003_PRODUCTION_AUTHORITY;
  principle: "PRODUCTION_IS_DETERMINISTIC";
  profileLibraryAuthority: typeof PRODUCTION_PROFILE_LIBRARY_AUTHORITY;
  noUiHardCoding: true;
  humanOverridesRequireProvenance: true;
  paymentRequiresValidatedCloses: true;
  noScopeVersionCreation: true;
}

export interface ProductionDoctrineArtifacts {
  productionDoctrine: ProductionDoctrine;
  productionProfiles: ProductionProfile[];
  objectProductionProfiles: ObjectProductionProfile[];
  productionProjectionSummary: ProductionProjectionSummary;
  productionScheduleProjection: ProductionScheduleProjectionItem[];
  productionCostProjection: ProductionCostProjectionItem[];
  productionPaymentProjection: ProductionPaymentProjection[];
  productionReviewObjects: ProductionReviewObject[];
  productionValidation: ProductionValidation;
  productionProfileLibrary: ProductionProfileLibrary;
  noScopeVersionCreation: true;
}

export interface CreateProductionArtifactsInput {
  packageId: string;
  catalog: SpineObjectCatalog;
  auditObjectManifest: AuditObjectManifest;
  productIncludesFiber: boolean;
  generatedAt?: string;
}

export interface ProductionCatalogProfileReference {
  primaryProductionProfileId?: ProductionProfileId;
  productionProfileIds: ProductionProfileId[];
  materialProfileIds: ProductionProfileId[];
}

export type ProductionAwareCatalogEntry = SpineObjectCatalogEntry & ProductionCatalogProfileReference;
