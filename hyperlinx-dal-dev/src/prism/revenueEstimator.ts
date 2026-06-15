import type { CandidateSite, CandidateType, PricingModel, RevenueEstimate } from "../types/portfolio";

export const DEFAULT_PRICING_MODEL: PricingModel = {
  termMonths: 60,
  revenueMultiplier: 1,
};

const typeRevenue: Record<CandidateType, { nrc: number; mrc: number }> = {
  enterprise: { nrc: 12000, mrc: 1800 },
  tower: { nrc: 18000, mrc: 2600 },
  data_center: { nrc: 65000, mrc: 9500 },
  wireless: { nrc: 15000, mrc: 2300 },
  carrier: { nrc: 42000, mrc: 6200 },
  hyperscaler: { nrc: 125000, mrc: 18500 },
  residential_cluster: { nrc: 8000, mrc: 1250 },
};

export function estimateRevenue(candidate: CandidateSite, model = DEFAULT_PRICING_MODEL): RevenueEstimate {
  const baseline = typeRevenue[candidate.candidateType];
  const estimatedMRC = Math.round((candidate.estimatedRevenueMonthly ?? baseline.mrc) * model.revenueMultiplier);
  const estimatedNRC = Math.round((candidate.estimatedNRC ?? baseline.nrc) * model.revenueMultiplier);
  return {
    estimatedRevenueMonthly: estimatedMRC,
    estimatedRevenueAnnual: estimatedMRC * 12,
    estimatedNRC,
    estimatedMRC,
    estimatedTCV: estimatedNRC + estimatedMRC * model.termMonths,
  };
}

