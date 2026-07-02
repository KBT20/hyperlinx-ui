import type { DALCoordinate } from "../types/dal";

export const KERNEL_EXECUTION_GRAPH_AUTHORITY = "KERNEL_EXECUTION_GRAPH_AUTHORITY" as const;
export const KERNEL_EXECUTION_GRAPH_VERSION = "KEG-1" as const;

export const EXECUTION_GRAPH_PROJECTION_LAYERS = [
  "PHYSICAL",
  "COMMERCIAL",
  "STATIONS",
  "ENGINEERING",
  "EXECUTION",
  "MARKETPLACE",
  "CONTROL",
  "FIELD",
  "OPERATIONAL",
  "LIFECYCLE",
] as const;

export type ExecutionGraphProjectionLayer = typeof EXECUTION_GRAPH_PROJECTION_LAYERS[number];

export type ExecutionNodeType =
  | "MEASURED_SPINE"
  | "STATION"
  | "STATION_RANGE"
  | "ENGINEERING_OBJECT"
  | "HANDHOLE"
  | "VAULT"
  | "SPLICE_CASE"
  | "MARKER"
  | "PULL_POINT"
  | "CONDUIT_SEGMENT"
  | "FIBER_SEGMENT"
  | "ILA"
  | "REGEN"
  | "STATIONED_EXPECTATION"
  | "COMMERCIAL_REVIEW_OBJECT"
  | "AUDIT_REVIEW_OBJECT"
  | "CLOSURE_EXPECTATION"
  | "MARKETPLACE_PACKAGE"
  | "CONTROL_RELEASE"
  | "FIELD_CLOSURE"
  | "OPERATIONAL_ASSET"
  | "LIFECYCLE_OBLIGATION";

export type ExecutionEdgeType =
  | "CONTAINS"
  | "SEQUENCE"
  | "DEPENDS_ON"
  | "PROJECTS_TO"
  | "REQUIRES_CLOSURE"
  | "REQUIRES_REVIEW"
  | "GOVERNS"
  | "PROMOTES_TO"
  | "DERIVES_FROM";

export type ExecutionDependencyClass =
  | "PHYSICAL_ORDER"
  | "STATION_PARENTAGE"
  | "OBJECT_ATTACHMENT"
  | "AUDIT_PROJECTION"
  | "CLOSURE_REQUIREMENT"
  | "REVIEW_REQUIREMENT"
  | "LIFECYCLE_GOVERNANCE";

export type ExecutionAuthority =
  | "MEASURED_SPINE_AUTHORITY"
  | "STATION_AUTHORITY"
  | "OBJECT_STATION_ATTACHMENT_AUTHORITY"
  | "STATION_INDEXED_GRAPH_AUTHORITY"
  | "SPINE_AUDIT_PROJECTION_AUTHORITY"
  | typeof KERNEL_EXECUTION_GRAPH_AUTHORITY;

export interface ExecutionLifecycleState {
  commercial: "DRAFT" | "REVIEWED" | "SUBMITTED";
  engineering: "PENDING" | "READY_FOR_REVIEW" | "REVIEW_REQUIRED" | "CERTIFIED";
  marketplace: "NOT_RELEASED" | "ELIGIBLE" | "PACKAGED";
  control: "NOT_RELEASED" | "READY" | "ACTIVE" | "COMPLETE";
  field: "NOT_RELEASED" | "READY" | "IN_PROGRESS" | "CLOSED";
  operational: "NOT_ACTIVE" | "READY" | "ACTIVE";
  revenue: "NOT_READY" | "CONTRACT_BASELINE_READY" | "ACTIVE";
}

export interface ExecutionNode {
  nodeId: string;
  stableKey: string;
  identity: string;
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
  coordinate?: DALCoordinate;
  geometryHash?: string;
  lifecycleState: ExecutionLifecycleState;
  productDoctrine?: unknown;
  engineeringDoctrine?: unknown;
  auditProjection?: unknown;
  commercialState: ExecutionLifecycleState["commercial"];
  engineeringState: ExecutionLifecycleState["engineering"];
  marketplaceState: ExecutionLifecycleState["marketplace"];
  controlState: ExecutionLifecycleState["control"];
  fieldState: ExecutionLifecycleState["field"];
  operationalState: ExecutionLifecycleState["operational"];
  revenueState: ExecutionLifecycleState["revenue"];
  history: unknown[];
  dependencies: string[];
  children: string[];
  parents: string[];
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
  immutableIdentity: true;
  noScopeVersionCreation: true;
  metadata: Record<string, unknown>;
}

export interface ExecutionEdge {
  edgeId: string;
  stableKey: string;
  packageId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: ExecutionEdgeType;
  dependencyClass: ExecutionDependencyClass;
  authority: ExecutionAuthority;
  projectionLayers: ExecutionGraphProjectionLayer[];
  required: boolean;
  sequence?: number;
  fromStationId?: string;
  toStationId?: string;
  fromMeasureFeet?: number;
  toMeasureFeet?: number;
  sourceArtifact: string;
  sourceArtifactId: string;
  acyclic: true;
  immutableIdentity: true;
  noScopeVersionCreation: true;
  metadata: Record<string, unknown>;
}

export interface ExecutionGraphProjection {
  projectionId: string;
  sourceGraphId: string;
  packageId: string;
  layer: ExecutionGraphProjectionLayer;
  nodeIds: string[];
  edgeIds: string[];
  nodeCount: number;
  edgeCount: number;
  authority: typeof KERNEL_EXECUTION_GRAPH_AUTHORITY;
  generatedAt: string;
}

export interface ExecutionGraphValidationResult {
  status: "PASS" | "WARNING" | "FAIL";
  stationNodeCount: number;
  objectNodeCount: number;
  closureExpectationNodeCount: number;
  auditProjectionNodeCount: number;
  edgeCount: number;
  acyclic: boolean;
  immutableIdentity: boolean;
  projectionLayers: ExecutionGraphProjectionLayer[];
  warnings: string[];
  failures: string[];
}

export interface KernelExecutionGraphSummary {
  graphId: string;
  packageId: string;
  graphVersion: typeof KERNEL_EXECUTION_GRAPH_VERSION;
  nodeCount: number;
  edgeCount: number;
  stationNodeCount: number;
  objectNodeCount: number;
  closureExpectationNodeCount: number;
  projectionLayerCount: number;
  validationStatus: "PASS" | "WARNING" | "FAIL";
  identityHash: string;
  noScopeVersionCreation: true;
}

export interface KernelExecutionGraph {
  graphId: string;
  packageId: string;
  graphVersion: typeof KERNEL_EXECUTION_GRAPH_VERSION;
  authority: typeof KERNEL_EXECUTION_GRAPH_AUTHORITY;
  sourceEngine: "ExecutionGraphBuilder";
  measuredSpineId: string;
  stationAuthorityId: string;
  stationIndexedGraphId?: string;
  spineAuditProjectionId?: string;
  geometryHash: string;
  identityHash: string;
  generatedAt: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  projections: ExecutionGraphProjection[];
  validation: ExecutionGraphValidationResult;
  summary: KernelExecutionGraphSummary;
  closureLedgers?: unknown[];
  executionExpectations?: unknown[];
  closureReplaySummary?: unknown;
  constitutionalClosureSummary?: unknown;
  constitutionalAssembly?: unknown;
  immutableIdentity: true;
  noScopeVersionCreation: true;
}
