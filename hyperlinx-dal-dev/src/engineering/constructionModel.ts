import type { ConstructionAssumptions } from "../types/dal";

export const DEFAULT_CONSTRUCTION_TYPE = "BURIED" as const;

export const BURIED_CONSTRUCTION_ASSUMPTIONS: ConstructionAssumptions = {
  constructionType: DEFAULT_CONSTRUCTION_TYPE,
  trenchCost: 32,
  boreCost: 78,
  crossingCost: 28000,
  restorationCost: 11,
  costPerFoot: 43,
};

export function estimateBuriedConstructionCost(args: {
  buildFeet: number;
  boreFeet?: number;
  crossings?: number;
}) {
  const buildFeet = Math.max(0, Number(args.buildFeet || 0));
  const crossings = Math.max(0, Number(args.crossings || 0));
  const boreFeet = Math.max(0, Number(args.boreFeet ?? Math.min(buildFeet, crossings * 180)));
  const trenchFeet = Math.max(0, buildFeet - boreFeet);
  const trenchCost = Math.round(trenchFeet * BURIED_CONSTRUCTION_ASSUMPTIONS.trenchCost);
  const boreCost = Math.round(boreFeet * BURIED_CONSTRUCTION_ASSUMPTIONS.boreCost);
  const crossingCost = Math.round(crossings * BURIED_CONSTRUCTION_ASSUMPTIONS.crossingCost);
  const restorationCost = Math.round(buildFeet * BURIED_CONSTRUCTION_ASSUMPTIONS.restorationCost);
  const totalCost = trenchCost + boreCost + crossingCost + restorationCost;
  return {
    ...BURIED_CONSTRUCTION_ASSUMPTIONS,
    trenchFeet,
    boreFeet,
    crossings,
    trenchCost,
    boreCost,
    crossingCost,
    restorationCost,
    totalCost,
  };
}
