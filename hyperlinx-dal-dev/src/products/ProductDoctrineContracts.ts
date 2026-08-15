import type { DALCoordinate } from "../types/dal";
import type { DuctDarkFiberProjectConfiguration } from "./DuctDarkFiberProjectConfiguration";

export type ProductNetworkClass = "LONG_HAUL" | "METRO" | "CAMPUS" | "LATERAL";
export type ProductTopology = "LINEAR" | "RING" | "MESH" | "HUB_AND_SPOKE";
export type ProductLayer = 1 | 2 | 3;
export type ProductValidationStatus = "PASS" | "WARNING" | "FAIL";
export type ProductDoctrineAuthorityRole =
  | "COMMERCIAL"
  | "ENGINEERING"
  | "SURVEY"
  | "PERMITTING"
  | "CONSTRUCTION"
  | "INSPECTION"
  | "FIELD"
  | "CONTROL"
  | "MARKETPLACE"
  | "RUNTIME"
  | "TWIN";
export type ProductDoctrineAppliesTo = "SERVICE" | "ASSET" | "ENGINEERING_OBJECT";
export type ProductDoctrineEngineeringObjectType =
  | "SPINE"
  | "ROUTE_SEGMENT"
  | "STATION"
  | "CONDUIT_SEGMENT"
  | "FIBER_SEGMENT"
  | "STRUCTURE"
  | "CROSSING"
  | "SPLICE_CASE"
  | "ILA_REGENERATION_SITE"
  | "TERMINATION_POINT"
  | "EVIDENCE_OBJECT";

export interface ProductDoctrineRules {
  networkClass: ProductNetworkClass;
  topology: ProductTopology;
  layer: ProductLayer;
  opticalTransport: boolean;
  comparisonAllowed: boolean;
  reuseRecommendationAllowed: boolean;
  scopeVersionCreationAllowedFromCommercial: boolean;
  engineeringCertificationRequired: boolean;
}

export interface ProductDoctrineRegistryEntry {
  alias: string;
  canonicalDoctrineId: string;
  productId: string;
  businessProductName: string;
  technicalDoctrineName: string;
  doctrineVersion: string;
  active: true;
}

export interface ProductDoctrineLifecycleDefinition {
  lifecycleStates: string[];
  prerequisiteDependencies: string[];
  releaseGates: string[];
  blockedReasons: string[];
  requiredEvidence: string[];
  acceptanceCriteria: string[];
  responsibleRole: ProductDoctrineAuthorityRole;
  billableTrigger: string;
  paymentTrigger: string;
  capitalCashFlowTrigger?: string;
  twinStateTransition: string;
}

export interface ProductDoctrineRequiredService extends ProductDoctrineLifecycleDefinition {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  serviceVsAssetRule: "SERVICE_NOT_ASSET";
  consumes: Array<"LABOR" | "EQUIPMENT" | "SUBCONTRACTOR" | "PROFESSIONAL_EFFORT">;
  stationLevelProjection: true;
}

export interface ProductDoctrineRequiredAsset extends ProductDoctrineLifecycleDefinition {
  assetId: string;
  assetName: string;
  assetType: string;
  tangibleInfrastructure: true;
  representedInTwin: true;
  requiredWhen?: string;
}

export interface ProductDoctrineEngineeringObjectDefinition extends ProductDoctrineLifecycleDefinition {
  engineeringObjectType: ProductDoctrineEngineeringObjectType;
  label: string;
  stationLevelProjection: boolean;
  requiredServiceIds: string[];
  requiredAssetIds: string[];
}

export interface ProductDoctrineExecutionSequence extends ProductDoctrineLifecycleDefinition {
  sequenceId: string;
  appliesTo: ProductDoctrineAppliesTo;
  appliesToId: string;
}

export interface ProductDoctrineCloseSequence extends ProductDoctrineLifecycleDefinition {
  closeSequenceId: string;
  appliesTo: ProductDoctrineAppliesTo;
  appliesToId: string;
  closeStates: string[];
  closeEligibility: string[];
  paymentEligibility: string[];
}

export interface ProductDoctrineEvidenceRequirement {
  evidenceRequirementId: string;
  evidenceType: string;
  label: string;
  requiredFor: string[];
  requiredAtState: string;
  acceptanceCriteria: string[];
  responsibleRole: ProductDoctrineAuthorityRole;
  blocksRelease: boolean;
  blocksClose: boolean;
}

export interface ProductDoctrineCertificationRules {
  certificationAuthority: "ENGINEERING";
  engineeringCertifies: string[];
  engineeringDoesNotCertify: string[];
  mustContain: string[];
  failureConditions: string[];
  noScopeVersionCreationBeforeSignedServiceOrder: true;
}

export interface ProductDoctrineStationLifecycleProjection {
  projectionId: string;
  derivesFor: string[];
  projectedFields: string[];
  releaseBlockedWhen: string[];
  closeBlockedWhen: string[];
  paymentEligibleWhen: string[];
  twinStateTransitions: string[];
}

export interface ProductDoctrineScopeVersionReadinessRequirement {
  requirementId: string;
  label: string;
  sourceArtifact: string;
  required: true;
}

export interface ProductDoctrine {
  doctrineId: string;
  productId: string;
  productName: string;
  productVersion: string;
  doctrineVersion: string;
  rules: ProductDoctrineRules;
  requiredInputs: string[];
  assembledArtifacts: string[];
  readinessChecks: string[];
  registry: ProductDoctrineRegistryEntry;
  requiredServices: ProductDoctrineRequiredService[];
  requiredAssets: ProductDoctrineRequiredAsset[];
  engineeringObjects: ProductDoctrineEngineeringObjectDefinition[];
  executionSequences: ProductDoctrineExecutionSequence[];
  closeSequences: ProductDoctrineCloseSequence[];
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
  certificationRules: ProductDoctrineCertificationRules;
  stationLevelLifecycleProjection: ProductDoctrineStationLifecycleProjection;
  scopeVersionReadinessRequirements: ProductDoctrineScopeVersionReadinessRequirement[];
  requirementPolicies?: Array<{
    requirementId: string;
    requirement: "REQUIRED" | "CONDITIONAL";
    quantityAuthority: "PROJECT_CONFIGURATION" | "SOURCE_EVIDENCE" | "ENGINEERING_DESIGN" | "OPTICAL_ENGINEERING_DEFINED" | "UNKNOWN";
    resolutionRequired: boolean;
  }>;
  previousDoctrineVersion?: string;
  changeReason?: string;
}

export interface ProductDoctrineSite {
  siteId: string;
  role: "A" | "Z";
  label: string;
  coordinate: DALCoordinate;
  source: string;
}

export interface ProductDoctrineOsrmRoute {
  routeId: string;
  source: "OSRM" | "CUSTOMER_KMZ" | "CUSTOMER_KML" | "GIS" | "ENGINEERED_GEOMETRY" | "COMMERCIAL_DRAWN_ROUTE" | "APPROVED_ROUTE_REVISION" | "OSRM_ASSISTED_ROUTE" | "COMMERCIAL_ROUTE_REPOSITORY" | "OTHER_GOVERNED_SOURCE";
  routeMiles: number;
  routeFeet: number;
  distanceMeters: number;
  geometry: DALCoordinate[];
  routeAuthority?: string;
  routeRevision?: string;
  routeHash?: string;
  measurementAuthority?: string;
}

/** Canonical route contract. The OSRM-named type remains as a compatibility alias for persisted callers. */
export type ProductDoctrineAuthoritativeRoute = ProductDoctrineOsrmRoute;

export interface ProductDoctrineSpine {
  spineId: string;
  topology: "LINEAR";
  networkClass: "LONG_HAUL";
  aSiteId: string;
  zSiteId: string;
  centerlineId: string;
  routeMiles: number;
  routeFeet: number;
  stationAuthorityMode?: "CONTINUOUS";
  routeSource?: string;
  routeAuthority?: string;
  routeRevision?: string;
  routeHash?: string;
  measurementAuthority?: string;
  noScopeVersionCreation: true;
}

export interface ProductDoctrineStation {
  stationId: string;
  spineId: string;
  stationIndex: number;
  stationFeet: number;
  milepost: number;
  coordinate: DALCoordinate;
  stationRole?: "DISPLAY_INDEX";
  constitutionalResolution?: false;
}

export interface ProductDoctrineRouteSegment {
  segmentId: string;
  spineId: string;
  fromStationId: string;
  toStationId: string;
  fromMile: number;
  toMile: number;
  routeMiles: number;
  routeFeet: number;
}

export interface ProductDoctrineObject {
  objectId: string;
  objectType: "SPINE" | "ROUTE_SEGMENT" | "CONDUIT" | "FIBER" | "STRUCTURE" | "CROSSING" | ProductDoctrineEngineeringObjectType;
  label: string;
  parentId?: string;
  quantity?: number;
  unit?: string;
  metadata: Record<string, unknown>;
}

export interface ProductDoctrineConduitAssembly {
  assemblyId: string;
  conduitCount: number;
  conduitSizeInches: number;
  conduitFeet: number;
  objects: ProductDoctrineObject[];
}

export interface ProductDoctrineFiberAssembly {
  assemblyId: string;
  fiberCount: number;
  fiberFeet: number;
  objects: ProductDoctrineObject[];
}

export interface ProductDoctrineStructureAssembly {
  assemblyId: string;
  structureCount: number;
  structures: ProductDoctrineObject[];
}

export interface ProductDoctrineCrossingAssembly {
  assemblyId: string;
  crossingCount: number;
  crossings: ProductDoctrineObject[];
}

export interface ProductDoctrineQuantitySummary {
  routeMiles: number;
  routeFeet: number;
  stationCount: number;
  segmentCount: number;
  objectCount: number;
  conduitFeet: number;
  conduitCount: number;
  fiberFeet: number;
  fiberCount: number;
  structureCount: number;
  crossingCount: number;
}

export interface ProductDoctrinePricingSummary {
  budgetCost: number;
  sellPriceIru: number;
  nrcRevenue: number;
  mrcRevenue: number;
  grossMarginDollars: number;
  grossMarginPercent: number;
  pricingInputs: Record<string, unknown>;
  priceStatus?: "AUTHORIZED" | "UNRESOLVED" | "COMMERCIAL_PLANNING_ASSUMPTION";
  authorityLayer?: "COMMERCIAL_POLICY" | "ESTIMATING_DOCTRINE" | "UNKNOWN";
}

export interface ProductDoctrineValidationCheck {
  key: string;
  label: string;
  status: ProductValidationStatus;
}

export interface ProductDoctrineValidationSummary {
  status: ProductValidationStatus;
  checks: ProductDoctrineValidationCheck[];
  readinessScore: number;
}

export interface ProductDoctrineEngineeringManifest {
  manifestId: string;
  packagePath: string;
  requiresEngineeringCertification: true;
  noScopeVersionCreation: true;
  objectIds: string[];
  stationIds: string[];
  quantityKeys: string[];
  serviceIds: string[];
  assetIds: string[];
  evidenceRequirementIds: string[];
  closeSequenceIds: string[];
  scopeVersionReadinessRequirementIds: string[];
}

export interface ProductDoctrineAssembly {
  assemblyId: string;
  doctrineId: string;
  productId: string;
  productDoctrineVersion: string;
  projectConfiguration?: Partial<DuctDarkFiberProjectConfiguration>;
  aSite: ProductDoctrineSite | null;
  zSite: ProductDoctrineSite | null;
  authoritativeRoute: ProductDoctrineAuthoritativeRoute | null;
  /** @deprecated Compatibility projection; Product Doctrine does not require OSRM. */
  osrmRoute: ProductDoctrineOsrmRoute | null;
  centerline: DALCoordinate[];
  centerlineId: string;
  spine: ProductDoctrineSpine | null;
  stations: ProductDoctrineStation[];
  routeSegments: ProductDoctrineRouteSegment[];
  objects: ProductDoctrineObject[];
  conduitAssembly: ProductDoctrineConduitAssembly;
  fiberAssembly: ProductDoctrineFiberAssembly;
  structureAssembly: ProductDoctrineStructureAssembly;
  crossingAssembly: ProductDoctrineCrossingAssembly;
  quantitySummary: ProductDoctrineQuantitySummary;
  pricingSummary: ProductDoctrinePricingSummary;
  validationSummary: ProductDoctrineValidationSummary;
  engineeringManifest: ProductDoctrineEngineeringManifest;
  rules: ProductDoctrineRules;
  registry: ProductDoctrineRegistryEntry;
  requiredServices: ProductDoctrineRequiredService[];
  requiredAssets: ProductDoctrineRequiredAsset[];
  engineeringObjects: ProductDoctrineEngineeringObjectDefinition[];
  executionSequences: ProductDoctrineExecutionSequence[];
  closeSequences: ProductDoctrineCloseSequence[];
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
  certificationRules: ProductDoctrineCertificationRules;
  stationLevelLifecycleProjection: ProductDoctrineStationLifecycleProjection;
  scopeVersionReadinessRequirements: ProductDoctrineScopeVersionReadinessRequirement[];
  requirementGaps?: Array<{ requirementId: string; objectClass: string; status: "ENGINEERING_REVIEW_REQUIRED" | "UNKNOWN"; authority: string; reason: string }>;
  doctrineMigration?: { previousDoctrineVersion: string; newDoctrineVersion: string; changeReason: string };
  noScopeVersionCreation: true;
}
