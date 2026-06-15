import type { BuildCostEstimate, BuildCostModel, CandidateType } from "../types/portfolio";
import { BURIED_CONSTRUCTION_ASSUMPTIONS, DEFAULT_CONSTRUCTION_TYPE } from "../engineering/constructionModel";

export const DEFAULT_BUILD_COST_MODEL: BuildCostModel = {
  constructionType: DEFAULT_CONSTRUCTION_TYPE,
  aerialCostPerFoot: BURIED_CONSTRUCTION_ASSUMPTIONS.costPerFoot,
  undergroundCostPerFoot: BURIED_CONSTRUCTION_ASSUMPTIONS.costPerFoot,
  mixedAerialShare: 0.45,
  crossingCost: 25000,
  regenerationCost: 85000,
  popCost: 60000,
  crossingDistanceFeet: 2500,
  regenerationDistanceFeet: 50000,
  popDistanceFeet: 10000,
};

function unitCost(model: BuildCostModel) {
  if (model.constructionType === "BURIED") return BURIED_CONSTRUCTION_ASSUMPTIONS.costPerFoot;
  if (model.constructionType === "Aerial") return model.aerialCostPerFoot;
  if (model.constructionType === "Underground") return model.undergroundCostPerFoot;
  return model.aerialCostPerFoot * model.mixedAerialShare + model.undergroundCostPerFoot * (1 - model.mixedAerialShare);
}

export function estimateBuildCost(distanceFeet: number, candidateType: CandidateType, model = DEFAULT_BUILD_COST_MODEL): BuildCostEstimate {
  const routeFeet = Math.max(0, distanceFeet);
  const unitCostPerFoot = unitCost(model);
  const baseConstructionCost = routeFeet * unitCostPerFoot;
  const crossingCost = routeFeet > model.crossingDistanceFeet ? model.crossingCost : 0;
  const regenerationCost = routeFeet > model.regenerationDistanceFeet ? model.regenerationCost : 0;
  const popCost = ["data_center", "carrier", "hyperscaler"].includes(candidateType) && routeFeet > model.popDistanceFeet ? model.popCost : 0;
  return {
    constructionType: model.constructionType,
    routeFeet,
    unitCostPerFoot,
    baseConstructionCost,
    crossingCost,
    regenerationCost,
    popCost,
    totalCost: Math.round(baseConstructionCost + crossingCost + regenerationCost + popCost),
  };
}
