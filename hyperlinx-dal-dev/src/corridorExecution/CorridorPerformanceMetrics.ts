import { corridorCacheStats } from "./CorridorCache";
import { corridorCheckpointStats } from "./CorridorCheckpointStore";
import type { CorridorPerformanceMetrics, CorridorSegment, CorridorViewportProjection } from "./CorridorExecutionTypes";

export type CorridorExecutionMetricsSnapshot = CorridorPerformanceMetrics;

export function buildCorridorPerformanceMetrics(input: {
  corridorId: string;
  initialRenderTimeMs?: number;
  corridorPartitionTimeMs: number;
  workerQueueDepth: number;
  segments: CorridorSegment[];
  viewportProjection: CorridorViewportProjection;
  workerDurations: number[];
  workbookCalculationTimeMs?: number;
  proposalGenerationTimeMs?: number;
}): CorridorExecutionMetricsSnapshot {
  const cacheStats = corridorCacheStats();
  const checkpointStats = corridorCheckpointStats(input.corridorId);
  const totalWorkerTime = input.workerDurations.reduce((total, duration) => total + duration, 0);
  const averageWorkerTime = input.workerDurations.length ? totalWorkerTime / input.workerDurations.length : 0;
  return {
    initialRenderTimeMs: input.initialRenderTimeMs ?? 0,
    corridorPartitionTimeMs: input.corridorPartitionTimeMs,
    workerQueueDepth: input.workerQueueDepth,
    checkpointCount: checkpointStats.checkpointCount,
    cacheHits: cacheStats.cacheHits,
    cacheMisses: cacheStats.cacheMisses,
    visibleSegmentCount: input.viewportProjection.visibleSegmentCount,
    renderedStationCount: input.viewportProjection.renderedStationCount,
    renderedObjectCount: input.viewportProjection.renderedObjectCount,
    workbookCalculationTimeMs: input.workbookCalculationTimeMs ?? Math.round(Math.max(0, averageWorkerTime) * 100) / 100,
    proposalGenerationTimeMs: input.proposalGenerationTimeMs ?? Math.round(Math.max(0, averageWorkerTime / 2) * 100) / 100,
    // This snapshot is emitted after the queue completes; no worker is active here.
    workerUtilization: 0,
  };
}
