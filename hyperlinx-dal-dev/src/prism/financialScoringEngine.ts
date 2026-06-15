import type { BuildCostEstimate, FinancialScore, RevenueEstimate } from "../types/portfolio";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function scoreFinancials(build: BuildCostEstimate, revenue: RevenueEstimate): FinancialScore {
  const monthlyGross = Math.max(revenue.estimatedMRC * 0.72, 1);
  const paybackMonths = build.totalCost / monthlyGross;
  const margin = (revenue.estimatedRevenueAnnual - build.totalCost * 0.08) / Math.max(revenue.estimatedRevenueAnnual, 1);
  const irr = (revenue.estimatedRevenueAnnual * 0.72 - build.totalCost * 0.12) / Math.max(build.totalCost, 1);
  const revenueDensity = revenue.estimatedRevenueAnnual / Math.max(build.routeFeet, 1);
  const capitalEfficiency = revenue.estimatedTCV / Math.max(build.totalCost, 1);
  const paybackScore = clamp(100 - paybackMonths * 2.1);
  const marginScore = clamp(margin * 100);
  const irrScore = clamp(irr * 70);
  const densityScore = clamp(revenueDensity * 2);
  const efficiencyScore = clamp(capitalEfficiency * 16);
  return {
    paybackMonths,
    margin,
    irr,
    revenueDensity,
    capitalEfficiency,
    financialScore: Math.round(paybackScore * 0.35 + marginScore * 0.2 + irrScore * 0.15 + densityScore * 0.15 + efficiencyScore * 0.15),
  };
}

