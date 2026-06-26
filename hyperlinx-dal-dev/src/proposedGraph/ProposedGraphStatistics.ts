import type { ProposedGraph } from "./ProposedGraph";

export interface ProposedGraphStatistics {
  totalMiles: number;
  fiberFeet: number;
  ductFeet: number;
  estimatedStationCount: number;
  estimatedVaults: number;
  estimatedRegenSites: number;
  estimatedCabinets: number;
  estimatedCrossings: number;
  estimatedHighwayCrossings: number;
  estimatedRailroadCrossings: number;
  estimatedWaterCrossings: number;
  estimatedUrbanSegments: number;
  estimatedRuralSegments: number;
  estimatedConstructionCost: number;
  confidenceScore: number;
  routeCandidateDerived: boolean;
  centerlineRouteDerived?: true;
  stationedCorridorDerived?: true;
  estimatedOnly: true;
}

export function summarizeProposedGraph(graph: ProposedGraph): ProposedGraphStatistics {
  return graph.statistics;
}
