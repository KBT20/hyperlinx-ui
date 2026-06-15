import type { BuildCostEstimate, DistanceAnalysis, EngineeringScore } from "../types/portfolio";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function scoreEngineering(distance: DistanceAnalysis, build: BuildCostEstimate): EngineeringScore {
  const distanceScore = clamp(100 - distance.distanceFeet / 120);
  const constructability = clamp(distanceScore - (build.constructionType === "Underground" ? 10 : 0));
  const networkComplexity = clamp(100 - (build.crossingCost ? 18 : 0) - (build.regenerationCost ? 24 : 0) - build.routeFeet / 900);
  const existingFacilities = clamp(100 - Math.min(distance.distanceToNearestStationFeet / 80, 65));
  const nodeAdjacency = clamp(100 - Math.min(distance.distanceToNearestNodeFeet / 70, 70));
  return {
    constructability,
    networkComplexity,
    existingFacilities,
    nodeAdjacency,
    engineeringScore: Math.round(distanceScore * 0.35 + constructability * 0.2 + networkComplexity * 0.2 + existingFacilities * 0.15 + nodeAdjacency * 0.1),
  };
}

