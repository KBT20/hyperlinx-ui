import type { CorridorCost, CorridorRisk, CorridorSegment } from "../types/corridor";
import type { ConstructionType } from "../types/portfolio";
import { DEFAULT_CONSTRUCTION_TYPE } from "../engineering/constructionModel";

function constructionTypeFor(_segments: CorridorSegment[]): ConstructionType {
  return DEFAULT_CONSTRUCTION_TYPE;
}

export function estimateCorridorCost(segments: CorridorSegment[], risk: CorridorRisk): CorridorCost {
  const distanceFeet = segments.reduce((sum, segment) => sum + segment.distanceFeet, 0);
  const weightedCostPerFoot = segments.reduce((sum, segment) => sum + segment.estimatedCostPerFoot * segment.distanceFeet, 0) / Math.max(distanceFeet, 1);
  const constructionType = constructionTypeFor(segments);
  const labor = Math.round(distanceFeet * weightedCostPerFoot * 0.42);
  const material = Math.round(distanceFeet * weightedCostPerFoot * 0.34);
  const crossings = Math.round(risk.railCrossingCount * 45000 + risk.highwayCrossingCount * 60000 + risk.waterCrossingCount * 38000);
  const permits = Math.round(7500 + risk.permitComplexity * 420);
  const engineering = Math.round((labor + material + crossings) * 0.12);
  const contingency = Math.round((labor + material + crossings + permits + engineering) * (0.08 + risk.riskScore / 800));
  const nrcEstimate = labor + material + crossings + permits + engineering + contingency;
  return {
    constructionType,
    labor,
    material,
    crossings,
    permits,
    engineering,
    contingency,
    nrcEstimate,
    costPerFoot: Math.round(nrcEstimate / Math.max(distanceFeet, 1)),
  };
}
