import type {
  ExecutionAuthority,
  ExecutionGraphProjectionLayer,
  ExecutionLifecycleState,
  ExecutionNode,
  ExecutionNodeType,
} from "./ExecutionGraphContracts";

const DEFAULT_LIFECYCLE_STATE: ExecutionLifecycleState = {
  commercial: "DRAFT",
  engineering: "READY_FOR_REVIEW",
  marketplace: "NOT_RELEASED",
  control: "NOT_RELEASED",
  field: "NOT_RELEASED",
  operational: "NOT_ACTIVE",
  revenue: "NOT_READY",
};

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || fallback;
}

export function executionNodeIdentity(input: {
  packageId: string;
  nodeType: ExecutionNodeType;
  sourceArtifactId: string;
  stationId?: string;
  parentStationId?: string;
}) {
  return [
    input.packageId,
    "EXECUTION-NODE",
    input.nodeType,
    input.stationId ?? input.parentStationId ?? input.sourceArtifactId,
  ].map((part) => stableIdPart(part)).join(":");
}

export function createExecutionNode(input: {
  packageId: string;
  nodeType: ExecutionNodeType;
  label: string;
  authority: ExecutionAuthority;
  sourceArtifact: string;
  sourceArtifactId: string;
  projectionLayers: ExecutionGraphProjectionLayer[];
  parentNodeId?: string;
  parentStationId?: string;
  stationId?: string;
  stationLabel?: string;
  measureFeet?: number;
  fromStationId?: string;
  toStationId?: string;
  fromMeasureFeet?: number;
  toMeasureFeet?: number;
  coordinate?: [number, number];
  geometryHash?: string;
  lifecycleState?: Partial<ExecutionLifecycleState>;
  productDoctrine?: unknown;
  engineeringDoctrine?: unknown;
  auditProjection?: unknown;
  history?: unknown[];
  dependencies?: string[];
  children?: string[];
  parents?: string[];
  executionObject?: unknown;
  closureLedger?: unknown;
  expectation?: unknown;
  validatedCloses?: unknown[];
  pendingCloses?: unknown[];
  rejectedCloses?: unknown[];
  currentTruth?: unknown;
  lastClose?: unknown;
  nextExpectedClose?: unknown;
  dependencyStatus?: unknown;
  metadata?: Record<string, unknown>;
}): ExecutionNode {
  const stableKey = executionNodeIdentity(input);
  const lifecycleState = { ...DEFAULT_LIFECYCLE_STATE, ...(input.lifecycleState ?? {}) };
  return {
    nodeId: stableKey,
    stableKey,
    identity: stableKey,
    packageId: input.packageId,
    nodeType: input.nodeType,
    label: input.label,
    authority: input.authority,
    sourceArtifact: input.sourceArtifact,
    sourceArtifactId: input.sourceArtifactId,
    projectionLayers: Array.from(new Set(input.projectionLayers)),
    parentNodeId: input.parentNodeId,
    parentStationId: input.parentStationId,
    stationId: input.stationId,
    stationLabel: input.stationLabel,
    measureFeet: input.measureFeet,
    fromStationId: input.fromStationId,
    toStationId: input.toStationId,
    fromMeasureFeet: input.fromMeasureFeet,
    toMeasureFeet: input.toMeasureFeet,
    coordinate: input.coordinate,
    geometryHash: input.geometryHash,
    lifecycleState,
    productDoctrine: input.productDoctrine,
    engineeringDoctrine: input.engineeringDoctrine,
    auditProjection: input.auditProjection,
    commercialState: lifecycleState.commercial,
    engineeringState: lifecycleState.engineering,
    marketplaceState: lifecycleState.marketplace,
    controlState: lifecycleState.control,
    fieldState: lifecycleState.field,
    operationalState: lifecycleState.operational,
    revenueState: lifecycleState.revenue,
    history: input.history ?? [],
    dependencies: input.dependencies ?? [],
    children: input.children ?? [],
    parents: input.parents ?? [],
    executionObject: input.executionObject,
    closureLedger: input.closureLedger,
    expectation: input.expectation,
    validatedCloses: input.validatedCloses ?? [],
    pendingCloses: input.pendingCloses ?? [],
    rejectedCloses: input.rejectedCloses ?? [],
    currentTruth: input.currentTruth,
    lastClose: input.lastClose,
    nextExpectedClose: input.nextExpectedClose,
    dependencyStatus: input.dependencyStatus,
    immutableIdentity: true,
    noScopeVersionCreation: true,
    metadata: input.metadata ?? {},
  };
}
