import type { TransparentCorridorEstimate } from "../commercial/TransparentEstimatingEngine";
import type { MapLevelOfDetail, ViewportBounds } from "../performance/MapVirtualization";
import type { DALCoordinate } from "../types/dal";

export type CorridorBreakpointType =
  | "POP"
  | "ILA_BOUNDARY"
  | "BOOKEND"
  | "CONSTRUCTION_METHOD_CHANGE"
  | "MUNICIPALITY"
  | "COUNTY"
  | "STATE"
  | "OPERATOR_BREAKPOINT";

export type CorridorExecutionStatus =
  | "INITIALIZING_CORRIDOR"
  | "PARTITIONING_CORRIDOR"
  | "BUILDING_SEGMENTS"
  | "CALCULATING_AGGREGATE"
  | "READY"
  | "FAILED";

export type CorridorSegmentBuildStatus = "PENDING" | "BUILDING" | "CHECKPOINTED" | "FAILED";
export type CorridorValidationState = "PASS" | "WARNING" | "FAIL";
export type CorridorRuntimeTier = "HOT" | "WARM" | "COLD";

export type CorridorNodeReference = {
  nodeId: string;
  coordinate: DALCoordinate;
  stationFeet: number;
  label?: string;
};

export type CorridorBreakpoint = {
  breakpointId: string;
  type: CorridorBreakpointType;
  stationFeet: number;
  coordinate?: DALCoordinate;
  label?: string;
};

export type CorridorConstructionSummary = {
  dominantMethod: string;
  plowFeet: number;
  boreFeet: number;
  trenchFeet: number;
  rockFeet: number;
  unknownFeet: number;
};

export type CorridorMaterialSummary = {
  conduitFeet: number;
  fiberFeet: number;
  handholes: number;
  vaults: number;
  spliceCases: number;
};

export type CorridorLaborSummary = {
  laborCost: number;
  productionDays: number;
  primaryCrew: string;
};

export type CorridorCostSummary = {
  constructionCost: number;
  materialCost: number;
  laborCost: number;
  engineeringCost: number;
  permitCost: number;
  contingencyCost: number;
  totalCost: number;
};

export type CorridorStationSummary = {
  stationCount: number;
  firstStation: number;
  lastStation: number;
  stationIntervalFeet: number;
};

export type CorridorIlaSummary = {
  ilaCount: number;
  candidateCount: number;
  affectedSpanIds: string[];
};

export type CorridorBookendSummary = {
  bookendCount: number;
  startBookend?: string;
  endBookend?: string;
};

export type CorridorConstraintSummary = {
  municipalityCount: number;
  countyCount: number;
  stateCount: number;
  constructionMethodChanges: number;
  operatorBreakpoints: number;
};

export type CorridorRiskSummary = {
  unknownCount: number;
  confidenceScore: number;
  warnings: string[];
};

export type CorridorSegment = {
  segmentId: string;
  corridorId: string;
  sequence: number;
  startStation: number;
  endStation: number;
  startNode: CorridorNodeReference;
  endNode: CorridorNodeReference;
  lengthFeet: number;
  lengthMiles: number;
  geometryHash: string;
  simplifiedGeometry: DALCoordinate[];
  visibleGeometry: DALCoordinate[];
  constructionSummary: CorridorConstructionSummary;
  materialSummary: CorridorMaterialSummary;
  laborSummary: CorridorLaborSummary;
  costSummary: CorridorCostSummary;
  stationSummary: CorridorStationSummary;
  ILASummary: CorridorIlaSummary;
  bookendSummary: CorridorBookendSummary;
  constraintSummary: CorridorConstraintSummary;
  riskSummary: CorridorRiskSummary;
  validationState: CorridorValidationState;
  buildStatus: CorridorSegmentBuildStatus;
  checkpointId: string | null;
  cacheKey: string;
};

export type CorridorCheckpoint = {
  checkpointId: string;
  corridorId: string;
  segmentId: string;
  sequence: number;
  segmentHash: string;
  createdAt: string;
  segment: CorridorSegment;
  recoverable: true;
};

export type CorridorAggregateProjection = {
  projectionId: string;
  corridorId: string;
  segmentCount: number;
  totalLengthFeet: number;
  totalLengthMiles: number;
  estimatedCost: number;
  revenue: number;
  lifecycleValue: number;
  margin: number;
  constructionMix: CorridorConstructionSummary;
  unknownCount: number;
  confidence: number;
  ilaCount: number;
  bookendCount: number;
  workbookSummary: {
    lineItemCount: number;
    sectionCount: number;
    executesFromSegmentSummaries: true;
    fullDetailExportOnDemand: true;
  };
  proposalSummary: {
    consumesAggregateProjectionOnly: true;
    detailedSchedulesAsync: true;
    estimatedCost: number;
    revenue: number;
    margin: number;
  };
  validationState: CorridorValidationState;
  warnings: string[];
  generatedAt: string;
};

export type CorridorViewportProjection = {
  projectionId: string;
  corridorId: string;
  viewportBounds: ViewportBounds | null;
  zoom: number;
  lod: MapLevelOfDetail;
  visibleSegmentIds: string[];
  visibleSegmentCount: number;
  visibleGeometry: DALCoordinate[];
  renderedStationCount: number;
  renderedObjectCount: number;
  materializedTier: CorridorRuntimeTier;
  selectedSegmentId?: string | null;
  adjacentSegmentIds: string[];
  generatedAt: string;
};

export type CorridorPerformanceMetrics = {
  initialRenderTimeMs: number;
  corridorPartitionTimeMs: number;
  workerQueueDepth: number;
  checkpointCount: number;
  cacheHits: number;
  cacheMisses: number;
  visibleSegmentCount: number;
  renderedStationCount: number;
  renderedObjectCount: number;
  workbookCalculationTimeMs: number;
  proposalGenerationTimeMs: number;
  workerUtilization: number;
};

export type CorridorCacheKeyInput = {
  customerTwinId: string;
  customerId: string;
  corridorId: string;
  importHash: string;
  geometryHash: string;
  segmentHash: string;
  workbookHash: string;
};

export type CorridorExecutionSession = {
  sessionId: string;
  corridorId: string;
  customerId: string;
  customerTwinId: string;
  status: CorridorExecutionStatus;
  progressLabel: string;
  totalSegments: number;
  completedSegments: number;
  failedSegmentId?: string | null;
  hotSegmentIds: string[];
  warmSegmentIds: string[];
  coldSegmentIds: string[];
  cacheKey: string;
  checkpointIds: string[];
  createdAt: string;
  updatedAt: string;
  noScopeVersionCreation: true;
  noEngineeringAuthorityMutation: true;
  repositoryTruthUnchanged: true;
};

export type CorridorExecutionProgress = {
  status: CorridorExecutionStatus;
  label: string;
  currentSegment: number;
  totalSegments: number;
  completedSegments: number;
  failedSegmentId?: string | null;
};

export type CorridorExecutionInput = {
  corridorId: string;
  customerId: string;
  customerTwinId: string;
  importHash: string;
  workbookHash: string;
  geometry: DALCoordinate[];
  routeMiles?: number;
  estimate?: TransparentCorridorEstimate | null;
  breakpoints?: CorridorBreakpoint[];
  viewportBounds?: ViewportBounds | null;
  viewportZoom?: number;
  selectedSegmentId?: string | null;
  onProgress?: (progress: CorridorExecutionProgress) => void;
};

export type CorridorExecutionResult = {
  session: CorridorExecutionSession;
  segments: CorridorSegment[];
  aggregateProjection: CorridorAggregateProjection;
  viewportProjection: CorridorViewportProjection;
  metrics: CorridorPerformanceMetrics;
  cacheStatus: "HIT" | "MISS";
};
