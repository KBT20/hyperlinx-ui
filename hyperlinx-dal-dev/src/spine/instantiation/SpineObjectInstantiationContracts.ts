import type { StationAddress } from "../../doctrine/pd002/addressing/PD002AAddressingContracts";
import type { ObjectProductionProfile } from "../../doctrine/pd003/PD003ProductionContracts";
import type { AuditObjectManifest, AuditObjectManifestEntry, AuditManifestReviewObject } from "../manifest/AuditObjectManifestContracts";
import type { SpineObjectCatalog, SpineObjectCatalogEntry } from "../catalog/SpineObjectCatalogContracts";

export const SPINE_OBJECT_INSTANTIATION_AUTHORITY = "SPINE_OBJECT_INSTANTIATION_AUTHORITY" as const;
export const SPINE_OBJECT_INSTANTIATION_VERSION = "24D.1";

export type SpineObjectCurrentState = "PLANNED";
export type SpineObjectReviewStatus = "READY_FOR_ENGINEERING_REVIEW" | "PENDING_REVIEW" | "ENGINEERING_DISPOSITION_REQUIRED";
export type SpineObjectAddressBindingStatus = "BOUND" | "INHERITED" | "PENDING_REVIEW" | "UNASSIGNED";

export interface SpineObjectIdentity {
  spineObjectId: string;
  sequence: number;
  objectType: string;
  prefix: string;
  permanent: true;
  immutableAcrossEngineeringDeltas: true;
  immutableAcrossFieldRedlines: true;
  referencedByScopeVersion: true;
  referencedByKernelExecutionGraph: true;
  referencedByClosureLedger: true;
}

export interface ConstructionSegment {
  constructionSegmentId: string;
  packageId: string;
  label: string;
  boundaryReason: "ILA" | "REGEN" | "POP" | "MAJOR_ENGINEERED_SEGMENT_BOUNDARY" | "PAYMENT_SEGMENT_BOUNDARY" | "PRODUCTION_PACKAGE";
  fromStationAddress?: StationAddress;
  toStationAddress?: StationAddress;
  spineObjectIds: string[];
  noScopeVersionCreation: true;
}

export interface PaymentSegment {
  paymentSegmentId: string;
  packageId: string;
  label: string;
  forecastOnly: true;
  paymentEligible: false;
  reason: "Validation required";
  spineObjectIds: string[];
  noScopeVersionCreation: true;
}

export interface ExecutionZone {
  executionZoneId: string;
  packageId: string;
  label: string;
  concurrentExecutionEligible: true;
  sequencingConflict: false;
  spineObjectIds: string[];
  noScopeVersionCreation: true;
}

export interface SpineObjectAddressBinding {
  bindingId: string;
  spineObjectId: string;
  addressType: string;
  stationAddress?: StationAddress;
  fromStationAddress?: StationAddress;
  toStationAddress?: StationAddress;
  inheritedFromSpineObjectId?: string;
  status: SpineObjectAddressBindingStatus;
  authority: "PD002A_OBJECT_ADDRESSING_AUTHORITY";
  noScopeVersionCreation: true;
}

export interface SpineObjectProductionBinding {
  bindingId: string;
  spineObjectId: string;
  productionProfileId?: string;
  productionProfileIds: string[];
  materialProfileIds: string[];
  objectProductionProfileIds: string[];
  constructionMethod: string;
  authority: "PD003_PRODUCTION_DOCTRINE_AUTHORITY";
  noScopeVersionCreation: true;
}

export interface InstantiatedSpineObject {
  spineObjectId: string;
  identity: SpineObjectIdentity;
  packageId: string;
  manifestEntryId?: string;
  reviewObjectId?: string;
  catalogEntryId: string;
  constitutionalRole: string;
  objectClass: string;
  objectType: string;
  displayName: string;
  description: string;
  stationAddress?: StationAddress;
  fromStationAddress?: StationAddress;
  toStationAddress?: StationAddress;
  constructionSegmentId: string;
  paymentSegmentId: string;
  executionZoneId: string;
  parentObjectId?: string;
  childObjectIds: string[];
  ancestorObjectIds: string[];
  descendantObjectIds: string[];
  productionProfileId?: string;
  productionProfileIds: string[];
  materialProfileIds: string[];
  constructionMethod: string;
  executionSequenceTemplate: unknown;
  dependencyTemplate: unknown;
  evidenceTemplate: unknown;
  visibilityProfile: unknown;
  reviewStatus: SpineObjectReviewStatus;
  addressStatus: SpineObjectAddressBindingStatus;
  currentState: SpineObjectCurrentState;
  authority: typeof SPINE_OBJECT_INSTANTIATION_AUTHORITY;
  confidence: number;
  noScopeVersionCreation: true;
}

export interface SpineObjectRegistry {
  registryId: string;
  packageId: string;
  objectCount: number;
  bySpineObjectId: Record<string, InstantiatedSpineObject>;
  byObjectType: Record<string, string[]>;
  byCatalogEntryId: Record<string, string[]>;
  byConstructionSegmentId: Record<string, string[]>;
  byPaymentSegmentId: Record<string, string[]>;
  byExecutionZoneId: Record<string, string[]>;
  authority: typeof SPINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface SpineObjectIdentityRegistry {
  registryId: string;
  packageId: string;
  identities: SpineObjectIdentity[];
  bySpineObjectId: Record<string, SpineObjectIdentity>;
  permanentIdentity: true;
  noScopeVersionCreation: true;
}

export interface InstantiationSummary {
  summaryId: string;
  packageId: string;
  expectedObjects: number;
  createdObjects: number;
  reviewObjects: number;
  productionProfileBindings: number;
  constructionSegments: number;
  paymentSegments: number;
  executionZones: number;
  status: "PASS" | "FAIL";
  noScopeVersionCreation: true;
}

export interface InstantiationHealth {
  healthId: string;
  packageId: string;
  objectsExpected: number;
  objectsCreated: number;
  objectsMissing: number;
  objectsExtra: number;
  addressErrors: number;
  hierarchyErrors: number;
  catalogErrors: number;
  productionBindingErrors: number;
  reviewObjects: number;
  instantiationStatus: "PASS" | "FAIL";
  failures: string[];
  warnings: string[];
  noScopeVersionCreation: true;
}

export interface HierarchySummary {
  summaryId: string;
  packageId: string;
  rootObjectCount: number;
  parentRelationshipCount: number;
  childRelationshipCount: number;
  containedInheritanceCount: number;
  hierarchyValid: boolean;
  noScopeVersionCreation: true;
}

export interface SpineObjectInstantiationResult {
  instantiatedSpineObjects: InstantiatedSpineObject[];
  spineObjectRegistry: SpineObjectRegistry;
  spineObjectIdentityRegistry: SpineObjectIdentityRegistry;
  constructionSegments: ConstructionSegment[];
  paymentSegments: PaymentSegment[];
  executionZones: ExecutionZone[];
  instantiationSummary: InstantiationSummary;
  instantiationHealth: InstantiationHealth;
  hierarchySummary: HierarchySummary;
  productionBindings: SpineObjectProductionBinding[];
  addressBindings: SpineObjectAddressBinding[];
  noScopeVersionCreation: true;
}

export interface SpineObjectInstantiationInput {
  packageId: string;
  catalog: SpineObjectCatalog;
  auditObjectManifest: AuditObjectManifest;
  stationAddressRegistry?: {
    entries?: StationAddress[];
    byStationId?: Record<string, StationAddress>;
    byStationLabel?: Record<string, StationAddress>;
  };
  objectProductionProfiles: ObjectProductionProfile[];
  kernelExecutionGraph?: unknown;
  generatedAt?: string;
}

export interface SpineObjectFactoryInput {
  packageId: string;
  manifestEntry?: AuditObjectManifestEntry;
  reviewObject?: AuditManifestReviewObject;
  catalogEntry: SpineObjectCatalogEntry;
  quantityIndex: number;
  identity: SpineObjectIdentity;
  stationAddress?: StationAddress;
  fromStationAddress?: StationAddress;
  toStationAddress?: StationAddress;
  parentObjectId?: string;
  constructionSegmentId: string;
  paymentSegmentId: string;
  executionZoneId: string;
  productionBinding: SpineObjectProductionBinding;
}
