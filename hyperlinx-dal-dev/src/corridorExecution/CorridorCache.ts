import type {
  CorridorAggregateProjection,
  CorridorCacheKeyInput,
  CorridorSegment,
  CorridorViewportProjection,
} from "./CorridorExecutionTypes";
import { buildCorridorCacheKey } from "./CorridorPartitionEngine";

export type CorridorCachedProjection = {
  cacheKey: string;
  corridorId: string;
  createdAt: string;
  segments: CorridorSegment[];
  aggregateProjection: CorridorAggregateProjection;
  viewportProjection: CorridorViewportProjection;
};

const corridorCache = new Map<string, CorridorCachedProjection>();
let cacheHits = 0;
let cacheMisses = 0;

export { buildCorridorCacheKey };

export function getCachedCorridorProjection(cacheKey: string) {
  const cached = corridorCache.get(cacheKey) ?? null;
  if (cached) cacheHits += 1;
  else cacheMisses += 1;
  return cached;
}

export function cacheCorridorProjection(projection: CorridorCachedProjection) {
  corridorCache.set(projection.cacheKey, projection);
  if (corridorCache.size > 50) {
    const oldestKey = corridorCache.keys().next().value as string | undefined;
    if (oldestKey) corridorCache.delete(oldestKey);
  }
  return projection;
}

export function cacheKeyForCorridor(input: CorridorCacheKeyInput) {
  return buildCorridorCacheKey(input);
}

export function corridorCacheStats() {
  return {
    entries: corridorCache.size,
    cacheHits,
    cacheMisses,
  };
}
