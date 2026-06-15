import type { OpportunitySeed } from "../types/portfolio";

export type RankingWeights = {
  financial: number;
  strategic: number;
  engineering: number;
};

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  financial: 0.4,
  strategic: 0.35,
  engineering: 0.25,
};

export function rankOpportunitySeeds(seeds: OpportunitySeed[], weights = DEFAULT_RANKING_WEIGHTS) {
  const ranked = seeds
    .map((seed) => ({
      ...seed,
      overallScore: Math.round(seed.financialScore * weights.financial + seed.strategicScore * weights.strategic + seed.engineeringScore * weights.engineering),
    }))
    .sort((a, b) => b.overallScore - a.overallScore || a.paybackMonths - b.paybackMonths || b.estimatedTCV - a.estimatedTCV);
  return ranked.map((seed, index) => ({ ...seed, rank: index + 1 }));
}

