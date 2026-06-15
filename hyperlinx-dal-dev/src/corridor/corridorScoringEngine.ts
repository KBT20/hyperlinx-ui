import type { CorridorCost, CorridorRisk, CorridorSegment } from "../types/corridor";
import { clamp } from "../affinity/geo";

export function corridorConstructabilityScore(segments: CorridorSegment[]) {
  const totalFeet = segments.reduce((sum, segment) => sum + segment.distanceFeet, 0);
  return clamp(segments.reduce((sum, segment) => sum + segment.constructabilityScore * segment.distanceFeet, 0) / Math.max(totalFeet, 1));
}

export function scoreCorridorPath(args: {
  distanceFeet: number;
  risk: CorridorRisk;
  cost: CorridorCost;
  turnCount: number;
  segmentCount: number;
  constructabilityScore: number;
}) {
  const distancePenalty = Math.min(args.distanceFeet / 80, 70);
  const costPenalty = Math.min(args.cost.nrcEstimate / 9000, 80);
  const shapePenalty = args.turnCount * 3 + Math.max(args.segmentCount - 2, 0) * 1.5;
  return clamp(
    100 -
      distancePenalty * 0.28 -
      costPenalty * 0.28 -
      args.risk.riskScore * 0.26 -
      shapePenalty * 0.1 +
      args.constructabilityScore * 0.18
  );
}

