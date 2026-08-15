import { runtimeDiagnosticsLog, runtimeDiagnosticsWarn } from "../performance/RuntimeDiagnostics";
import { cacheCorridorProjection, getCachedCorridorProjection } from "./CorridorCache";
import { buildCorridorAggregateProjection } from "./CorridorAggregateProjection";
import {
  buildCorridorCacheKey,
  corridorLengthFeet,
  geometryHash,
  nowMs,
  partitionCorridor,
  stableHash,
} from "./CorridorPartitionEngine";
import { buildCorridorPerformanceMetrics } from "./CorridorPerformanceMetrics";
import { processCorridorSegmentQueue } from "./CorridorSegmentWorker";
import type {
  CorridorExecutionInput,
  CorridorExecutionProgress,
  CorridorExecutionResult,
  CorridorExecutionSession,
  CorridorSegment,
} from "./CorridorExecutionTypes";
import { buildCorridorViewportProjection } from "./CorridorViewportProjection";

export async function executeCorridorInBackground(input: CorridorExecutionInput): Promise<CorridorExecutionResult> {
  const startedAt = nowMs();
  const sanitizedGeometry = input.geometry.filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]));
  const routeGeometryHash = geometryHash(sanitizedGeometry);
  const segmentSeedHash = stableHash(`${sanitizedGeometry.length}:${routeGeometryHash}`);
  const cacheKey = buildCorridorCacheKey({
    customerTwinId: input.customerTwinId,
    customerId: input.customerId,
    corridorId: input.corridorId,
    importHash: input.importHash,
    geometryHash: routeGeometryHash,
    segmentHash: segmentSeedHash,
    workbookHash: input.workbookHash,
  });
  const cached = getCachedCorridorProjection(cacheKey);
  if (cached) {
    const session = createSession(input, cacheKey, cached.segments, "READY", cached.segments.length, cached.segments.length);
    const metrics = buildCorridorPerformanceMetrics({
      corridorId: input.corridorId,
      initialRenderTimeMs: Math.round((nowMs() - startedAt) * 100) / 100,
      corridorPartitionTimeMs: 0,
      workerQueueDepth: 0,
      segments: cached.segments,
      viewportProjection: cached.viewportProjection,
      workerDurations: [],
    });
    emitProgress(input.onProgress, "READY", "Ready", cached.segments.length, cached.segments.length, cached.segments.length);
    runtimeDiagnosticsLog("CorridorExecutionEngine", {
      authority: "CORRIDOR_EXECUTION_ENGINE",
      cacheStatus: "HIT",
      corridorId: input.corridorId,
      endpoint: "local-runtime",
      segmentCount: cached.segments.length,
    });
    return {
      session,
      segments: cached.segments,
      aggregateProjection: cached.aggregateProjection,
      viewportProjection: cached.viewportProjection,
      metrics,
      cacheStatus: "HIT",
    };
  }

  emitProgress(input.onProgress, "INITIALIZING_CORRIDOR", "Initializing Corridor", 0, 0, 0);
  runtimeDiagnosticsLog("CorridorExecutionEngine", {
    authority: "CORRIDOR_EXECUTION_ENGINE",
    cacheStatus: "MISS",
    corridorId: input.corridorId,
    geometryHash: routeGeometryHash,
    vertexCount: sanitizedGeometry.length,
  });

  emitProgress(input.onProgress, "PARTITIONING_CORRIDOR", "Partitioning Corridor", 0, 0, 0);
  const partition = partitionCorridor({
    corridorId: input.corridorId,
    customerId: input.customerId,
    customerTwinId: input.customerTwinId,
    importHash: input.importHash,
    workbookHash: input.workbookHash,
    geometry: sanitizedGeometry,
    breakpoints: input.breakpoints,
  });

  const totalSegments = partition.segments.length;
  let completedSegments = 0;
  const session = createSession(input, cacheKey, partition.segments, "BUILDING_SEGMENTS", totalSegments, completedSegments);
  emitProgress(input.onProgress, "BUILDING_SEGMENTS", `Building Segment 1/${Math.max(totalSegments, 1)}`, 1, totalSegments, completedSegments);

  let processedSegments: CorridorSegment[] = [];
  let workerDurations: number[] = [];
  try {
    const routeLengthMiles = input.routeMiles ?? corridorLengthFeet(sanitizedGeometry) / 5280;
    const workerResult = await processCorridorSegmentQueue({
      segments: partition.segments,
      estimate: input.estimate,
      routeLengthMiles,
      onSegmentComplete(result, queueDepth) {
        completedSegments += 1;
        session.completedSegments = completedSegments;
        session.checkpointIds.push(result.checkpoint.checkpointId);
        session.updatedAt = new Date().toISOString();
        emitProgress(
          input.onProgress,
          "BUILDING_SEGMENTS",
          `Building Segment ${Math.min(completedSegments + 1, totalSegments)}/${totalSegments}`,
          Math.min(completedSegments + 1, totalSegments),
          totalSegments,
          completedSegments,
        );
        runtimeDiagnosticsLog("CorridorSegmentWorker", {
          corridorId: input.corridorId,
          segmentId: result.segment.segmentId,
          checkpointId: result.checkpoint.checkpointId,
          queueDepth,
          status: "CHECKPOINTED",
        });
      },
    });
    processedSegments = workerResult.segments;
    workerDurations = workerResult.workerDurations;
  } catch (error) {
    const failedSegmentId = partition.segments[completedSegments]?.segmentId ?? null;
    session.status = "FAILED";
    session.failedSegmentId = failedSegmentId;
    session.progressLabel = failedSegmentId ? `Failed at ${failedSegmentId}` : "Failed";
    runtimeDiagnosticsWarn("CorridorExecutionEngine", {
      corridorId: input.corridorId,
      failedSegmentId,
      reason: error instanceof Error ? error.message : String(error),
      completedSegments,
      retryFromFailedSegment: true,
    });
    emitProgress(input.onProgress, "FAILED", session.progressLabel, completedSegments, totalSegments, completedSegments, failedSegmentId);
    throw error;
  }

  emitProgress(input.onProgress, "CALCULATING_AGGREGATE", "Calculating Aggregate", totalSegments, totalSegments, completedSegments);
  const aggregateProjection = buildCorridorAggregateProjection({
    corridorId: input.corridorId,
    segments: processedSegments,
    estimate: input.estimate,
  });
  const viewportProjection = buildCorridorViewportProjection({
    corridorId: input.corridorId,
    segments: processedSegments,
    viewportBounds: input.viewportBounds ?? null,
    zoom: input.viewportZoom ?? 9,
    selectedSegmentId: input.selectedSegmentId ?? null,
  });
  const metrics = buildCorridorPerformanceMetrics({
    corridorId: input.corridorId,
    initialRenderTimeMs: Math.round((nowMs() - startedAt) * 100) / 100,
    corridorPartitionTimeMs: partition.partitionTimeMs,
    workerQueueDepth: 0,
    segments: processedSegments,
    viewportProjection,
    workerDurations,
  });

  session.status = "READY";
  session.progressLabel = "Ready";
  session.completedSegments = processedSegments.length;
  session.hotSegmentIds = viewportProjection.visibleSegmentIds;
  session.warmSegmentIds = adjacentWarmSegments(processedSegments, viewportProjection.visibleSegmentIds);
  session.coldSegmentIds = processedSegments
    .map((segment) => segment.segmentId)
    .filter((segmentId) => !session.hotSegmentIds.includes(segmentId) && !session.warmSegmentIds.includes(segmentId));
  session.updatedAt = new Date().toISOString();
  emitProgress(input.onProgress, "READY", "Ready", totalSegments, totalSegments, processedSegments.length);

  cacheCorridorProjection({
    cacheKey,
    corridorId: input.corridorId,
    createdAt: new Date().toISOString(),
    segments: processedSegments,
    aggregateProjection,
    viewportProjection,
  });

  runtimeDiagnosticsLog("CorridorExecutionEngine", {
    authority: "CORRIDOR_EXECUTION_ENGINE",
    corridorId: input.corridorId,
    status: "READY",
    segmentCount: processedSegments.length,
    checkpointCount: session.checkpointIds.length,
    visibleSegmentCount: viewportProjection.visibleSegmentCount,
    renderedStationCount: viewportProjection.renderedStationCount,
    renderedObjectCount: viewportProjection.renderedObjectCount,
  });

  return {
    session,
    segments: processedSegments,
    aggregateProjection,
    viewportProjection,
    metrics,
    cacheStatus: "MISS",
  };
}

function createSession(
  input: CorridorExecutionInput,
  cacheKey: string,
  segments: CorridorSegment[],
  status: CorridorExecutionSession["status"],
  totalSegments: number,
  completedSegments: number,
): CorridorExecutionSession {
  const visibleSegmentIds = segments.slice(0, Math.min(3, segments.length)).map((segment) => segment.segmentId);
  const now = new Date().toISOString();
  return {
    sessionId: `CORRIDOR-EXECUTION-SESSION-${input.corridorId}-${Date.now()}`,
    corridorId: input.corridorId,
    customerId: input.customerId,
    customerTwinId: input.customerTwinId,
    status,
    progressLabel: status === "READY" ? "Ready" : "Initializing Corridor",
    totalSegments,
    completedSegments,
    failedSegmentId: null,
    hotSegmentIds: visibleSegmentIds,
    warmSegmentIds: adjacentWarmSegments(segments, visibleSegmentIds),
    coldSegmentIds: segments.map((segment) => segment.segmentId).filter((segmentId) => !visibleSegmentIds.includes(segmentId)),
    cacheKey,
    checkpointIds: [],
    createdAt: now,
    updatedAt: now,
    noScopeVersionCreation: true,
    noEngineeringAuthorityMutation: true,
    repositoryTruthUnchanged: true,
  };
}

function adjacentWarmSegments(segments: CorridorSegment[], hotSegmentIds: string[]) {
  const hotSequences = new Set(segments.filter((segment) => hotSegmentIds.includes(segment.segmentId)).map((segment) => segment.sequence));
  return segments
    .filter((segment) => [...hotSequences].some((sequence) => Math.abs(segment.sequence - sequence) === 1))
    .map((segment) => segment.segmentId);
}

function emitProgress(
  onProgress: CorridorExecutionInput["onProgress"],
  status: CorridorExecutionProgress["status"],
  label: string,
  currentSegment: number,
  totalSegments: number,
  completedSegments: number,
  failedSegmentId?: string | null,
) {
  onProgress?.({
    status,
    label,
    currentSegment,
    totalSegments,
    completedSegments,
    failedSegmentId: failedSegmentId ?? null,
  });
}
