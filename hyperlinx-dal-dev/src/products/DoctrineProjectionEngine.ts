import type { DALCoordinate } from "../types/dal";
import type { MeasuredSpine, StationAuthority, StationIndexedGraph } from "../spine/SpineAuthorityContracts";
import { coordinateAtMeasureOnSpine } from "../spine/MeasuredSpineEngine";
import type { ProductDoctrine } from "./ProductDoctrineContracts";
import type {
  DoctrineEngineeringObjectManifest,
  DoctrineQuantityPlacement,
} from "./DoctrineObjectInstantiationEngine";
import {
  buildClosureLedger,
  buildIofPackageTwin,
  commercialAuditReconciliation,
  createClosureSegmentsForSpan,
  initializeLifecycleState,
  validateConstitutionalStateGraph,
  type ClosureLedger,
  type CommercialAuditReconciliation,
  type IofPackageTwinProjection,
  type RuntimeStateFields,
  type WorkSegment,
} from "../state/ObjectTransitionEngine";

export const DOCTRINE_PROJECTION_AUTHORITY = "DOCTRINE_PROJECTION_ENGINE" as const;
export const DOCTRINE_PROJECTION_VERSION = "37.0";

type JsonRecord = Record<string, unknown>;
type ProjectionGateName = "Math Present" | "Objects Calculated" | "Addresses Assigned" | "Objects Projected";
type ProjectionGateStatus = "PASS" | "FAIL";
type DoctrineProjectionLinearAssetType = "CONDUIT" | "FIBER" | "TRACE_WIRE" | "WARNING_TAPE" | "MULE_TAPE_PULL_TAPE";

const LINEAR_SPAN_ASSETS: DoctrineProjectionLinearAssetType[] = [
  "CONDUIT",
  "FIBER",
  "TRACE_WIRE",
  "WARNING_TAPE",
  "MULE_TAPE_PULL_TAPE",
];

type ProjectionSeed = {
  objectType: string;
  doctrineObjectType: string;
  prefix: string;
  count: number;
  doctrineQuantitySource: string;
  placementReason: string;
};

export type DoctrineProjectionObjectAddress = {
  addressId: string;
  routeId: string;
  segmentId: string;
  objectId: string;
  objectType: string;
  addressType: "POINT";
  addressStatus: "ASSIGNED";
  objectSequence: number;
  stationId: string;
  stationValue: number;
  stationAddress: string;
  stationStart?: string;
  stationEnd?: string;
  latitude: number;
  longitude: number;
  geometryHash: string;
  addressLabel: string;
  addressAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  noScopeVersionCreation: true;
};

export type DoctrineProjectedLinearAssetSpanAttachment = {
  attachmentId: string;
  spanId: string;
  assetType: DoctrineProjectionLinearAssetType;
  fromObjectId: string;
  toObjectId: string;
  stationStart: string;
  stationEnd: string;
  routeFeet: number;
  doctrineQuantitySource: string;
  placementAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  noScopeVersionCreation: true;
};

export type DoctrineProjectedObject = RuntimeStateFields & {
  objectId: string;
  objectType: string;
  doctrineObjectType: string;
  objectSequence: number;
  measure: number;
  stationAddress: string;
  stationId: string;
  stationSequence: number;
  stationFeet: number;
  coordinate: DALCoordinate;
  geographicCoordinate: DALCoordinate;
  latitude: number;
  longitude: number;
  parentSpanId: string;
  parentRouteId: string;
  parentSegmentId: string;
  routeId: string;
  segmentId: string;
  address: DoctrineProjectionObjectAddress;
  placementAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  projectionAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  engineeringAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  coordinateAuthority: "MEASURED_CENTERLINE";
  placementReason: string;
  doctrineQuantitySource: string;
  executionSequenceId: string;
  closeSequenceId: string;
  paymentSequenceId: string;
  laborTemplate: string;
  materialTemplate: string;
  evidenceTemplate: string;
  dependencyList: string[];
  evidenceRequirements: unknown[];
  currentLifecycleState: string;
  sourceDoctrineObjectId: string;
  sourceObject: JsonRecord;
  noScopeVersionCreation: true;
};

export type DoctrineProjectedSpan = RuntimeStateFields & {
  spanId: string;
  spanType: string;
  measuredCenterlineId: string;
  startMeasure: number;
  endMeasure: number;
  startObjectId: string;
  endObjectId: string;
  startStation: string;
  endStation: string;
  startStationFeet: number;
  endStationFeet: number;
  lengthFeet: number;
  containedAssets: DoctrineProjectionLinearAssetType[];
  dependencies: string[];
  lifecycleState: "COMMERCIAL_ASSEMBLED";
  laborTemplate: string;
  materialTemplate: string;
  evidenceTemplate: string;
  executionSequenceId: string;
  closeSequenceId: string;
  paymentSequenceId: string;
  requiredEvidence: string[];
  closureSegments: WorkSegment[];
  openClosureSegments: string[];
  closedClosureSegments: string[];
  percentComplete: number;
  blockedStationRanges: string[];
  nextClosableSegment?: string;
  placementAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  renderAuthority: "MEASURED_CENTERLINE_CLIP";
  independentGeometryProhibited: true;
  fullSpineViewOnly: true;
  noScopeVersionCreation: true;
};

export type GeometryAuthorityDiagnostics = {
  diagnosticsId: string;
  status: ProjectionGateStatus;
  geometryAuthority: "PASS" | "FAIL";
  measuredCenterlineId: string;
  geometryHash: string;
  duplicateMeasuredCenterlineCount: number;
  independentGeometryCount: number;
  projectedObjectCount: number;
  projectedSpanCount: number;
  objectsOnSpine: number;
  objectsOnSpineTotal: number;
  maximumDriftFeet: number;
  independentSpanGeometryCount: number;
  commercialRenderValidation: ProjectionGateStatus;
  engineeringRenderValidation: ProjectionGateStatus;
  fieldRenderValidation: ProjectionGateStatus;
  twinRenderValidation: ProjectionGateStatus;
  failures: string[];
  authority: "MEASURED_CENTERLINE";
  noScopeVersionCreation: true;
};

export type DoctrineProjectionGateDiagnostic = {
  gate: ProjectionGateName;
  status: ProjectionGateStatus;
  reason: string;
};

export type DoctrineProjectionObjectTypeDiagnostic = {
  objectType: string;
  doctrineQuantitySource: string;
  routeFeet: number;
  stationCount: number;
  objectCount: number;
  nominalIntervalFeet: number;
  calculatedStations: string[];
  resolvedCoordinates: Array<{ objectId: string; stationAddress: string; latitude: number; longitude: number }>;
  placementAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  projectionResult: ProjectionGateStatus;
  gates: DoctrineProjectionGateDiagnostic[];
  failureReasons: string[];
};

export type DoctrineProjectionDiagnostics = {
  diagnosticsId: string;
  status: ProjectionGateStatus;
  routeFeet: number;
  stationCount: number;
  expectedObjectCount: number;
  projectedObjectCount: number;
  derivedSpanCount: number;
  linearAssetAttachmentCount: number;
  failedGates: Array<{
    objectType: string;
    gate: ProjectionGateName;
    reason: string;
  }>;
  objectTypes: DoctrineProjectionObjectTypeDiagnostic[];
  geometryAuthorityDiagnostics: GeometryAuthorityDiagnostics;
  authority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  noPricingChange: true;
  noScopeVersionCreation: true;
};

export type DoctrineStationProjection = {
  stationProjectionId: string;
  packageId: string;
  productDoctrineId: string;
  doctrineObjectManifestId: string;
  measuredCenterlineId: string;
  stationGraphId: string;
  stationAuthorityIds: string[];
  routeRepositoryId: string;
  routeGeometryId?: string;
  geometryHash: string;
  objectCount: number;
  spanCount: number;
  stationCount: number;
  stations: Array<{
    stationId: string;
    stationAddress: string;
    measuredDistanceFeet: number;
    coordinate: DALCoordinate;
    geometryReference: string;
    authority: "STATION_AUTHORITY";
  }>;
  authority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  noScopeVersionCreation: true;
};

export type DoctrineProjectedObjectManifest = {
  manifestId: string;
  projectedObjectManifestId: string;
  packageId: string;
  productDoctrineId: string;
  doctrineObjectManifestId: string;
  stationProjectionId: string;
  stationGraphId: string;
  stationAuthorityIds: string[];
  objectCount: number;
  expectedObjectCount: number;
  projectedObjects: DoctrineProjectedObject[];
  objectAddresses: DoctrineProjectionObjectAddress[];
  spanCount: number;
  projectedSpans: DoctrineProjectedSpan[];
  geometryAuthorityDiagnostics: GeometryAuthorityDiagnostics;
  commercialAuditReconciliation: CommercialAuditReconciliation;
  constitutionalStateValidation: ReturnType<typeof validateConstitutionalStateGraph>;
  executionGraphId: string;
  lifecycleGraphId: string;
  closureLedgerId: string;
  iofPackageTwinId: string;
  closureLedger: ClosureLedger;
  iofPackageTwin: IofPackageTwinProjection;
  workSegments: WorkSegment[];
  linearAssetSpanAttachments: DoctrineProjectedLinearAssetSpanAttachment[];
  linearAssetStationRanges: Array<{
    assetType: DoctrineProjectionLinearAssetType;
    stationStart: string;
    stationEnd: string;
    routeFeet: number;
    coverageAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  }>;
  materializationAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  placeholderObjectsProhibited: true;
  syntheticAuditObjectsProhibited: true;
  noScopeVersionCreation: true;
};

export type DoctrineProjectionValidation = {
  validationId: string;
  status: ProjectionGateStatus;
  projectedObjectCount: number;
  expectedObjectCount: number;
  doctrineObjectCount: number;
  stationAuthorityCount: number;
  missingStationAddressCount: number;
  missingCoordinateCount: number;
  missingStationAuthorityCount: number;
  missingParentSpanCount: number;
  missingExecutionSequenceCount: number;
  missingCloseSequenceCount: number;
  missingPaymentSequenceCount: number;
  invalidSpanCount: number;
  missingLinearAssetAttachmentCount: number;
  duplicateObjectIdCount: number;
  duplicateStationCount: number;
  placeholderObjectCount: number;
  failures: string[];
  authority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  noScopeVersionCreation: true;
};

export type DoctrineProjectionResult = {
  projectionId: string;
  packageId: string;
  doctrineProjectionVersion: typeof DOCTRINE_PROJECTION_VERSION;
  productDoctrineId: string;
  doctrineObjectManifestId: string;
  projectedObjectManifestId: string;
  measuredCenterline: JsonRecord;
  stationProjection: DoctrineStationProjection;
  stationGraph: StationIndexedGraph & {
    stationGraphId: string;
    previousNextStationReferences: Array<{
      stationId: string;
      previousStationId?: string;
      nextStationId?: string;
      objectReferences: string[];
    }>;
    engineeringSpans: DoctrineProjectedSpan[];
    projectionAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
  };
  stationAuthorities: StationAuthority[];
  stationAuthorityIds: string[];
  projectedObjectManifest: DoctrineProjectedObjectManifest;
  stationObjectManifest: DoctrineProjectedObjectManifest;
  projectedObjects: DoctrineProjectedObject[];
  projectedSpans: DoctrineProjectedSpan[];
  objectAddresses: DoctrineProjectionObjectAddress[];
  geometryAuthorityDiagnostics: GeometryAuthorityDiagnostics;
  commercialAuditReconciliation: CommercialAuditReconciliation;
  constitutionalStateValidation: ReturnType<typeof validateConstitutionalStateGraph>;
  executionGraphId: string;
  lifecycleGraphId: string;
  closureLedgerId: string;
  iofPackageTwinId: string;
  closureLedger: ClosureLedger;
  iofPackageTwin: IofPackageTwinProjection;
  workSegments: WorkSegment[];
  objectStationAttachments: Array<{
    attachmentId: string;
    objectId: string;
    objectType: string;
    stationId: string;
    stationValue: number;
    stationAddress: string;
    projectedCoordinate: DALCoordinate;
    coordinate: DALCoordinate;
    parentSpanId: string;
    routeRepositoryId: string;
    attachmentMethod: "DOCTRINE_PROJECTION_ENGINE";
    attachmentStatus: "ASSIGNED";
    projectionAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
    engineeringAuthority: typeof DOCTRINE_PROJECTION_AUTHORITY;
    noScopeVersionCreation: true;
  }>;
  doctrineProjectionDiagnostics: DoctrineProjectionDiagnostics;
  validation: DoctrineProjectionValidation;
  summary: {
    summaryId: string;
    status: ProjectionGateStatus;
    objectCount: number;
    expectedObjectCount: number;
    spanCount: number;
    stationCount: number;
    authority: typeof DOCTRINE_PROJECTION_AUTHORITY;
    noScopeVersionCreation: true;
  };
  noScopeVersionCreation: true;
};

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function wholeNumber(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(asNumber(value, fallback)));
}

function stationLabelFromMeasure(measureFeet: number) {
  const roundedFeet = Math.max(0, Math.round(measureFeet));
  return `${Math.floor(roundedFeet / 100)}+${String(roundedFeet % 100).padStart(2, "0")}`;
}

function nearestStation(stationAuthority: StationAuthority, measureFeet: number) {
  return stationAuthority.stations.reduce((best, station) => (
    Math.abs(station.measureFeet - measureFeet) < Math.abs(best.measureFeet - measureFeet) ? station : best
  ), stationAuthority.stations[0]);
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function duplicateCount(values: string[]) {
  return Math.max(0, values.filter(Boolean).length - uniqueCount(values));
}

function quantityPlacementFromManifest(manifest: DoctrineEngineeringObjectManifest): DoctrineQuantityPlacement {
  return manifest.quantityPlacement as DoctrineQuantityPlacement;
}

function manifestObjectCount(manifest: DoctrineEngineeringObjectManifest, ...needles: string[]) {
  const normalizedNeedles = needles.map((needle) => needle.toUpperCase());
  return (manifest.instantiatedObjects ?? []).filter((object) => {
    const type = String(object.objectType ?? object.doctrineObjectType ?? "").toUpperCase();
    return normalizedNeedles.some((needle) => type.includes(needle));
  }).length;
}

function projectionSeeds(quantityPlacement: DoctrineQuantityPlacement, manifest: DoctrineEngineeringObjectManifest): ProjectionSeed[] {
  const seeds: ProjectionSeed[] = [
    {
      objectType: "HANDHOLE",
      doctrineObjectType: "HANDHOLE",
      prefix: "HH",
      count: wholeNumber(quantityPlacement.handholeCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[HANDHOLE].quantity",
      placementReason: "Handhole count from Product Doctrine structure quantity.",
    },
    {
      objectType: "VAULT",
      doctrineObjectType: "VAULT",
      prefix: "VAULT",
      count: wholeNumber(quantityPlacement.vaultCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[VAULT].quantity",
      placementReason: "Vault count from Product Doctrine structure quantity.",
    },
    {
      objectType: "SPLICE_CASE",
      doctrineObjectType: "SPLICE_CASE",
      prefix: "SPLICE",
      count: wholeNumber(quantityPlacement.spliceCaseCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[SPLICE_CASE].quantity",
      placementReason: "Splice case count from Product Doctrine structure quantity.",
    },
    {
      objectType: "ILA_REGENERATION_SITE",
      doctrineObjectType: "ILA_REGENERATION_SITE",
      prefix: "ILA",
      count: wholeNumber(quantityPlacement.ilaRegenCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[ILA|REGENERATION].quantity",
      placementReason: "ILA/regeneration count from Product Doctrine structure quantity.",
    },
    {
      objectType: "MARKER_POST",
      doctrineObjectType: "MARKER_POST",
      prefix: "MARKER",
      count: wholeNumber(quantityPlacement.markerCount),
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles marker placement assumption",
      placementReason: "Marker count from Product Doctrine route placement assumption.",
    },
    {
      objectType: "SLACK_LOOP",
      doctrineObjectType: "SLACK_LOOP",
      prefix: "SLACK",
      count: wholeNumber(quantityPlacement.slackLoopCount),
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles slack placement assumption",
      placementReason: "Slack loop count from Product Doctrine route placement assumption.",
    },
  ];
  const crossingCount = manifestObjectCount(manifest, "CROSSING");
  if (crossingCount > 0) {
    seeds.push({
      objectType: "CROSSING",
      doctrineObjectType: "CROSSING",
      prefix: "CROSSING",
      count: crossingCount,
      doctrineQuantitySource: "doctrineObjectManifest.instantiatedObjects[CROSSING].length",
      placementReason: "Crossing count from existing Doctrine Object Manifest.",
    });
  }
  const terminationCount = manifestObjectCount(manifest, "TERMINATION");
  if (terminationCount > 0) {
    seeds.push({
      objectType: "TERMINATION_POINT",
      doctrineObjectType: "TERMINATION_POINT",
      prefix: "TERM",
      count: terminationCount,
      doctrineQuantitySource: "doctrineObjectManifest.instantiatedObjects[TERMINATION_POINT].length",
      placementReason: "Termination count from existing Doctrine Object Manifest.",
    });
  }
  return seeds;
}

function pointMeasureFeet(routeFeet: number, count: number, index: number) {
  if (count <= 0 || routeFeet <= 0) return 0;
  return Math.min(routeFeet, Math.max(0, (routeFeet / count) * (index + 1)));
}

function parentSpanIdFor(routeRepositoryId: string, objectType: string, sequence: number) {
  return `${routeRepositoryId}:SPAN:${stableIdPart(objectType)}:${String(sequence).padStart(3, "0")}`;
}

function projectSeedObject(args: {
  packageId: string;
  closureLedgerId: string;
  seed: ProjectionSeed;
  seedIndex: number;
  globalIndex: number;
  routeFeet: number;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  routeRepositoryId: string;
  geometryHash: string;
}) {
  const stationFeet = pointMeasureFeet(args.routeFeet, args.seed.count, args.seedIndex);
  const projected = coordinateAtMeasureOnSpine(args.measuredSpine, stationFeet);
  const station = nearestStation(args.stationAuthority, stationFeet);
  const coordinate = projected.coordinate;
  const stationAddress = stationLabelFromMeasure(stationFeet);
  const objectId = `${args.seed.prefix}-${String(args.seedIndex + 1).padStart(3, "0")}`;
  const parentSpanId = parentSpanIdFor(args.routeRepositoryId, args.seed.objectType, args.seedIndex + 1);
  const objectSequence = args.seedIndex + 1;
  const address: DoctrineProjectionObjectAddress = {
    addressId: `${objectId}:DOCTRINE-PROJECTION-ADDRESS`,
    routeId: args.routeRepositoryId,
    segmentId: projected.segmentId,
    objectId,
    objectType: args.seed.objectType,
    addressType: "POINT",
    addressStatus: "ASSIGNED",
    objectSequence,
    stationId: station.stationId,
    stationValue: Math.round(stationFeet),
    stationAddress,
    latitude: coordinate[1],
    longitude: coordinate[0],
    geometryHash: args.geometryHash,
    addressLabel: `${objectId} ${stationAddress} ${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`,
    addressAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    noScopeVersionCreation: true,
  };
  const baseObject = {
    objectId,
    objectType: args.seed.objectType,
    doctrineObjectType: args.seed.doctrineObjectType,
    objectSequence,
    measure: stationFeet,
    stationAddress,
    stationId: station.stationId,
    stationSequence: args.globalIndex + 1,
    stationFeet,
    coordinate,
    geographicCoordinate: coordinate,
    latitude: coordinate[1],
    longitude: coordinate[0],
    parentSpanId,
    parentRouteId: args.routeRepositoryId,
    parentSegmentId: projected.segmentId,
    routeId: args.routeRepositoryId,
    segmentId: projected.segmentId,
    address,
    placementAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    projectionAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    engineeringAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    coordinateAuthority: "MEASURED_CENTERLINE" as const,
    placementReason: args.seed.placementReason,
    doctrineQuantitySource: args.seed.doctrineQuantitySource,
    executionSequenceId: `${objectId}:EXECUTION-SEQUENCE`,
    closeSequenceId: `${objectId}:CLOSE-SEQUENCE`,
    paymentSequenceId: `${objectId}:PAYMENT-SEQUENCE`,
    laborTemplate: `LABOR:${args.seed.objectType}`,
    materialTemplate: `MATERIAL:${args.seed.objectType}`,
    evidenceTemplate: `EVIDENCE:${args.seed.objectType}`,
    dependencyList: [args.routeRepositoryId, parentSpanId],
    evidenceRequirements: [`EVIDENCE:${args.seed.objectType}:PLACEMENT`, `EVIDENCE:${args.seed.objectType}:CLOSE`],
    currentLifecycleState: "COMMERCIAL_ASSEMBLED",
    sourceDoctrineObjectId: objectId,
    sourceObject: {
      objectId,
      objectType: args.seed.objectType,
      doctrineQuantitySource: args.seed.doctrineQuantitySource,
      nominalIntervalFeet: args.routeFeet / Math.max(1, args.seed.count),
      placementAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    },
    noScopeVersionCreation: true as const,
  };
  return initializeLifecycleState(baseObject, {
    packageId: args.packageId,
    entityId: objectId,
    entityKind: "object",
    closureLedgerId: args.closureLedgerId,
    blockingDependencies: [args.routeRepositoryId, parentSpanId],
  }) satisfies DoctrineProjectedObject;
}

function projectObjectsFromQuantitySchedule(args: {
  packageId: string;
  closureLedgerId: string;
  quantityPlacement: DoctrineQuantityPlacement;
  doctrineObjectManifest: DoctrineEngineeringObjectManifest;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  routeRepositoryId: string;
}) {
  const routeFeet = asNumber(args.measuredSpine.routeLengthFeet, asNumber(args.quantityPlacement.routeFeet));
  const geometryHash = args.measuredSpine.geometryHash;
  const seeds = projectionSeeds(args.quantityPlacement, args.doctrineObjectManifest);
  const byType = seeds.map((seed) => ({
    seed,
    nominalIntervalFeet: seed.count > 0 ? routeFeet / seed.count : 0,
    objects: Array.from({ length: seed.count }, (_, index) => projectSeedObject({
      packageId: args.packageId,
      closureLedgerId: args.closureLedgerId,
      seed,
      seedIndex: index,
      globalIndex: 0,
      routeFeet,
      measuredSpine: args.measuredSpine,
      stationAuthority: args.stationAuthority,
      routeRepositoryId: args.routeRepositoryId,
      geometryHash,
    })),
  }));
  const projectedObjects = byType
    .flatMap((entry) => entry.objects)
    .sort((a, b) => a.stationFeet - b.stationFeet || a.objectId.localeCompare(b.objectId))
    .map((object, index) => ({
      ...object,
      stationSequence: index + 1,
    }));
  return { seeds, byType, projectedObjects, routeFeet };
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

function derivedSpansFromProjectedObjects(packageId: string, measuredCenterlineId: string, closureLedgerId: string, projectedObjects: DoctrineProjectedObject[]) {
  return projectedObjects.slice(0, -1).map((from, index) => {
    const to = projectedObjects[index + 1];
    const start = from.stationFeet <= to.stationFeet ? from : to;
    const end = from.stationFeet <= to.stationFeet ? to : from;
    const spanId = `${packageId}:DOCTRINE-PROJECTION:SPAN:${String(index + 1).padStart(5, "0")}`;
    const baseSpan = {
      spanId: `${packageId}:DOCTRINE-PROJECTION:SPAN:${String(index + 1).padStart(5, "0")}`,
      spanType: `${spanTypeToken(from.objectType)}_TO_${spanTypeToken(to.objectType)}`,
      measuredCenterlineId,
      startMeasure: start.measure,
      endMeasure: end.measure,
      startObjectId: start.objectId,
      endObjectId: end.objectId,
      startStation: start.stationAddress,
      endStation: end.stationAddress,
      startStationFeet: start.stationFeet,
      endStationFeet: end.stationFeet,
      lengthFeet: Math.max(0, end.stationFeet - start.stationFeet),
      containedAssets: [...LINEAR_SPAN_ASSETS],
      dependencies: [start.objectId, end.objectId],
      lifecycleState: "COMMERCIAL_ASSEMBLED" as const,
      laborTemplate: "LABOR:ASSET_SPAN",
      materialTemplate: "MATERIAL:LINEAR_ASSETS",
      evidenceTemplate: "EVIDENCE:SPAN_CLOSE",
      executionSequenceId: `${spanId}:EXECUTION-SEQUENCE`,
      closeSequenceId: `${spanId}:CLOSE-SEQUENCE`,
      paymentSequenceId: `${spanId}:PAYMENT-SEQUENCE`,
      requiredEvidence: ["span placement evidence", "linear asset closure evidence"],
      closureSegments: [] as WorkSegment[],
      openClosureSegments: [] as string[],
      closedClosureSegments: [] as string[],
      percentComplete: 0,
      blockedStationRanges: [],
      nextClosableSegment: undefined,
      placementAuthority: DOCTRINE_PROJECTION_AUTHORITY,
      renderAuthority: "MEASURED_CENTERLINE_CLIP" as const,
      independentGeometryProhibited: true as const,
      fullSpineViewOnly: true as const,
      noScopeVersionCreation: true as const,
    };
    const closureSegments = createClosureSegmentsForSpan(baseSpan, { packageId, closureLedgerId });
    return initializeLifecycleState({
      ...baseSpan,
      closureSegments,
      openClosureSegments: closureSegments.map((segment) => segment.closureSegmentId),
      closedClosureSegments: [],
      nextClosableSegment: closureSegments[0]?.closureSegmentId,
    }, {
      packageId,
      entityId: spanId,
      entityKind: "span",
      closureLedgerId,
      blockingDependencies: [start.objectId, end.objectId],
    }) satisfies DoctrineProjectedSpan;
  });
}

function linearAssetAttachmentsForSpans(spans: DoctrineProjectedSpan[]): DoctrineProjectedLinearAssetSpanAttachment[] {
  return spans.flatMap((span) => LINEAR_SPAN_ASSETS.map((assetType) => ({
    attachmentId: `${span.spanId}:ASSET:${assetType}`,
    spanId: span.spanId,
    assetType,
    fromObjectId: span.startObjectId,
    toObjectId: span.endObjectId,
    stationStart: span.startStation,
    stationEnd: span.endStation,
    routeFeet: span.lengthFeet,
    doctrineQuantitySource: assetType === "CONDUIT"
      ? "productDoctrineAssembly.quantitySummary.conduitFeet"
      : assetType === "FIBER"
        ? "productDoctrineAssembly.quantitySummary.fiberFeet"
        : `Product Doctrine ${assetType} full-spine placement assumption`,
    placementAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    noScopeVersionCreation: true,
  })));
}

function linearAssetStationRanges(routeFeet: number) {
  return LINEAR_SPAN_ASSETS.map((assetType) => ({
    assetType,
    stationStart: stationLabelFromMeasure(0),
    stationEnd: stationLabelFromMeasure(routeFeet),
    routeFeet,
    coverageAuthority: DOCTRINE_PROJECTION_AUTHORITY,
  }));
}

function diagnosticsForObjectTypes(args: {
  byType: Array<{ seed: ProjectionSeed; nominalIntervalFeet: number; objects: DoctrineProjectedObject[] }>;
  routeFeet: number;
  stationCount: number;
  projectedObjects: DoctrineProjectedObject[];
  stationAuthorityIds: string[];
  stationProjectionId: string;
  stationGraphId: string;
  projectedObjectManifestId: string;
}) {
  const duplicateObjectIds = duplicateCount(args.projectedObjects.map((object) => object.objectId));
  return args.byType.map(({ seed, nominalIntervalFeet, objects }) => {
    const duplicateStations = duplicateCount(objects.map((object) => object.stationAddress));
    const gates: DoctrineProjectionGateDiagnostic[] = [
      {
        gate: "Math Present",
        status: args.routeFeet > 0 && seed.count >= 0 && Number.isFinite(nominalIntervalFeet) ? "PASS" : "FAIL",
        reason: args.routeFeet <= 0
          ? "missing route feet"
          : !Number.isFinite(nominalIntervalFeet)
            ? "missing doctrine quantity"
            : "route feet and doctrine quantity present",
      },
      {
        gate: "Objects Calculated",
        status: objects.length === seed.count ? "PASS" : "FAIL",
        reason: objects.length === seed.count ? `Objects Calculated: ${objects.length}` : `math count does not match doctrine quantity: ${objects.length}/${seed.count}`,
      },
      {
        gate: "Addresses Assigned",
        status: objects.every((object) => object.stationAddress) && duplicateStations === 0 ? "PASS" : "FAIL",
        reason: !objects.every((object) => object.stationAddress)
          ? "object lacks address"
          : duplicateStations > 0
            ? "duplicate station"
            : "station addresses assigned",
      },
      {
        gate: "Objects Projected",
        status: objects.every((object) => object.coordinate && object.stationId) &&
          args.stationAuthorityIds.length > 0 &&
          args.stationProjectionId &&
          args.stationGraphId &&
          args.projectedObjectManifestId &&
          duplicateObjectIds === 0
          ? "PASS"
          : "FAIL",
        reason: !args.stationProjectionId || !args.stationGraphId || !args.projectedObjectManifestId
          ? "projection ID missing"
          : duplicateObjectIds > 0
            ? "duplicate object ID"
            : objects.some((object) => !object.stationId)
              ? "station not resolved"
              : objects.some((object) => !object.coordinate)
                ? "coordinate not resolved"
                : "objects projected",
      },
    ];
    const failureReasons = gates.filter((gate) => gate.status === "FAIL").map((gate) => `${gate.gate}: ${gate.reason}`);
    return {
      objectType: seed.objectType,
      doctrineQuantitySource: seed.doctrineQuantitySource,
      routeFeet: Math.round(args.routeFeet),
      stationCount: args.stationCount,
      objectCount: seed.count,
      nominalIntervalFeet: Math.round(nominalIntervalFeet),
      calculatedStations: objects.map((object) => object.stationAddress),
      resolvedCoordinates: objects.map((object) => ({
        objectId: object.objectId,
        stationAddress: object.stationAddress,
        latitude: object.latitude,
        longitude: object.longitude,
      })),
      placementAuthority: DOCTRINE_PROJECTION_AUTHORITY,
      projectionResult: failureReasons.length ? "FAIL" : "PASS",
      gates,
      failureReasons,
    } satisfies DoctrineProjectionObjectTypeDiagnostic;
  });
}

function validateProjection(args: {
  packageId: string;
  expectedObjectCount: number;
  manifest: DoctrineEngineeringObjectManifest;
  projectedObjects: DoctrineProjectedObject[];
  projectedSpans: DoctrineProjectedSpan[];
  linearAssetSpanAttachments: DoctrineProjectedLinearAssetSpanAttachment[];
  stationAuthorityIds: string[];
  diagnostics: DoctrineProjectionDiagnostics;
}) {
  const placeholderObjectCount = args.projectedObjects.filter((object) => (
    object.objectId.includes("ROUTE-CENTERLINE") ||
    object.objectType === "PROJECTED_IOF_OBJECT" ||
    object.objectType === "AUDIT_OBJECT"
  )).length;
  const duplicateObjectIdCount = duplicateCount(args.projectedObjects.map((object) => object.objectId));
  const duplicateStationCount = args.diagnostics.objectTypes.reduce((sum, item) => (
    sum + (item.gates.some((gate) => gate.reason === "duplicate station") ? 1 : 0)
  ), 0);
  const missingLinearAssetAttachmentCount = args.projectedSpans.reduce((sum, span) => {
    const attached = new Set(args.linearAssetSpanAttachments.filter((attachment) => attachment.spanId === span.spanId).map((attachment) => attachment.assetType));
    return sum + LINEAR_SPAN_ASSETS.filter((assetType) => !attached.has(assetType)).length;
  }, 0);
  const failures = [
    ...(args.expectedObjectCount <= 0 ? ["zero object count"] : []),
    ...(args.projectedObjects.length !== args.expectedObjectCount ? [`math count does not match doctrine quantity: ${args.projectedObjects.length}/${args.expectedObjectCount}`] : []),
    ...args.projectedObjects.filter((object) => !object.stationAddress).map((object) => `object lacks address: ${object.objectId}`),
    ...args.projectedObjects.filter((object) => !object.coordinate).map((object) => `coordinate not resolved: ${object.objectId}`),
    ...args.projectedObjects.filter((object) => !object.stationId).map((object) => `station not resolved: ${object.objectId}`),
    ...args.projectedObjects.filter((object) => !object.parentSpanId).map((object) => `Projected object ${object.objectId} is missing parent span.`),
    ...args.projectedObjects.filter((object) => !object.executionSequenceId).map((object) => `Projected object ${object.objectId} is missing execution sequence.`),
    ...args.projectedObjects.filter((object) => !object.closeSequenceId).map((object) => `Projected object ${object.objectId} is missing close sequence.`),
    ...args.projectedObjects.filter((object) => !object.paymentSequenceId).map((object) => `Projected object ${object.objectId} is missing payment sequence.`),
    ...args.projectedSpans.filter((span) => !span.startStation || !span.endStation || span.lengthFeet < 0 || !Number.isFinite(span.startMeasure) || !Number.isFinite(span.endMeasure) || !span.measuredCenterlineId).map((span) => `span cannot be derived: ${span.spanId}`),
    ...(missingLinearAssetAttachmentCount ? [`required linear assets are not attached: ${missingLinearAssetAttachmentCount}`] : []),
    ...args.diagnostics.geometryAuthorityDiagnostics.failures,
    ...(args.stationAuthorityIds.length ? [] : ["station not resolved: Station Authority IDs are missing."]),
    ...(duplicateObjectIdCount ? [`duplicate object ID: ${duplicateObjectIdCount}`] : []),
    ...(duplicateStationCount ? [`duplicate station: ${duplicateStationCount}`] : []),
    ...(placeholderObjectCount ? [`Projected manifest contains ${placeholderObjectCount} placeholder or synthetic audit object(s).`] : []),
    ...args.diagnostics.failedGates.map((gate) => `${gate.objectType} ${gate.gate}: ${gate.reason}`),
  ];
  return {
    validationId: `${args.packageId}:DOCTRINE-PROJECTION:VALIDATION`,
    status: failures.length ? "FAIL" : "PASS",
    projectedObjectCount: args.projectedObjects.length,
    expectedObjectCount: args.expectedObjectCount,
    doctrineObjectCount: args.manifest.instantiatedObjects.length,
    stationAuthorityCount: args.stationAuthorityIds.length,
    missingStationAddressCount: args.projectedObjects.filter((object) => !object.stationAddress).length,
    missingCoordinateCount: args.projectedObjects.filter((object) => !object.coordinate).length,
    missingStationAuthorityCount: args.projectedObjects.filter((object) => !object.stationId).length,
    missingParentSpanCount: args.projectedObjects.filter((object) => !object.parentSpanId).length,
    missingExecutionSequenceCount: args.projectedObjects.filter((object) => !object.executionSequenceId).length,
    missingCloseSequenceCount: args.projectedObjects.filter((object) => !object.closeSequenceId).length,
    missingPaymentSequenceCount: args.projectedObjects.filter((object) => !object.paymentSequenceId).length,
    invalidSpanCount: args.projectedSpans.filter((span) => !span.startStation || !span.endStation || span.lengthFeet < 0 || !Number.isFinite(span.startMeasure) || !Number.isFinite(span.endMeasure) || !span.measuredCenterlineId).length,
    missingLinearAssetAttachmentCount,
    duplicateObjectIdCount,
    duplicateStationCount,
    placeholderObjectCount,
    failures,
    authority: DOCTRINE_PROJECTION_AUTHORITY,
    noScopeVersionCreation: true,
  } satisfies DoctrineProjectionValidation;
}

function geometryAuthorityDiagnostics(args: {
  packageId: string;
  measuredCenterlineId: string;
  geometryHash: string;
  projectedObjects: DoctrineProjectedObject[];
  projectedSpans: DoctrineProjectedSpan[];
}) {
  const duplicateMeasuredCenterlineCount = duplicateCount(args.projectedSpans.map((span) => span.measuredCenterlineId)) > 0
    ? uniqueCount(args.projectedSpans.map((span) => span.measuredCenterlineId)) - 1
    : 0;
  const independentSpanGeometryCount = args.projectedSpans.filter((span) => Array.isArray((span as unknown as { coordinates?: unknown }).coordinates)).length;
  const independentGeometryCount = independentSpanGeometryCount;
  const objectsOnSpine = args.projectedObjects.filter((object) => object.coordinateAuthority === "MEASURED_CENTERLINE" && Number.isFinite(object.measure)).length;
  const failures = [
    ...(!args.measuredCenterlineId ? ["Measured Centerline ID missing."] : []),
    ...(duplicateMeasuredCenterlineCount ? [`Duplicate measured centerline detected: ${duplicateMeasuredCenterlineCount}`] : []),
    ...(independentSpanGeometryCount ? [`Span contains independent geometry: ${independentSpanGeometryCount}`] : []),
    ...(objectsOnSpine !== args.projectedObjects.length ? [`Object not on measured spine: ${objectsOnSpine}/${args.projectedObjects.length}`] : []),
  ];
  const status: ProjectionGateStatus = failures.length ? "FAIL" : "PASS";
  return {
    diagnosticsId: `${args.packageId}:GEOMETRY-AUTHORITY:DIAGNOSTICS`,
    status,
    geometryAuthority: status,
    measuredCenterlineId: args.measuredCenterlineId,
    geometryHash: args.geometryHash,
    duplicateMeasuredCenterlineCount,
    independentGeometryCount,
    projectedObjectCount: args.projectedObjects.length,
    projectedSpanCount: args.projectedSpans.length,
    objectsOnSpine,
    objectsOnSpineTotal: args.projectedObjects.length,
    maximumDriftFeet: 0,
    independentSpanGeometryCount,
    commercialRenderValidation: status,
    engineeringRenderValidation: status,
    fieldRenderValidation: status,
    twinRenderValidation: status,
    failures,
    authority: "MEASURED_CENTERLINE",
    noScopeVersionCreation: true,
  } satisfies GeometryAuthorityDiagnostics;
}

export function projectDoctrineToStationSpine(input: {
  packageId: string;
  productDoctrine: ProductDoctrine;
  doctrineObjectManifest: DoctrineEngineeringObjectManifest;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  stationIndexedGraph: StationIndexedGraph;
  routeRepositoryId: string;
  routeGeometryId?: string;
  commercialReleasePackageId?: string;
}) {
  const quantityPlacement = quantityPlacementFromManifest(input.doctrineObjectManifest);
  const stationProjectionId = `${input.packageId}:DOCTRINE-STATION-PROJECTION:${stableIdPart(input.measuredSpine.geometryHash)}`;
  const measuredCenterlineId = `${input.packageId}:MEASURED-CENTERLINE:${stableIdPart(input.measuredSpine.geometryHash)}`;
  const stationGraphId = `${input.packageId}:DOCTRINE-STATION-GRAPH:${stableIdPart(input.measuredSpine.geometryHash)}`;
  const projectedObjectManifestId = `${input.packageId}:DOCTRINE-PROJECTED-OBJECT-MANIFEST`;
  const closureLedgerId = `${input.packageId}:CLOSURE-LEDGER`;
  const executionGraphId = `${input.packageId}:EXECUTION-GRAPH`;
  const lifecycleGraphId = `${input.packageId}:LIFECYCLE-GRAPH`;
  const stationAuthorityIds = [input.stationAuthority.authorityId].filter(Boolean);
  const { byType, projectedObjects, routeFeet } = projectObjectsFromQuantitySchedule({
    packageId: input.packageId,
    closureLedgerId,
    quantityPlacement,
    doctrineObjectManifest: input.doctrineObjectManifest,
    measuredSpine: input.measuredSpine,
    stationAuthority: input.stationAuthority,
    routeRepositoryId: input.routeRepositoryId,
  });
  const expectedObjectCount = projectionSeeds(quantityPlacement, input.doctrineObjectManifest).reduce((sum, seed) => sum + seed.count, 0);
  const projectedSpans = derivedSpansFromProjectedObjects(input.packageId, measuredCenterlineId, closureLedgerId, projectedObjects);
  const workSegments = projectedSpans.flatMap((span) => span.closureSegments);
  const linearAssetSpanAttachments = linearAssetAttachmentsForSpans(projectedSpans);
  const objectAddresses = projectedObjects.map((object) => object.address);
  const commercialAudit = commercialAuditReconciliation({
    packageId: input.packageId,
    expectedObjectCount,
    renderedObjects: projectedObjects,
    renderedSpans: projectedSpans,
    stationCount: input.stationAuthority.stations.length,
  });
  const closureLedger = buildClosureLedger({
    packageId: input.packageId,
    objects: projectedObjects,
    spans: projectedSpans,
    workSegments,
  });
  const iofPackageTwin = buildIofPackageTwin({
    packageId: input.packageId,
    objects: projectedObjects,
    spans: projectedSpans,
    workSegments,
    closureLedgerId: closureLedger.closureLedgerId,
  });
  const objectTypeDiagnostics = diagnosticsForObjectTypes({
    byType,
    routeFeet,
    stationCount: input.stationAuthority.stations.length,
    projectedObjects,
    stationAuthorityIds,
    stationProjectionId,
    stationGraphId,
    projectedObjectManifestId,
  });
  const failedGates = objectTypeDiagnostics.flatMap((item) => (
    item.gates
      .filter((gate) => gate.status === "FAIL")
      .map((gate) => ({ objectType: item.objectType, gate: gate.gate, reason: gate.reason }))
  ));
  const geometryDiagnostics = geometryAuthorityDiagnostics({
    packageId: input.packageId,
    measuredCenterlineId,
    geometryHash: input.measuredSpine.geometryHash,
    projectedObjects,
    projectedSpans,
  });
  const doctrineProjectionDiagnostics: DoctrineProjectionDiagnostics = {
    diagnosticsId: `${input.packageId}:DOCTRINE-PROJECTION:DIAGNOSTICS`,
    status: failedGates.length ? "FAIL" : "PASS",
    routeFeet: Math.round(routeFeet),
    stationCount: input.stationAuthority.stations.length,
    expectedObjectCount,
    projectedObjectCount: projectedObjects.length,
    derivedSpanCount: projectedSpans.length,
    linearAssetAttachmentCount: linearAssetSpanAttachments.length,
    failedGates,
    objectTypes: objectTypeDiagnostics,
    geometryAuthorityDiagnostics: geometryDiagnostics,
    authority: DOCTRINE_PROJECTION_AUTHORITY,
    noPricingChange: true,
    noScopeVersionCreation: true,
  };
  const validation = validateProjection({
    packageId: input.packageId,
    expectedObjectCount,
    manifest: input.doctrineObjectManifest,
    projectedObjects,
    projectedSpans,
    linearAssetSpanAttachments,
    stationAuthorityIds,
    diagnostics: doctrineProjectionDiagnostics,
  });
  const constitutionalStateValidation = validateConstitutionalStateGraph({
    objects: projectedObjects,
    spans: projectedSpans,
    workSegments,
    commercialAudit,
    geometryAuthorityStatus: geometryDiagnostics.status,
  });
  const stationProjection: DoctrineStationProjection = {
    stationProjectionId,
    packageId: input.packageId,
    productDoctrineId: input.productDoctrine.doctrineId,
    doctrineObjectManifestId: input.doctrineObjectManifest.manifestId,
    measuredCenterlineId,
    stationGraphId,
    stationAuthorityIds,
    routeRepositoryId: input.routeRepositoryId,
    routeGeometryId: input.routeGeometryId,
    geometryHash: input.measuredSpine.geometryHash,
    objectCount: projectedObjects.length,
    spanCount: projectedSpans.length,
    stationCount: input.stationAuthority.stations.length,
    stations: input.stationAuthority.stations.map((station) => ({
      stationId: station.stationId,
      stationAddress: station.stationLabel,
      measuredDistanceFeet: station.measureFeet,
      coordinate: station.coordinate,
      geometryReference: input.routeGeometryId ?? input.measuredSpine.sourceGeometryRef,
      authority: "STATION_AUTHORITY",
    })),
    authority: DOCTRINE_PROJECTION_AUTHORITY,
    noScopeVersionCreation: true,
  };
  const objectsByStation = projectedObjects.reduce((map, object) => {
    const list = map.get(object.stationId) ?? [];
    list.push(object.objectId);
    map.set(object.stationId, list);
    return map;
  }, new Map<string, string[]>());
  const enhancedGraph = {
    ...input.stationIndexedGraph,
    graphId: stationGraphId,
    stationGraphId,
    previousNextStationReferences: input.stationAuthority.stations.map((station, index) => ({
      stationId: station.stationId,
      previousStationId: input.stationAuthority.stations[index - 1]?.stationId,
      nextStationId: input.stationAuthority.stations[index + 1]?.stationId,
      objectReferences: objectsByStation.get(station.stationId) ?? [],
    })),
    engineeringSpans: projectedSpans,
    projectionAuthority: DOCTRINE_PROJECTION_AUTHORITY,
  };
  const projectedObjectManifest: DoctrineProjectedObjectManifest = {
    manifestId: projectedObjectManifestId,
    projectedObjectManifestId,
    packageId: input.packageId,
    productDoctrineId: input.productDoctrine.doctrineId,
    doctrineObjectManifestId: input.doctrineObjectManifest.manifestId,
    stationProjectionId,
    stationGraphId,
    stationAuthorityIds,
    objectCount: projectedObjects.length,
    expectedObjectCount,
    projectedObjects,
    objectAddresses,
    spanCount: projectedSpans.length,
    projectedSpans,
    geometryAuthorityDiagnostics: geometryDiagnostics,
    commercialAuditReconciliation: commercialAudit,
    constitutionalStateValidation,
    executionGraphId,
    lifecycleGraphId,
    closureLedgerId: closureLedger.closureLedgerId,
    iofPackageTwinId: iofPackageTwin.twinProjectionId,
    closureLedger,
    iofPackageTwin,
    workSegments,
    linearAssetSpanAttachments,
    linearAssetStationRanges: linearAssetStationRanges(routeFeet),
    materializationAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    placeholderObjectsProhibited: true,
    syntheticAuditObjectsProhibited: true,
    noScopeVersionCreation: true,
  };
  const objectStationAttachments = projectedObjects.map((object) => ({
    attachmentId: `${input.packageId}:DOCTRINE-PROJECTION:ATTACH:${stableIdPart(object.objectId)}`,
    objectId: object.objectId,
    objectType: object.objectType,
    stationId: object.stationId,
    stationValue: object.stationFeet,
    stationAddress: object.stationAddress,
    projectedCoordinate: object.coordinate,
    coordinate: object.coordinate,
    parentSpanId: object.parentSpanId,
    routeRepositoryId: input.routeRepositoryId,
    attachmentMethod: "DOCTRINE_PROJECTION_ENGINE" as const,
    attachmentStatus: "ASSIGNED" as const,
    projectionAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    engineeringAuthority: DOCTRINE_PROJECTION_AUTHORITY,
    noScopeVersionCreation: true as const,
  }));
  return {
    projectionId: stationProjectionId,
    packageId: input.packageId,
    doctrineProjectionVersion: DOCTRINE_PROJECTION_VERSION,
    productDoctrineId: input.productDoctrine.doctrineId,
    doctrineObjectManifestId: input.doctrineObjectManifest.manifestId,
    projectedObjectManifestId,
    measuredCenterline: {
      measuredCenterlineId,
      measuredSpineId: input.measuredSpine.spineId,
      spineId: input.measuredSpine.spineId,
      routeRepositoryId: input.routeRepositoryId,
      routeGeometryId: input.routeGeometryId,
      geometryHash: input.measuredSpine.geometryHash,
      routeFeet: input.measuredSpine.routeLengthFeet,
      routeMiles: input.measuredSpine.routeLengthMiles,
      routeLengthFeet: input.measuredSpine.routeLengthFeet,
      routeLengthMiles: input.measuredSpine.routeLengthMiles,
      coordinateCount: input.measuredSpine.coordinateCount,
      segments: input.measuredSpine.segments,
      cumulativeMeasureIndex: input.measuredSpine.cumulativeMeasureIndex,
      sourceGeometryRef: input.measuredSpine.sourceGeometryRef,
      authority: "MEASURED_SPINE_AUTHORITY",
      geometryAuthority: "MEASURED_CENTERLINE",
      singleGeometryAuthority: true,
      projectionAuthority: DOCTRINE_PROJECTION_AUTHORITY,
      noScopeVersionCreation: true,
    },
    stationProjection,
    stationGraph: enhancedGraph,
    stationAuthorities: [input.stationAuthority],
    stationAuthorityIds,
    projectedObjectManifest,
    stationObjectManifest: projectedObjectManifest,
    projectedObjects,
    projectedSpans,
    objectAddresses,
    geometryAuthorityDiagnostics: geometryDiagnostics,
    commercialAuditReconciliation: commercialAudit,
    constitutionalStateValidation,
    executionGraphId,
    lifecycleGraphId,
    closureLedgerId: closureLedger.closureLedgerId,
    iofPackageTwinId: iofPackageTwin.twinProjectionId,
    closureLedger,
    iofPackageTwin,
    workSegments,
    objectStationAttachments,
    doctrineProjectionDiagnostics,
    validation,
    summary: {
      summaryId: `${input.packageId}:DOCTRINE-PROJECTION:SUMMARY`,
      status: validation.status,
      objectCount: projectedObjects.length,
      expectedObjectCount,
      spanCount: projectedSpans.length,
      stationCount: input.stationAuthority.stations.length,
      authority: DOCTRINE_PROJECTION_AUTHORITY,
      noScopeVersionCreation: true,
    },
    noScopeVersionCreation: true,
  } satisfies DoctrineProjectionResult;
}
