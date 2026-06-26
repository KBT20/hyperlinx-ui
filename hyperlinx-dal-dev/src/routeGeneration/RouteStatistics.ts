export interface RouteStatistics {
  totalRouteLengthFeet: number;
  totalRouteLengthMiles: number;
  fiberFeet: number;
  ductFeet: number;
  estimatedStationCount: number;
  estimatedVaultCount: number;
  estimatedRegenCount: number;
  estimatedHighwayCrossings: number;
  estimatedRailroadCrossings: number;
  estimatedWaterCrossings: number;
  estimatedUrbanSegments: number;
  estimatedRuralSegments: number;
  estimatedConstructionCost: number;
  confidenceScore: number;
  estimatedOnly: true;
}
