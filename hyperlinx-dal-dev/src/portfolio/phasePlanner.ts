import type { OpportunitySeed, PortfolioPhasePlan } from "../types/portfolio";

export type DeploymentPlan = {
  budget: number;
  phases: PortfolioPhasePlan[];
  selectedOpportunityIds: string[];
};

function avg(items: OpportunitySeed[], value: (item: OpportunitySeed) => number) {
  return items.reduce((sum, item) => sum + value(item), 0) / Math.max(items.length, 1);
}

function phaseSummary(phase: PortfolioPhasePlan["phase"], seeds: OpportunitySeed[]): PortfolioPhasePlan {
  return {
    phase,
    opportunityIds: seeds.map((seed) => seed.id),
    opportunityCount: seeds.length,
    capex: seeds.reduce((sum, seed) => sum + seed.buildCost, 0),
    revenueAnnual: seeds.reduce((sum, seed) => sum + seed.estimatedRevenueAnnual, 0),
    tcv: seeds.reduce((sum, seed) => sum + seed.estimatedTCV, 0),
    averagePaybackMonths: avg(seeds, (seed) => seed.paybackMonths),
    averageScore: avg(seeds, (seed) => seed.overallScore),
  };
}

export function generateDeploymentPlan(seeds: OpportunitySeed[], budget: number): DeploymentPlan {
  const ranked = [...seeds].sort(
    (a, b) =>
      b.overallScore - a.overallScore ||
      (b.constructabilityScore ?? 0) - (a.constructabilityScore ?? 0) ||
      (b.permitScore ?? 0) - (a.permitScore ?? 0) ||
      (b.crossingScore ?? 0) - (a.crossingScore ?? 0) ||
      (b.roi ?? 0) - (a.roi ?? 0) ||
      (a.riskScore ?? 100) - (b.riskScore ?? 100) ||
      a.paybackMonths - b.paybackMonths ||
      b.estimatedRevenueAnnual - a.estimatedRevenueAnnual ||
      a.buildCost - b.buildCost
  );
  const selected: OpportunitySeed[] = [];
  let spent = 0;
  for (const seed of ranked) {
    if (spent + seed.buildCost <= budget || selected.length < 3) {
      selected.push(seed);
      spent += seed.buildCost;
    }
  }
  const phaseSize = Math.ceil(selected.length / 3);
  const phases = (["Phase 1", "Phase 2", "Phase 3"] as const).map((phase, index) => phaseSummary(phase, selected.slice(index * phaseSize, (index + 1) * phaseSize)));
  return {
    budget,
    phases,
    selectedOpportunityIds: selected.map((seed) => seed.id),
  };
}
