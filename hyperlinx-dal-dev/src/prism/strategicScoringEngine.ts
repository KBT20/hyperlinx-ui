import type { InventoryGraph } from "../types/dal";
import type { CandidateSite, DistanceAnalysis, StrategicScore } from "../types/portfolio";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function scoreStrategicFit(graph: InventoryGraph, candidate: CandidateSite, distance: DistanceAnalysis): StrategicScore {
  const routeDiversity = clamp((graph.routes.length > 100 ? 70 : 45) + (distance.distanceToNearestRouteFeet < 1000 ? 20 : 0));
  const metroDensity = clamp(Math.log10(Math.max(graph.stations.length, 1)) * 18);
  const longhaulValue = clamp(["carrier", "hyperscaler", "data_center"].includes(candidate.candidateType) ? 85 : 48);
  const dataCenterProximity = clamp(candidate.candidateType === "data_center" ? 92 : distance.distanceToNearestPopFeet < 5000 ? 72 : 42);
  const hyperscalerAttractiveness = clamp(candidate.candidateType === "hyperscaler" ? 96 : candidate.candidateType === "data_center" ? 74 : 38);
  const marketDensity = clamp(["enterprise", "residential_cluster", "wireless"].includes(candidate.candidateType) ? 76 : 58);
  const futureExpansionPotential = clamp(100 - Math.min(distance.distanceFeet / 160, 70) + (candidate.tags?.length ?? 0) * 2);
  return {
    routeDiversity,
    metroDensity,
    longhaulValue,
    dataCenterProximity,
    hyperscalerAttractiveness,
    marketDensity,
    futureExpansionPotential,
    strategicScore: Math.round(
      routeDiversity * 0.16 +
        metroDensity * 0.12 +
        longhaulValue * 0.16 +
        dataCenterProximity * 0.14 +
        hyperscalerAttractiveness * 0.14 +
        marketDensity * 0.14 +
        futureExpansionPotential * 0.14
    ),
  };
}

