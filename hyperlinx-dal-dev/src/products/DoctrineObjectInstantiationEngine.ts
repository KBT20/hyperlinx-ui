import type { DALCoordinate } from "../types/dal";
import type {
  ProductDoctrine,
  ProductDoctrineAssembly,
  ProductDoctrineCloseSequence,
  ProductDoctrineEngineeringObjectDefinition,
  ProductDoctrineEvidenceRequirement,
  ProductDoctrineExecutionSequence,
  ProductDoctrineRequiredAsset,
  ProductDoctrineRequiredService,
  ProductDoctrineScopeVersionReadinessRequirement,
  ProductDoctrineStation,
} from "./ProductDoctrineContracts";

export const DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY = "DOCTRINE_OBJECT_INSTANTIATION_ENGINE" as const;
export const DOCTRINE_OBJECT_INSTANTIATION_VERSION = "32.1";

export type DoctrineInstantiatedObjectGroup =
  | "ENGINEERING_OBJECT"
  | "REQUIRED_SERVICE"
  | "REQUIRED_ASSET"
  | "EVIDENCE_OBJECT";

export type DoctrineObjectAddressKind = "LINEAR" | "POINT" | "SERVICE" | "EVIDENCE";

export interface DoctrineObjectAddress {
  scopeVersionCandidateId: string;
  routeId: string;
  segmentId: string;
  stationStart: string;
  stationEnd: string;
  stationStartFeet: number;
  stationEndFeet: number;
  objectType: string;
  objectSequence: number;
  parentObjectId: string;
  geometryHash: string;
  jurisdiction: string;
  latitude?: number;
  longitude?: number;
  stationRange: string;
  addressLabel: string;
  addressKind: DoctrineObjectAddressKind;
  noScopeVersionCreation: true;
}

export interface DoctrineObjectPaymentSequence {
  paymentSequenceId: string;
  objectId: string;
  billableTrigger: string;
  paymentTrigger: string;
  capitalCashFlowTrigger: string;
  paymentEligible: false;
  sequenceIndex: number;
  noScopeVersionCreation: true;
}

export interface DoctrineInstantiatedObject {
  objectId: string;
  objectType: string;
  doctrineObjectType: string;
  objectGroup: DoctrineInstantiatedObjectGroup;
  productId: string;
  doctrineId: string;
  revision: string;
  parentObjectId: string;
  childObjectIds: string[];
  stationStart: string;
  stationEnd: string;
  stationAddress: string;
  stationSequence: number;
  geographicCoordinate: DALCoordinate;
  parentSpanId: string;
  parentRouteId: string;
  parentSegmentId: string;
  doctrineQuantitySource: string;
  geometry: {
    geometryType: "POINT" | "LINESTRING";
    coordinates: DALCoordinate[];
    geometryHash: string;
  };
  hierarchy: {
    hierarchyPath: string[];
    parentObjectId: string;
    childObjectIds: string[];
    level: number;
  };
  requiredServices: string[];
  requiredAssets: string[];
  constructionMethod: string;
  placementStrategy: string;
  executionSequence: ProductDoctrineExecutionSequence | null;
  executionSequenceId: string;
  closeSequence: ProductDoctrineCloseSequence | null;
  closeSequenceId: string;
  paymentSequence: DoctrineObjectPaymentSequence;
  paymentSequenceId: string;
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
  inspectionRequirements: ProductDoctrineEvidenceRequirement[];
  acceptanceCriteria: string[];
  dependencyIds: string[];
  dependencyList: string[];
  address: DoctrineObjectAddress;
  visibilityProfile: {
    engineering: "VISIBLE";
    marketplace: "PROJECTED_AFTER_SCOPEVERSION";
    control: "PROJECTED_AFTER_SCOPEVERSION";
    field: "PROJECTED_AFTER_SCOPEVERSION";
    twin: "PROJECTED_AFTER_ACCEPTED_CLOSURE";
  };
  currentState: "PLANNED";
  currentLifecycleState: "PLANNED";
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  engineeringAuthority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineObjectDependencyGraph {
  graphId: string;
  nodeCount: number;
  edgeCount: number;
  nodes: Array<{
    nodeId: string;
    objectId: string;
    objectType: string;
    objectGroup: DoctrineInstantiatedObjectGroup;
    addressLabel: string;
  }>;
  edges: Array<{
    edgeId: string;
    fromObjectId: string;
    toObjectId: string;
    dependencyType: "SEQUENCE" | "HIERARCHY" | "PREREQUISITE";
    reason: string;
  }>;
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineStationLifecycleRule {
  stationLifecycleRuleId: string;
  stationId: string;
  stationLabel: string;
  requiredServiceIds: string[];
  requiredAssetIds: string[];
  prerequisiteDependencies: string[];
  releaseStatus: "BLOCKED_UNTIL_DEPENDENCIES_RELEASED";
  blockedReason: string;
  evidenceRequired: string[];
  closeEligibility: "ELIGIBLE_AFTER_CLOSE_SEQUENCE_ACCEPTED";
  paymentEligibility: "ELIGIBLE_AFTER_ACCEPTANCE_AND_BILLABLE_TRIGGER";
  twinStateTransition: string;
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineQuantityPlacement {
  quantityPlacementId: string;
  quantitySource: "PRODUCT_DOCTRINE_ASSEMBLY";
  placementAssumptionSource: "PRODUCT_DOCTRINE_ASSEMBLY_PLACEMENT_ASSUMPTIONS";
  handholeCount: number;
  vaultCount: number;
  spliceCaseCount: number;
  ilaRegenCount: number;
  markerCount: number;
  slackLoopCount: number;
  conduitFeet: number;
  fiberFeet: number;
  stationCount: number;
  routeFeet: number;
  noNewQuantityLogic: true;
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineStationObjectIndexEntry {
  objectId: string;
  doctrineObjectId?: string;
  objectType: string;
  stationAddress: string;
  stationSequence: number;
  stationFeet: number;
  parentRouteId: string;
  parentSegmentId: string;
  placementReason: string;
  placementAuthority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  doctrineQuantitySource: string;
  originalDoctrineStation: string;
  currentEngineeringStation: string;
  movementCreatesEngineeringChangeSet: true;
  noScopeVersionCreation: true;
}

export interface DoctrineSequencedActionObject extends DoctrineStationObjectIndexEntry {
  sequenceId: string;
  previousObjectId?: string;
  nextObjectId?: string;
}

export interface DoctrineDerivedSpan {
  spanId: string;
  spanType: string;
  fromObjectId: string;
  toObjectId: string;
  stationStart: string;
  stationEnd: string;
  stationStartFeet: number;
  stationEndFeet: number;
  parentRouteId: string;
  parentSegmentId: string;
  routeFeet: number;
  spanAuthority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  closureBoundary: "VIEW_ONLY_NOT_CLOSURE_LIMIT";
  preservesContinuousStationClosure: true;
  noScopeVersionCreation: true;
}

export interface DoctrineLinearAssetSpanAttachment {
  attachmentId: string;
  spanId: string;
  assetType: "CONDUIT" | "FIBER" | "TRACE_WIRE" | "WARNING_TAPE" | "MULE_TAPE_PULL_TAPE";
  fromObjectId: string;
  toObjectId: string;
  stationStart: string;
  stationEnd: string;
  routeFeet: number;
  doctrineQuantitySource: string;
  placementAuthority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineEngineeringMovementPolicy {
  policyId: string;
  movementCreatesEngineeringChangeSet: true;
  requiredPatchType: "MOVE_OBJECT";
  requiredFields: ["originalDoctrineStation", "newEngineeringStation", "delta", "rationale"];
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineObjectInstantiationValidation {
  validationId: string;
  status: "PASS" | "FAIL";
  checkedObjectCount: number;
  missingAddressCount: number;
  missingRequiredServiceCount: number;
  missingRequiredAssetCount: number;
  missingEngineeringObjectTypeCount: number;
  missingPaymentSequenceCount: number;
  missingCloseSequenceCount: number;
  missingEvidenceRequirementCount: number;
  quantityMismatchCount: number;
  missingStationAddressCount: number;
  sequenceGapCount: number;
  duplicateObjectIdCount: number;
  spanDerivationFailureCount: number;
  unattachedLinearAssetCount: number;
  failures: string[];
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineEngineeringObjectManifest {
  manifestId: string;
  manifestVersion: typeof DOCTRINE_OBJECT_INSTANTIATION_VERSION;
  packageId: string;
  productId: string;
  doctrineId: string;
  doctrineVersion: string;
  scopeVersionCandidateId: string;
  objectCount: number;
  requiredServiceCount: number;
  requiredAssetCount: number;
  engineeringObjectTypeCount: number;
  instantiatedObjects: DoctrineInstantiatedObject[];
  dependencyGraph: DoctrineObjectDependencyGraph;
  executionSequence: ProductDoctrineExecutionSequence[];
  closeSequence: ProductDoctrineCloseSequence[];
  paymentSequence: DoctrineObjectPaymentSequence[];
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
  stationLifecycleRules: DoctrineStationLifecycleRule[];
  scopeVersionReadinessRequirements: ProductDoctrineScopeVersionReadinessRequirement[];
  quantityPlacement: DoctrineQuantityPlacement;
  stationObjectIndex: DoctrineStationObjectIndexEntry[];
  sequencedActionObjects: DoctrineSequencedActionObject[];
  derivedSpans: DoctrineDerivedSpan[];
  linearAssetSpanAttachments: DoctrineLinearAssetSpanAttachment[];
  engineeringMovementPolicy: DoctrineEngineeringMovementPolicy;
  continuousStationClosure: true;
  marketplaceProjection: {
    requiredAssetIds: string[];
    requiredServiceIds: string[];
    vendorQualifications: string[];
    deliveryDatePolicy: string;
    procurementStatus: "PENDING_SCOPEVERSION";
  };
  controlProjection: {
    executionSequenceIds: string[];
    dependencyGraphId: string;
    releaseGatePolicy: "CONTROL_RELEASES_AFTER_SCOPEVERSION";
    workReleaseStatus: "BLOCKED_UNTIL_SCOPEVERSION";
  };
  fieldProjection: {
    addressedObjectIds: string[];
    evidenceRequirementIds: string[];
    closurePolicy: "FIELD_CLOSES_AGAINST_ADDRESSED_OBJECTS";
  };
  twinProjection: {
    stateSequence: string[];
    stateAuthority: "ACCEPTED_CLOSURES_AND_EVIDENCE";
  };
  validation: DoctrineObjectInstantiationValidation;
  currentState: "PLANNED";
  authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface DoctrineObjectInstantiationResult {
  engineeringObjectManifest: DoctrineEngineeringObjectManifest;
  instantiatedObjects: DoctrineInstantiatedObject[];
  dependencyGraph: DoctrineObjectDependencyGraph;
  executionSequence: ProductDoctrineExecutionSequence[];
  closeSequence: ProductDoctrineCloseSequence[];
  paymentSequence: DoctrineObjectPaymentSequence[];
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
  stationLifecycleRules: DoctrineStationLifecycleRule[];
  quantityPlacement: DoctrineQuantityPlacement;
  stationObjectIndex: DoctrineStationObjectIndexEntry[];
  sequencedActionObjects: DoctrineSequencedActionObject[];
  derivedSpans: DoctrineDerivedSpan[];
  linearAssetSpanAttachments: DoctrineLinearAssetSpanAttachment[];
  engineeringMovementPolicy: DoctrineEngineeringMovementPolicy;
  validation: DoctrineObjectInstantiationValidation;
  summary: {
    summaryId: string;
    packageId: string;
    objectCount: number;
    addressCount: number;
    paymentSequenceCount: number;
    closeSequenceCount: number;
    stationLifecycleRuleCount: number;
    stationObjectIndexCount: number;
    derivedSpanCount: number;
    linearAssetAttachmentCount: number;
    status: "PASS" | "FAIL";
    authority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY;
    noScopeVersionCreation: true;
  };
  noScopeVersionCreation: true;
}

export interface DoctrineObjectInstantiationInput {
  packageId: string;
  productDoctrine: ProductDoctrine;
  productDoctrineAssembly: ProductDoctrineAssembly;
  routeId?: string;
  scopeVersionCandidateId?: string;
  geometryHash?: string;
  jurisdiction?: string;
}

type NormalizedStation = {
  stationId: string;
  stationLabel: string;
  measureFeet: number;
  coordinate: DALCoordinate;
};

type AddressTarget = {
  segmentId: string;
  stationStart: NormalizedStation;
  stationEnd: NormalizedStation;
  pointStation?: NormalizedStation;
  addressKind: DoctrineObjectAddressKind;
};

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || fallback;
}

function stationLabelFromFeet(feet: number) {
  const value = Math.max(0, Math.round(feet));
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return `STA ${hundreds}+${String(remainder).padStart(2, "0")}`;
}

function stationFromDoctrine(station: ProductDoctrineStation): NormalizedStation {
  return {
    stationId: station.stationId,
    stationLabel: stationLabelFromFeet(station.stationFeet),
    measureFeet: station.stationFeet,
    coordinate: station.coordinate,
  };
}

function nearestStation(stations: NormalizedStation[], measureFeet: number) {
  return stations.reduce((best, station) => (
    Math.abs(station.measureFeet - measureFeet) < Math.abs(best.measureFeet - measureFeet) ? station : best
  ), stations[0]);
}

function stationAtIndex(stations: NormalizedStation[], index: number, total: number) {
  if (stations.length <= 1) return stations[0];
  if (total <= 1) return stations[Math.floor(stations.length / 2)];
  const stationIndex = Math.min(stations.length - 1, Math.max(0, Math.round((index / Math.max(1, total - 1)) * (stations.length - 1))));
  return stations[stationIndex];
}

function firstStation(stations: NormalizedStation[]) {
  return stations[0];
}

function lastStation(stations: NormalizedStation[]) {
  return stations[stations.length - 1] ?? stations[0];
}

function normalizedStations(assembly: ProductDoctrineAssembly): NormalizedStation[] {
  const stations = assembly.stations.map(stationFromDoctrine);
  if (stations.length) return stations;
  const centerline = assembly.centerline;
  const routeFeet = assembly.quantitySummary.routeFeet;
  if (centerline.length > 1) {
    return [
      { stationId: `${assembly.assemblyId}:STA-A`, stationLabel: "STA 0+00", measureFeet: 0, coordinate: centerline[0] },
      { stationId: `${assembly.assemblyId}:STA-Z`, stationLabel: stationLabelFromFeet(routeFeet), measureFeet: routeFeet, coordinate: centerline[centerline.length - 1] },
    ];
  }
  return [
    { stationId: `${assembly.assemblyId}:STA-UNKNOWN-A`, stationLabel: "STA 0+00", measureFeet: 0, coordinate: [0, 0] },
    { stationId: `${assembly.assemblyId}:STA-UNKNOWN-Z`, stationLabel: "STA 0+01", measureFeet: 1, coordinate: [0, 0] },
  ];
}

function segmentTargets(assembly: ProductDoctrineAssembly, stations: NormalizedStation[]): AddressTarget[] {
  const stationById = new Map(stations.map((station) => [station.stationId, station]));
  const targets = assembly.routeSegments.map((segment, index) => ({
    segmentId: segment.segmentId,
    stationStart: stationById.get(segment.fromStationId) ?? nearestStation(stations, segment.fromMile * 5280),
    stationEnd: stationById.get(segment.toStationId) ?? nearestStation(stations, segment.toMile * 5280),
    addressKind: "LINEAR" as const,
    index,
  }));
  if (targets.length) return targets;
  return [{
    segmentId: `${assembly.assemblyId}:SEGMENT:FULL-ROUTE`,
    stationStart: firstStation(stations),
    stationEnd: lastStation(stations),
    addressKind: "LINEAR",
  }];
}

function paymentSequenceFor(
  packageId: string,
  objectId: string,
  sequenceIndex: number,
  lifecycle: { billableTrigger: string; paymentTrigger: string; capitalCashFlowTrigger?: string },
): DoctrineObjectPaymentSequence {
  return {
    paymentSequenceId: `${objectId}:PAYMENT-SEQUENCE`,
    objectId,
    billableTrigger: lifecycle.billableTrigger,
    paymentTrigger: lifecycle.paymentTrigger,
    capitalCashFlowTrigger: lifecycle.capitalCashFlowTrigger ?? "Capital/cash-flow trigger follows accepted close sequence.",
    paymentEligible: false,
    sequenceIndex,
    noScopeVersionCreation: true,
  };
}

function evidenceFor(
  requirements: ProductDoctrineEvidenceRequirement[],
  references: string[],
) {
  const referenceSet = new Set(references);
  return requirements.filter((requirement) => requirement.requiredFor.some((value) => referenceSet.has(value)));
}

function closeFor(sequences: ProductDoctrineCloseSequence[], appliesTo: string, appliesToId: string) {
  return sequences.find((sequence) => sequence.appliesTo === appliesTo && sequence.appliesToId === appliesToId) ?? null;
}

function executionFor(sequences: ProductDoctrineExecutionSequence[], appliesTo: string, appliesToId: string) {
  return sequences.find((sequence) => sequence.appliesTo === appliesTo && sequence.appliesToId === appliesToId) ?? null;
}

function objectAddress(args: {
  scopeVersionCandidateId: string;
  routeId: string;
  objectType: string;
  objectSequence: number;
  parentObjectId: string;
  geometryHash: string;
  jurisdiction: string;
  target: AddressTarget;
}): DoctrineObjectAddress {
  const point = args.target.pointStation;
  const stationStart = point?.stationLabel ?? args.target.stationStart.stationLabel;
  const stationEnd = point?.stationLabel ?? args.target.stationEnd.stationLabel;
  const stationStartFeet = point?.measureFeet ?? args.target.stationStart.measureFeet;
  const stationEndFeet = point?.measureFeet ?? args.target.stationEnd.measureFeet;
  const stationRange = stationStart === stationEnd ? stationStart : `${stationStart} to ${stationEnd}`;
  const coordinate = point?.coordinate;
  const addressLabel = [
    args.scopeVersionCandidateId,
    stableIdPart(args.target.segmentId),
    args.objectType,
    stationRange,
    coordinate ? `${coordinate[1]}, ${coordinate[0]}` : "",
  ].filter(Boolean).join(" / ");
  return {
    scopeVersionCandidateId: args.scopeVersionCandidateId,
    routeId: args.routeId,
    segmentId: args.target.segmentId,
    stationStart,
    stationEnd,
    stationStartFeet,
    stationEndFeet,
    objectType: args.objectType,
    objectSequence: args.objectSequence,
    parentObjectId: args.parentObjectId,
    geometryHash: args.geometryHash,
    jurisdiction: args.jurisdiction,
    latitude: coordinate?.[1],
    longitude: coordinate?.[0],
    stationRange,
    addressLabel,
    addressKind: args.target.addressKind,
    noScopeVersionCreation: true,
  };
}

function objectGeometry(address: DoctrineObjectAddress, target: AddressTarget) {
  const point = target.pointStation;
  if (point) {
    return {
      geometryType: "POINT" as const,
      coordinates: [point.coordinate],
      geometryHash: address.geometryHash,
    };
  }
  return {
    geometryType: "LINESTRING" as const,
    coordinates: [target.stationStart.coordinate, target.stationEnd.coordinate],
    geometryHash: address.geometryHash,
  };
}

function constructionMethodFor(type: string) {
  const normalized = type.toUpperCase();
  if (normalized.includes("BORE")) return "DIRECTIONAL_BORE";
  if (normalized.includes("TRENCH")) return "OPEN_TRENCH";
  if (normalized.includes("FIBER")) return "FIBER_PLACEMENT";
  if (normalized.includes("SPLICE")) return "SPLICING";
  if (normalized.includes("TEST")) return "TESTING";
  if (normalized.includes("CONDUIT") || normalized.includes("DUCT")) return "CONDUIT_PLACEMENT";
  return "ENGINEERING_PLACEMENT";
}

function makeObject(args: {
  packageId: string;
  productDoctrine: ProductDoctrine;
  objectGroup: DoctrineInstantiatedObjectGroup;
  objectType: string;
  objectSequence: number;
  parentObjectId: string;
  target: AddressTarget;
  scopeVersionCandidateId: string;
  routeId: string;
  geometryHash: string;
  jurisdiction: string;
  requiredServices: string[];
  requiredAssets: string[];
  lifecycle: ProductDoctrineRequiredService | ProductDoctrineRequiredAsset | ProductDoctrineEngineeringObjectDefinition;
  executionSequence: ProductDoctrineExecutionSequence | null;
  closeSequence: ProductDoctrineCloseSequence | null;
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
}) {
  const objectId = `${args.packageId}:DOIE:${args.objectGroup}:${stableIdPart(args.objectType)}:${String(args.objectSequence).padStart(5, "0")}`;
  const objectEvidenceRequirements = args.evidenceRequirements.length
    ? args.evidenceRequirements
    : args.lifecycle.requiredEvidence.map((evidence, index): ProductDoctrineEvidenceRequirement => ({
      evidenceRequirementId: `${objectId}:EVIDENCE:${String(index + 1).padStart(3, "0")}`,
      evidenceType: stableIdPart(evidence).toUpperCase(),
      label: evidence,
      requiredFor: [objectId, args.objectType],
      requiredAtState: "EVIDENCE_CAPTURED",
      acceptanceCriteria: args.lifecycle.acceptanceCriteria,
      responsibleRole: args.lifecycle.responsibleRole,
      blocksRelease: false,
      blocksClose: true,
    }));
  const address = objectAddress({
    scopeVersionCandidateId: args.scopeVersionCandidateId,
    routeId: args.routeId,
    objectType: args.objectType,
    objectSequence: args.objectSequence,
    parentObjectId: args.parentObjectId,
    geometryHash: args.geometryHash,
    jurisdiction: args.jurisdiction,
    target: args.target,
  });
  const paymentSequence = paymentSequenceFor(args.packageId, objectId, args.objectSequence, args.lifecycle);
  const geometry = objectGeometry(address, args.target);
  const lifecycleRecord = args.lifecycle as unknown as Record<string, unknown>;
  const doctrineQuantitySource = String(
    lifecycleRecord.serviceId ??
    lifecycleRecord.assetId ??
    lifecycleRecord.engineeringObjectType ??
    args.objectType,
  );
  const dependencyIds = args.lifecycle.prerequisiteDependencies.map((dependency) => `${objectId}:DEP:${stableIdPart(dependency)}`);
  const inspectionRequirements = objectEvidenceRequirements.filter((requirement) => (
    requirement.evidenceType.includes("INSPECTION") ||
    requirement.label.toLowerCase().includes("inspection")
  ));
  return {
    objectId,
    objectType: args.objectType,
    doctrineObjectType: args.objectType,
    objectGroup: args.objectGroup,
    productId: args.productDoctrine.productId,
    doctrineId: args.productDoctrine.doctrineId,
    revision: args.productDoctrine.doctrineVersion,
    parentObjectId: args.parentObjectId,
    childObjectIds: [],
    stationStart: address.stationStart,
    stationEnd: address.stationEnd,
    stationAddress: address.addressKind === "POINT" ? address.stationStart : address.stationRange,
    stationSequence: args.objectSequence,
    geographicCoordinate: args.target.pointStation?.coordinate ?? args.target.stationStart.coordinate,
    parentSpanId: args.target.segmentId,
    parentRouteId: args.routeId,
    parentSegmentId: args.target.segmentId,
    doctrineQuantitySource,
    geometry,
    hierarchy: {
      hierarchyPath: args.parentObjectId === "ROOT" ? [objectId] : [args.parentObjectId, objectId],
      parentObjectId: args.parentObjectId,
      childObjectIds: [],
      level: args.parentObjectId === "ROOT" ? 0 : 1,
    },
    requiredServices: args.requiredServices,
    requiredAssets: args.requiredAssets,
    constructionMethod: constructionMethodFor(args.objectType),
    placementStrategy: args.target.pointStation ? "POINT_STATION_ADDRESS" : "LINEAR_STATION_RANGE",
    executionSequence: args.executionSequence,
    executionSequenceId: args.executionSequence?.sequenceId ?? `${objectId}:EXECUTION-SEQUENCE`,
    closeSequence: args.closeSequence,
    closeSequenceId: args.closeSequence?.closeSequenceId ?? `${objectId}:CLOSE-SEQUENCE`,
    paymentSequence,
    paymentSequenceId: paymentSequence.paymentSequenceId,
    evidenceRequirements: objectEvidenceRequirements,
    inspectionRequirements,
    acceptanceCriteria: args.lifecycle.acceptanceCriteria,
    dependencyIds,
    dependencyList: dependencyIds,
    address,
    visibilityProfile: {
      engineering: "VISIBLE",
      marketplace: "PROJECTED_AFTER_SCOPEVERSION",
      control: "PROJECTED_AFTER_SCOPEVERSION",
      field: "PROJECTED_AFTER_SCOPEVERSION",
      twin: "PROJECTED_AFTER_ACCEPTED_CLOSURE",
    },
    currentState: "PLANNED",
    currentLifecycleState: "PLANNED",
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    engineeringAuthority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  } satisfies DoctrineInstantiatedObject;
}

function wholeCount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.ceil(numeric)) : 0;
}

function minimumCount(value: unknown, fallback = 1) {
  return Math.max(1, wholeCount(value || fallback));
}

function structureQuantity(assembly: ProductDoctrineAssembly, ...needles: string[]) {
  const normalizedNeedles = needles.map((needle) => needle.toUpperCase());
  return assembly.structureAssembly.structures
    .filter((item) => {
      const type = String(item.metadata.structureType ?? item.label ?? item.objectId).toUpperCase();
      return normalizedNeedles.some((needle) => type.includes(needle));
    })
    .reduce((sum, item) => sum + wholeCount(item.quantity), 0);
}

function buildQuantityPlacement(
  packageId: string,
  assembly: ProductDoctrineAssembly,
): DoctrineQuantityPlacement {
  const markerCount = Math.max(1, Math.ceil(assembly.quantitySummary.routeMiles / 5));
  const slackLoopCount = Math.max(1, Math.ceil(assembly.quantitySummary.routeMiles / 5));
  return {
    quantityPlacementId: `${packageId}:DOIE:QUANTITY-PLACEMENT`,
    quantitySource: "PRODUCT_DOCTRINE_ASSEMBLY",
    placementAssumptionSource: "PRODUCT_DOCTRINE_ASSEMBLY_PLACEMENT_ASSUMPTIONS",
    handholeCount: structureQuantity(assembly, "HANDHOLE"),
    vaultCount: structureQuantity(assembly, "VAULT"),
    spliceCaseCount: structureQuantity(assembly, "SPLICE"),
    ilaRegenCount: structureQuantity(assembly, "ILA") + structureQuantity(assembly, "REGEN"),
    markerCount,
    slackLoopCount,
    conduitFeet: wholeCount(assembly.quantitySummary.conduitFeet),
    fiberFeet: wholeCount(assembly.quantitySummary.fiberFeet),
    stationCount: wholeCount(assembly.quantitySummary.stationCount),
    routeFeet: wholeCount(assembly.quantitySummary.routeFeet),
    noNewQuantityLogic: true,
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

function assetCount(asset: ProductDoctrineRequiredAsset, assembly: ProductDoctrineAssembly, quantityPlacement: DoctrineQuantityPlacement, targetCount: number) {
  const type = asset.assetType.toUpperCase();
  if (type.includes("HANDHOLE")) return quantityPlacement.handholeCount;
  if (type.includes("VAULT")) return quantityPlacement.vaultCount;
  if (type.includes("SPLICE")) return quantityPlacement.spliceCaseCount;
  if (type.includes("ILA") || type.includes("REGEN")) return Math.max(1, quantityPlacement.ilaRegenCount);
  if (type.includes("MARKER")) return quantityPlacement.markerCount;
  if (type.includes("SLACK")) return quantityPlacement.slackLoopCount;
  if (type.includes("CONDUIT") || type.includes("FIBER") || type.includes("WIRE") || type.includes("TAPE")) return Math.max(1, targetCount);
  if (type.includes("LIU") || type.includes("TERMINATION")) return 2;
  return 1;
}

function engineeringObjectCount(
  definition: ProductDoctrineEngineeringObjectDefinition,
  quantityPlacement: DoctrineQuantityPlacement,
  stations: NormalizedStation[],
  targets: AddressTarget[],
  assembly: ProductDoctrineAssembly,
) {
  switch (definition.engineeringObjectType) {
    case "STATION":
      return stations.length;
    case "ROUTE_SEGMENT":
    case "CONDUIT_SEGMENT":
    case "FIBER_SEGMENT":
      return targets.length;
    case "STRUCTURE":
      return wholeCount(assembly.quantitySummary.structureCount);
    case "CROSSING":
      return wholeCount(assembly.quantitySummary.crossingCount);
    case "SPLICE_CASE":
      return quantityPlacement.spliceCaseCount;
    case "ILA_REGENERATION_SITE":
      return quantityPlacement.ilaRegenCount;
    case "TERMINATION_POINT":
      return 2;
    case "EVIDENCE_OBJECT":
      return 1;
    default:
      return 1;
  }
}

function targetForObject(type: string, sequence: number, total: number, stations: NormalizedStation[], targets: AddressTarget[]): AddressTarget {
  const upper = type.toUpperCase();
  const segment = targets[Math.min(targets.length - 1, Math.max(0, sequence % Math.max(1, targets.length)))] ?? targets[0];
  const pointStation = stationAtIndex(stations, sequence, total);
  if (upper.includes("STATION") || upper.includes("HANDHOLE") || upper.includes("VAULT") || upper.includes("SPLICE") || upper.includes("ILA") || upper.includes("REGEN") || upper.includes("TERMINATION") || upper.includes("MARKER") || upper.includes("EVIDENCE") || upper.includes("LIU")) {
    return {
      segmentId: segment.segmentId,
      stationStart: pointStation,
      stationEnd: pointStation,
      pointStation,
      addressKind: upper.includes("EVIDENCE") ? "EVIDENCE" : "POINT",
    };
  }
  if (upper.includes("SERVICE")) return { ...segment, addressKind: "SERVICE" };
  return segment;
}

function addChildren(objects: DoctrineInstantiatedObject[]) {
  const byId = new Map(objects.map((object) => [object.objectId, object]));
  objects.forEach((object) => {
    const parent = byId.get(object.parentObjectId);
    if (!parent) return;
    parent.childObjectIds.push(object.objectId);
    parent.hierarchy.childObjectIds.push(object.objectId);
  });
  return objects;
}

function buildDependencyGraph(packageId: string, objects: DoctrineInstantiatedObject[]): DoctrineObjectDependencyGraph {
  const nodes = objects.map((object) => ({
    nodeId: `${object.objectId}:NODE`,
    objectId: object.objectId,
    objectType: object.objectType,
    objectGroup: object.objectGroup,
    addressLabel: object.address.addressLabel,
  }));
  const sequenceEdges = objects.slice(0, -1).map((object, index) => ({
    edgeId: `${packageId}:DOIE:EDGE:SEQUENCE:${String(index + 1).padStart(5, "0")}`,
    fromObjectId: object.objectId,
    toObjectId: objects[index + 1].objectId,
    dependencyType: "SEQUENCE" as const,
    reason: "Deterministic Product Doctrine execution sequence.",
  }));
  const hierarchyEdges = objects
    .filter((object) => object.parentObjectId !== "ROOT")
    .map((object, index) => ({
      edgeId: `${packageId}:DOIE:EDGE:HIERARCHY:${String(index + 1).padStart(5, "0")}`,
      fromObjectId: object.parentObjectId,
      toObjectId: object.objectId,
      dependencyType: "HIERARCHY" as const,
      reason: "Child object inherits constitutional parent.",
    }));
  const prerequisiteEdges = objects
    .filter((object) => object.dependencyIds.length)
    .map((object, index) => ({
      edgeId: `${packageId}:DOIE:EDGE:PREREQUISITE:${String(index + 1).padStart(5, "0")}`,
      fromObjectId: object.objectId,
      toObjectId: object.objectId,
      dependencyType: "PREREQUISITE" as const,
      reason: object.dependencyIds[0],
    }));
  const edges = [...sequenceEdges, ...hierarchyEdges, ...prerequisiteEdges];
  return {
    graphId: `${packageId}:DOIE:DEPENDENCY-GRAPH`,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

function buildStationLifecycleRules(
  packageId: string,
  stations: NormalizedStation[],
  productDoctrine: ProductDoctrine,
): DoctrineStationLifecycleRule[] {
  const serviceIds = productDoctrine.requiredServices.map((service) => service.serviceId);
  const assetIds = productDoctrine.requiredAssets.map((asset) => asset.assetId);
  const evidenceIds = productDoctrine.evidenceRequirements.map((requirement) => requirement.evidenceRequirementId);
  return stations.map((station) => ({
    stationLifecycleRuleId: `${packageId}:DOIE:STATION-LIFECYCLE:${stableIdPart(station.stationId)}`,
    stationId: station.stationId,
    stationLabel: station.stationLabel,
    requiredServiceIds: serviceIds,
    requiredAssetIds: assetIds,
    prerequisiteDependencies: [
      "permit approved",
      "traffic control released",
      "materials delivered",
      "utility locate complete",
      "engineering exceptions resolved",
    ],
    releaseStatus: "BLOCKED_UNTIL_DEPENDENCIES_RELEASED",
    blockedReason: "Station release depends on permit, traffic control, material, locate, and exception gates.",
    evidenceRequired: evidenceIds,
    closeEligibility: "ELIGIBLE_AFTER_CLOSE_SEQUENCE_ACCEPTED",
    paymentEligibility: "ELIGIBLE_AFTER_ACCEPTANCE_AND_BILLABLE_TRIGGER",
    twinStateTransition: "PLANNED_RELEASED_INSTALLED_INSPECTED_VALIDATED_ACCEPTED_OPERATIONAL",
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  }));
}

function stationObjectSeeds(quantityPlacement: DoctrineQuantityPlacement) {
  return [
    {
      objectType: "HANDHOLE",
      prefix: "HH",
      count: quantityPlacement.handholeCount,
      placementReason: "Handhole count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[HANDHOLE].quantity",
    },
    {
      objectType: "VAULT",
      prefix: "VAULT",
      count: quantityPlacement.vaultCount,
      placementReason: "Vault count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[VAULT].quantity",
    },
    {
      objectType: "SPLICE_CASE",
      prefix: "SPLICE",
      count: quantityPlacement.spliceCaseCount,
      placementReason: "Splice case count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[SPLICE_CASE].quantity",
    },
    {
      objectType: "ILA_REGENERATION_SITE",
      prefix: "ILA",
      count: quantityPlacement.ilaRegenCount,
      placementReason: "ILA/regeneration count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[ILA|REGENERATION].quantity",
    },
    {
      objectType: "MARKER_POST",
      prefix: "MARKER",
      count: quantityPlacement.markerCount,
      placementReason: "Marker count from Product Doctrine route placement assumption.",
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles marker placement assumption",
    },
    {
      objectType: "SLACK_LOOP",
      prefix: "SLACK",
      count: quantityPlacement.slackLoopCount,
      placementReason: "Slack loop count from Product Doctrine route placement assumption.",
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles slack placement assumption",
    },
  ];
}

function buildStationObjectIndex(args: {
  packageId: string;
  routeId: string;
  quantityPlacement: DoctrineQuantityPlacement;
  stations: NormalizedStation[];
  targets: AddressTarget[];
}): DoctrineStationObjectIndexEntry[] {
  const entries = stationObjectSeeds(args.quantityPlacement).flatMap((seed) => (
    Array.from({ length: seed.count }, (_, index) => {
      const target = targetForObject(seed.objectType, index, seed.count, args.stations, args.targets);
      const station = target.pointStation ?? target.stationStart;
      const objectId = `${seed.prefix}-${String(index + 1).padStart(3, "0")}`;
      return {
        objectId,
        objectType: seed.objectType,
        stationAddress: station.stationLabel,
        stationSequence: 0,
        stationFeet: station.measureFeet,
        parentRouteId: args.routeId,
        parentSegmentId: target.segmentId,
        placementReason: seed.placementReason,
        placementAuthority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
        doctrineQuantitySource: seed.doctrineQuantitySource,
        originalDoctrineStation: station.stationLabel,
        currentEngineeringStation: station.stationLabel,
        movementCreatesEngineeringChangeSet: true,
        noScopeVersionCreation: true,
      } satisfies DoctrineStationObjectIndexEntry;
    })
  ));
  return entries
    .sort((a, b) => a.stationFeet - b.stationFeet || a.objectId.localeCompare(b.objectId))
    .map((entry, index) => ({ ...entry, stationSequence: index + 1 }));
}

function buildSequencedActionObjects(stationObjectIndex: DoctrineStationObjectIndexEntry[]): DoctrineSequencedActionObject[] {
  return stationObjectIndex.map((entry, index) => ({
    ...entry,
    sequenceId: `${entry.parentRouteId}:DOIE:ACTION-SEQUENCE:${String(index + 1).padStart(5, "0")}`,
    previousObjectId: stationObjectIndex[index - 1]?.objectId,
    nextObjectId: stationObjectIndex[index + 1]?.objectId,
  }));
}

function spanTypeToken(type: string) {
  const upper = type.toUpperCase();
  if (upper.includes("HANDHOLE")) return "HH";
  if (upper.includes("VAULT")) return "VAULT";
  if (upper.includes("SPLICE")) return "SPLICE";
  if (upper.includes("ILA") || upper.includes("REGEN")) return "ILA";
  if (upper.includes("MARKER")) return "MARKER";
  if (upper.includes("SLACK")) return "SLACK";
  return "STRUCTURE";
}

function buildDerivedSpans(packageId: string, sequencedActionObjects: DoctrineSequencedActionObject[]): DoctrineDerivedSpan[] {
  return sequencedActionObjects.slice(0, -1).map((from, index) => {
    const to = sequencedActionObjects[index + 1];
    const stationStartFeet = Math.min(from.stationFeet, to.stationFeet);
    const stationEndFeet = Math.max(from.stationFeet, to.stationFeet);
    return {
      spanId: `${packageId}:DOIE:SPAN:${String(index + 1).padStart(5, "0")}`,
      spanType: `${spanTypeToken(from.objectType)}_TO_${spanTypeToken(to.objectType)}`,
      fromObjectId: from.objectId,
      toObjectId: to.objectId,
      stationStart: stationStartFeet === from.stationFeet ? from.stationAddress : to.stationAddress,
      stationEnd: stationEndFeet === to.stationFeet ? to.stationAddress : from.stationAddress,
      stationStartFeet,
      stationEndFeet,
      parentRouteId: from.parentRouteId,
      parentSegmentId: from.parentSegmentId === to.parentSegmentId ? from.parentSegmentId : `${from.parentSegmentId}->${to.parentSegmentId}`,
      routeFeet: Math.max(0, stationEndFeet - stationStartFeet),
      spanAuthority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
      closureBoundary: "VIEW_ONLY_NOT_CLOSURE_LIMIT",
      preservesContinuousStationClosure: true,
      noScopeVersionCreation: true,
    };
  });
}

const LINEAR_SPAN_ASSETS = [
  ["CONDUIT", "productDoctrineAssembly.quantitySummary.conduitFeet"],
  ["FIBER", "productDoctrineAssembly.quantitySummary.fiberFeet"],
  ["TRACE_WIRE", "Product Doctrine locate wire asset attached to every station span"],
  ["WARNING_TAPE", "Product Doctrine warning tape asset attached to every station span"],
  ["MULE_TAPE_PULL_TAPE", "Product Doctrine conduit placement assumption attaches pull tape to every station span"],
] as const;

function buildLinearAssetSpanAttachments(spans: DoctrineDerivedSpan[]): DoctrineLinearAssetSpanAttachment[] {
  return spans.flatMap((span) => LINEAR_SPAN_ASSETS.map(([assetType, doctrineQuantitySource]) => ({
    attachmentId: `${span.spanId}:ASSET:${assetType}`,
    spanId: span.spanId,
    assetType,
    fromObjectId: span.fromObjectId,
    toObjectId: span.toObjectId,
    stationStart: span.stationStart,
    stationEnd: span.stationEnd,
    routeFeet: span.routeFeet,
    doctrineQuantitySource,
    placementAuthority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  })));
}

function engineeringMovementPolicy(packageId: string): DoctrineEngineeringMovementPolicy {
  return {
    policyId: `${packageId}:DOIE:ENGINEERING-MOVEMENT-POLICY`,
    movementCreatesEngineeringChangeSet: true,
    requiredPatchType: "MOVE_OBJECT",
    requiredFields: ["originalDoctrineStation", "newEngineeringStation", "delta", "rationale"],
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

function expectedStationObjectCounts(quantityPlacement: DoctrineQuantityPlacement) {
  return new Map<string, number>([
    ["HANDHOLE", quantityPlacement.handholeCount],
    ["VAULT", quantityPlacement.vaultCount],
    ["SPLICE_CASE", quantityPlacement.spliceCaseCount],
    ["ILA_REGENERATION_SITE", quantityPlacement.ilaRegenCount],
    ["MARKER_POST", quantityPlacement.markerCount],
    ["SLACK_LOOP", quantityPlacement.slackLoopCount],
  ]);
}

function duplicateCount(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return duplicates.size;
}

function validateManifest(
  packageId: string,
  productDoctrine: ProductDoctrine,
  objects: DoctrineInstantiatedObject[],
  quantityPlacement: DoctrineQuantityPlacement,
  stationObjectIndex: DoctrineStationObjectIndexEntry[],
  sequencedActionObjects: DoctrineSequencedActionObject[],
  derivedSpans: DoctrineDerivedSpan[],
  linearAssetSpanAttachments: DoctrineLinearAssetSpanAttachment[],
  expectedEngineeringObjectTypes: string[],
): DoctrineObjectInstantiationValidation {
  const objectTypes = new Set(objects.map((object) => object.objectType));
  const serviceIds = new Set(objects.filter((object) => object.objectGroup === "REQUIRED_SERVICE").map((object) => object.requiredServices[0]));
  const assetIds = new Set(objects.filter((object) => object.objectGroup === "REQUIRED_ASSET").map((object) => object.requiredAssets[0]));
  const expectedCounts = expectedStationObjectCounts(quantityPlacement);
  const actualCounts = stationObjectIndex.reduce((counts, entry) => {
    counts.set(entry.objectType, (counts.get(entry.objectType) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const quantityMismatchFailures = [...expectedCounts.entries()]
    .filter(([, expected]) => expected > 0)
    .filter(([type, expected]) => (actualCounts.get(type) ?? 0) !== expected)
    .map(([type, expected]) => `Doctrine station object count mismatch for ${type}: expected ${expected}, placed ${actualCounts.get(type) ?? 0}.`);
  const missingStationAddressFailures = stationObjectIndex
    .filter((entry) => !entry.stationAddress || !entry.stationSequence)
    .map((entry) => `Station object ${entry.objectId} is missing station address or sequence.`);
  const sequenceGapFailures = stationObjectIndex
    .filter((entry, index) => entry.stationSequence !== index + 1)
    .map((entry, index) => `Station object ${entry.objectId} has sequence ${entry.stationSequence}; expected ${index + 1}.`);
  const duplicateObjectIdFailures = duplicateCount(stationObjectIndex.map((entry) => entry.objectId))
    ? ["Station object index contains duplicate object IDs."]
    : [];
  const spanDerivationFailures = [
    ...(sequencedActionObjects.length > 1 && !derivedSpans.length ? ["Sequenced action objects exist but span derivation produced no spans."] : []),
    ...derivedSpans.filter((span) => span.stationEndFeet < span.stationStartFeet).map((span) => `Derived span ${span.spanId} has invalid station order.`),
  ];
  const attachmentsBySpan = new Map<string, Set<string>>();
  linearAssetSpanAttachments.forEach((attachment) => {
    const set = attachmentsBySpan.get(attachment.spanId) ?? new Set<string>();
    set.add(attachment.assetType);
    attachmentsBySpan.set(attachment.spanId, set);
  });
  const unattachedFailures = derivedSpans.flatMap((span) => {
    const assets = attachmentsBySpan.get(span.spanId) ?? new Set<string>();
    return LINEAR_SPAN_ASSETS
      .filter(([assetType]) => !assets.has(assetType))
      .map(([assetType]) => `Derived span ${span.spanId} is missing ${assetType} attachment.`);
  });
  const failures = [
    ...objects.filter((object) => !object.address.addressLabel || !object.address.stationRange).map((object) => `Object ${object.objectId} is missing deterministic address.`),
    ...objects.filter((object) => !object.paymentSequence.paymentSequenceId).map((object) => `Object ${object.objectId} is missing payment sequence.`),
    ...objects.filter((object) => !object.closeSequence?.closeSequenceId).map((object) => `Object ${object.objectId} is missing close sequence.`),
    ...objects.filter((object) => !object.evidenceRequirements.length && object.objectGroup !== "EVIDENCE_OBJECT").map((object) => `Object ${object.objectId} is missing evidence requirements.`),
    ...productDoctrine.requiredServices.filter((service) => !serviceIds.has(service.serviceId)).map((service) => `Required service ${service.serviceId} was not instantiated.`),
    ...productDoctrine.requiredAssets.filter((asset) => !assetIds.has(asset.assetId)).map((asset) => `Required asset ${asset.assetId} was not instantiated.`),
    ...expectedEngineeringObjectTypes.filter((type) => !objectTypes.has(type)).map((type) => `Engineering object type ${type} was not instantiated.`),
    ...quantityMismatchFailures,
    ...missingStationAddressFailures,
    ...sequenceGapFailures,
    ...duplicateObjectIdFailures,
    ...spanDerivationFailures,
    ...unattachedFailures,
  ];
  return {
    validationId: `${packageId}:DOIE:VALIDATION`,
    status: failures.length ? "FAIL" : "PASS",
    checkedObjectCount: objects.length,
    missingAddressCount: objects.filter((object) => !object.address.addressLabel || !object.address.stationRange).length,
    missingRequiredServiceCount: productDoctrine.requiredServices.filter((service) => !serviceIds.has(service.serviceId)).length,
    missingRequiredAssetCount: productDoctrine.requiredAssets.filter((asset) => !assetIds.has(asset.assetId)).length,
    missingEngineeringObjectTypeCount: expectedEngineeringObjectTypes.filter((type) => !objectTypes.has(type)).length,
    missingPaymentSequenceCount: objects.filter((object) => !object.paymentSequence.paymentSequenceId).length,
    missingCloseSequenceCount: objects.filter((object) => !object.closeSequence?.closeSequenceId).length,
    missingEvidenceRequirementCount: objects.filter((object) => !object.evidenceRequirements.length && object.objectGroup !== "EVIDENCE_OBJECT").length,
    quantityMismatchCount: quantityMismatchFailures.length,
    missingStationAddressCount: missingStationAddressFailures.length,
    sequenceGapCount: sequenceGapFailures.length,
    duplicateObjectIdCount: duplicateObjectIdFailures.length,
    spanDerivationFailureCount: spanDerivationFailures.length,
    unattachedLinearAssetCount: unattachedFailures.length,
    failures,
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function instantiateDoctrineObjects(input: DoctrineObjectInstantiationInput): DoctrineObjectInstantiationResult {
  const { packageId, productDoctrine, productDoctrineAssembly } = input;
  const routeId = input.routeId ?? productDoctrineAssembly.osrmRoute?.routeId ?? productDoctrineAssembly.centerlineId;
  const scopeVersionCandidateId = input.scopeVersionCandidateId ?? `${packageId}:SCOPEVERSION-CANDIDATE`;
  const geometryHash = input.geometryHash ?? productDoctrineAssembly.centerlineId;
  const jurisdiction = input.jurisdiction ?? "UNRESOLVED_JURISDICTION";
  const stations = normalizedStations(productDoctrineAssembly);
  const targets = segmentTargets(productDoctrineAssembly, stations);
  const quantityPlacement = buildQuantityPlacement(packageId, productDoctrineAssembly);
  const objects: DoctrineInstantiatedObject[] = [];
  let sequence = 0;

  const rootTarget = targets[0];
  const rootDefinition = productDoctrine.engineeringObjects.find((definition) => definition.engineeringObjectType === "SPINE") ?? productDoctrine.engineeringObjects[0];
  const rootEvidence = evidenceFor(productDoctrine.evidenceRequirements, ["ENGINEERING_OBJECT:SPINE", rootDefinition?.engineeringObjectType ?? "SPINE"]);
  const rootObject = makeObject({
    packageId,
    productDoctrine,
    objectGroup: "ENGINEERING_OBJECT",
    objectType: "SPINE",
    objectSequence: ++sequence,
    parentObjectId: "ROOT",
    target: rootTarget,
    scopeVersionCandidateId,
    routeId,
    geometryHash,
    jurisdiction,
    requiredServices: rootDefinition?.requiredServiceIds ?? [],
    requiredAssets: rootDefinition?.requiredAssetIds ?? [],
    lifecycle: rootDefinition,
    executionSequence: executionFor(productDoctrine.executionSequences, "ENGINEERING_OBJECT", "SPINE"),
    closeSequence: closeFor(productDoctrine.closeSequences, "ENGINEERING_OBJECT", "SPINE"),
    evidenceRequirements: rootEvidence,
  });
  objects.push(rootObject);

  productDoctrine.engineeringObjects
    .filter((definition) => definition.engineeringObjectType !== "SPINE")
    .forEach((definition) => {
      const count = engineeringObjectCount(definition, quantityPlacement, stations, targets, productDoctrineAssembly);
      Array.from({ length: count }, (_, index) => {
        const target = targetForObject(definition.engineeringObjectType, index, count, stations, targets);
        const references = [`ENGINEERING_OBJECT:${definition.engineeringObjectType}`, definition.engineeringObjectType, ...definition.requiredServiceIds, ...definition.requiredAssetIds];
        objects.push(makeObject({
          packageId,
          productDoctrine,
          objectGroup: definition.engineeringObjectType === "EVIDENCE_OBJECT" ? "EVIDENCE_OBJECT" : "ENGINEERING_OBJECT",
          objectType: definition.engineeringObjectType,
          objectSequence: ++sequence,
          parentObjectId: rootObject.objectId,
          target,
          scopeVersionCandidateId,
          routeId,
          geometryHash,
          jurisdiction,
          requiredServices: definition.requiredServiceIds,
          requiredAssets: definition.requiredAssetIds,
          lifecycle: definition,
          executionSequence: executionFor(productDoctrine.executionSequences, "ENGINEERING_OBJECT", definition.engineeringObjectType),
          closeSequence: closeFor(productDoctrine.closeSequences, "ENGINEERING_OBJECT", definition.engineeringObjectType),
          evidenceRequirements: evidenceFor(productDoctrine.evidenceRequirements, references),
        }));
      });
    });

  productDoctrine.requiredServices.forEach((service, index) => {
    const target = targetForObject(`${service.serviceType}_SERVICE`, index, productDoctrine.requiredServices.length, stations, targets);
    const references = [service.serviceId, `SERVICE:${service.serviceName.toUpperCase().replaceAll(" ", "-")}`];
    objects.push(makeObject({
      packageId,
      productDoctrine,
      objectGroup: "REQUIRED_SERVICE",
      objectType: service.serviceType,
      objectSequence: ++sequence,
      parentObjectId: rootObject.objectId,
      target: { ...target, addressKind: "SERVICE" },
      scopeVersionCandidateId,
      routeId,
      geometryHash,
      jurisdiction,
      requiredServices: [service.serviceId],
      requiredAssets: [],
      lifecycle: service,
      executionSequence: executionFor(productDoctrine.executionSequences, "SERVICE", service.serviceId),
      closeSequence: closeFor(productDoctrine.closeSequences, "SERVICE", service.serviceId),
      evidenceRequirements: evidenceFor(productDoctrine.evidenceRequirements, references),
    }));
  });

  productDoctrine.requiredAssets.forEach((asset, assetIndex) => {
    const count = assetCount(asset, productDoctrineAssembly, quantityPlacement, targets.length);
    Array.from({ length: count }, (_, index) => {
      const target = targetForObject(asset.assetType, index + assetIndex, count, stations, targets);
      const references = [asset.assetId, `ASSET:${asset.assetType}`, asset.assetType];
      objects.push(makeObject({
        packageId,
        productDoctrine,
        objectGroup: "REQUIRED_ASSET",
        objectType: asset.assetType,
        objectSequence: ++sequence,
        parentObjectId: rootObject.objectId,
        target,
        scopeVersionCandidateId,
        routeId,
        geometryHash,
        jurisdiction,
        requiredServices: [],
        requiredAssets: [asset.assetId],
        lifecycle: asset,
        executionSequence: executionFor(productDoctrine.executionSequences, "ASSET", asset.assetId),
        closeSequence: closeFor(productDoctrine.closeSequences, "ASSET", asset.assetId),
        evidenceRequirements: evidenceFor(productDoctrine.evidenceRequirements, references),
      }));
    });
  });

  const hierarchicalObjects = addChildren(objects);
  const dependencyGraph = buildDependencyGraph(packageId, hierarchicalObjects);
  const paymentSequence = hierarchicalObjects.map((object) => object.paymentSequence);
  const stationLifecycleRules = buildStationLifecycleRules(packageId, stations, productDoctrine);
  const stationObjectIndex = buildStationObjectIndex({
    packageId,
    routeId,
    quantityPlacement,
    stations,
    targets,
  });
  const sequencedActionObjects = buildSequencedActionObjects(stationObjectIndex);
  const derivedSpans = buildDerivedSpans(packageId, sequencedActionObjects);
  const linearAssetSpanAttachments = buildLinearAssetSpanAttachments(derivedSpans);
  const movementPolicy = engineeringMovementPolicy(packageId);
  const expectedEngineeringObjectTypes = productDoctrine.engineeringObjects
    .filter((definition) => (
      definition.engineeringObjectType === "SPINE" ||
      engineeringObjectCount(definition, quantityPlacement, stations, targets, productDoctrineAssembly) > 0
    ))
    .map((definition) => definition.engineeringObjectType);
  const validation = validateManifest(
    packageId,
    productDoctrine,
    hierarchicalObjects,
    quantityPlacement,
    stationObjectIndex,
    sequencedActionObjects,
    derivedSpans,
    linearAssetSpanAttachments,
    expectedEngineeringObjectTypes,
  );
  const manifest: DoctrineEngineeringObjectManifest = {
    manifestId: `${packageId}:DOCTRINE-ENGINEERING-OBJECT-MANIFEST`,
    manifestVersion: DOCTRINE_OBJECT_INSTANTIATION_VERSION,
    packageId,
    productId: productDoctrine.productId,
    doctrineId: productDoctrine.doctrineId,
    doctrineVersion: productDoctrine.doctrineVersion,
    scopeVersionCandidateId,
    objectCount: hierarchicalObjects.length,
    requiredServiceCount: productDoctrine.requiredServices.length,
    requiredAssetCount: productDoctrine.requiredAssets.length,
    engineeringObjectTypeCount: productDoctrine.engineeringObjects.length,
    instantiatedObjects: hierarchicalObjects,
    dependencyGraph,
    executionSequence: productDoctrine.executionSequences,
    closeSequence: productDoctrine.closeSequences,
    paymentSequence,
    evidenceRequirements: productDoctrine.evidenceRequirements,
    stationLifecycleRules,
    scopeVersionReadinessRequirements: productDoctrine.scopeVersionReadinessRequirements,
    quantityPlacement,
    stationObjectIndex,
    sequencedActionObjects,
    derivedSpans,
    linearAssetSpanAttachments,
    engineeringMovementPolicy: movementPolicy,
    continuousStationClosure: true,
    marketplaceProjection: {
      requiredAssetIds: productDoctrine.requiredAssets.map((asset) => asset.assetId),
      requiredServiceIds: productDoctrine.requiredServices.map((service) => service.serviceId),
      vendorQualifications: ["qualified OSP contractor", "fiber splicing vendor", "traffic control provider", "survey provider"],
      deliveryDatePolicy: "Delivery dates are projected after ScopeVersion work packaging.",
      procurementStatus: "PENDING_SCOPEVERSION",
    },
    controlProjection: {
      executionSequenceIds: productDoctrine.executionSequences.map((sequenceItem) => sequenceItem.sequenceId),
      dependencyGraphId: dependencyGraph.graphId,
      releaseGatePolicy: "CONTROL_RELEASES_AFTER_SCOPEVERSION",
      workReleaseStatus: "BLOCKED_UNTIL_SCOPEVERSION",
    },
    fieldProjection: {
      addressedObjectIds: hierarchicalObjects.map((object) => object.objectId),
      evidenceRequirementIds: productDoctrine.evidenceRequirements.map((requirement) => requirement.evidenceRequirementId),
      closurePolicy: "FIELD_CLOSES_AGAINST_ADDRESSED_OBJECTS",
    },
    twinProjection: {
      stateSequence: ["Planned", "Released", "Installed", "Inspected", "Validated", "Accepted", "Operational"],
      stateAuthority: "ACCEPTED_CLOSURES_AND_EVIDENCE",
    },
    validation,
    currentState: "PLANNED",
    authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
    noScopeVersionCreation: true,
  };
  return {
    engineeringObjectManifest: manifest,
    instantiatedObjects: hierarchicalObjects,
    dependencyGraph,
    executionSequence: productDoctrine.executionSequences,
    closeSequence: productDoctrine.closeSequences,
    paymentSequence,
    evidenceRequirements: productDoctrine.evidenceRequirements,
    stationLifecycleRules,
    quantityPlacement,
    stationObjectIndex,
    sequencedActionObjects,
    derivedSpans,
    linearAssetSpanAttachments,
    engineeringMovementPolicy: movementPolicy,
    validation,
    summary: {
      summaryId: `${packageId}:DOIE:SUMMARY`,
      packageId,
      objectCount: hierarchicalObjects.length,
      addressCount: hierarchicalObjects.filter((object) => object.address.addressLabel).length,
      paymentSequenceCount: paymentSequence.length,
      closeSequenceCount: productDoctrine.closeSequences.length,
      stationLifecycleRuleCount: stationLifecycleRules.length,
      stationObjectIndexCount: stationObjectIndex.length,
      derivedSpanCount: derivedSpans.length,
      linearAssetAttachmentCount: linearAssetSpanAttachments.length,
      status: validation.status,
      authority: DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY,
      noScopeVersionCreation: true,
    },
    noScopeVersionCreation: true,
  };
}
