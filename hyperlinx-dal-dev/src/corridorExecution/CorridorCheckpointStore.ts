import type { CorridorCheckpoint, CorridorSegment } from "./CorridorExecutionTypes";

const checkpointStore = new Map<string, CorridorCheckpoint>();

export function createCorridorCheckpoint(segment: CorridorSegment): CorridorCheckpoint {
  const checkpoint: CorridorCheckpoint = {
    checkpointId: `CORRIDOR-CHECKPOINT-${segment.segmentId}-${Date.now()}`,
    corridorId: segment.corridorId,
    segmentId: segment.segmentId,
    sequence: segment.sequence,
    segmentHash: segment.geometryHash,
    createdAt: new Date().toISOString(),
    segment: {
      ...segment,
      buildStatus: "CHECKPOINTED",
    },
    recoverable: true,
  };
  checkpointStore.set(checkpoint.checkpointId, checkpoint);
  return checkpoint;
}

export function saveCorridorCheckpoint(checkpoint: CorridorCheckpoint) {
  checkpointStore.set(checkpoint.checkpointId, checkpoint);
  return checkpoint;
}

export function loadCorridorCheckpoint(checkpointId: string) {
  return checkpointStore.get(checkpointId) ?? null;
}

export function listCorridorCheckpoints(corridorId: string) {
  return [...checkpointStore.values()]
    .filter((checkpoint) => checkpoint.corridorId === corridorId)
    .sort((a, b) => a.sequence - b.sequence);
}

export function recoverSegmentsFromCheckpoints(corridorId: string) {
  return listCorridorCheckpoints(corridorId).map((checkpoint) => checkpoint.segment);
}

export function corridorCheckpointStats(corridorId?: string) {
  const checkpoints = corridorId ? listCorridorCheckpoints(corridorId) : [...checkpointStore.values()];
  return {
    checkpointCount: checkpoints.length,
    recoverableCount: checkpoints.filter((checkpoint) => checkpoint.recoverable).length,
  };
}
