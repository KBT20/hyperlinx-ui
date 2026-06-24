import type { BudgetCandidate, BudgetDiagnostic, BudgetVendorResponse } from "./BudgetCandidate";
import { createBudgetDiagnostic } from "./BudgetCandidate";
import type { VendorPriceBook } from "./VendorPriceBookRegistry";

export interface BudgetVariance {
  varianceId: string;
  baselineLabel: string;
  comparisonLabel: string;
  varianceAmount: number;
  variancePercent: number;
  affectedStations: string[];
  affectedSegments: string[];
  affectedObjects: string[];
}

export interface BudgetComparison {
  comparisonId: string;
  scopeVersionId: string;
  candidateIds: string[];
  lowestCostCandidateId?: string;
  highestConfidenceCandidateId?: string;
  unitPriceSummary: BudgetVariance[];
  vendorCoverageSummary: Array<{ vendorId: string; coveragePercent: number; responseCount: number }>;
  scheduleSummary: Array<{ candidateId: string; longestScheduleDays?: number; shortestScheduleDays?: number }>;
  capacitySummary: Array<{ candidateId: string; capacity: string[] }>;
  diagnostics: BudgetDiagnostic[];
}

export function compareBudgetCandidates(candidates: readonly BudgetCandidate[]): BudgetComparison {
  const sortedByCost = [...candidates].sort((a, b) => a.totalCost - b.totalCost);
  const highestConfidence = [...candidates].sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0];
  const comparisonId = `BCMP-${candidates.map((candidate) => candidate.candidateId).join("-") || "EMPTY"}`;
  const scopeVersionId = candidates[0]?.scopeVersionId ?? "UNKNOWN_SCOPEVERSION";

  return {
    comparisonId,
    scopeVersionId,
    candidateIds: candidates.map((candidate) => candidate.candidateId),
    lowestCostCandidateId: sortedByCost[0]?.candidateId,
    highestConfidenceCandidateId: highestConfidence?.candidateId,
    unitPriceSummary: candidates.flatMap((candidate) => compareUnitPrices(candidate)),
    vendorCoverageSummary: compareVendorCoverage(candidates),
    scheduleSummary: compareSchedules(candidates),
    capacitySummary: compareCapacity(candidates),
    diagnostics: [
      createBudgetDiagnostic("BUDGET_COMPARISON_COMPLETE", comparisonId, `${candidates.length} budget candidates compared.`, {
        lowestCostCandidateId: sortedByCost[0]?.candidateId,
        highestConfidenceCandidateId: highestConfidence?.candidateId,
      }),
    ],
  };
}

export function compareUnitPrices(candidate: BudgetCandidate, priceBooks: readonly VendorPriceBook[] = []): BudgetVariance[] {
  return candidate.lineItems.map((lineItem) => {
    const matchingPriceBook = priceBooks.find((priceBook) => priceBook.vendorId === lineItem.vendorId);
    const baseline = matchingPriceBook ? matchingPriceBook.unitPrice : lineItem.estimatedCost;
    const varianceAmount = lineItem.candidateCost - baseline;
    return {
      varianceId: `VAR-${candidate.candidateId}-${lineItem.lineItemId}`,
      baselineLabel: matchingPriceBook ? `Price Book ${matchingPriceBook.priceBookId}` : "Estimate",
      comparisonLabel: `Candidate ${candidate.candidateId}`,
      varianceAmount,
      variancePercent: baseline ? Number(((varianceAmount / baseline) * 100).toFixed(2)) : 0,
      affectedStations: lineItem.stationAllocations.map((allocation) => allocation.stationReference.stationId),
      affectedSegments: lineItem.segmentAllocations.map((allocation) => allocation.segmentReference.segmentId),
      affectedObjects: [lineItem.objectReference.objectId],
    };
  });
}

export function compareVendorCoverage(candidates: readonly BudgetCandidate[]): Array<{ vendorId: string; coveragePercent: number; responseCount: number }> {
  const responses = candidates.flatMap((candidate) => candidate.vendorResponses);
  const vendorIds = [...new Set(responses.map((response) => response.vendorId))];
  return vendorIds.map((vendorId) => {
    const vendorResponses = responses.filter((response) => response.vendorId === vendorId);
    const coverageValues = vendorResponses.map((response) => response.coveragePercent ?? 0);
    return {
      vendorId,
      coveragePercent: coverageValues.length
        ? Number((coverageValues.reduce((total, coverage) => total + coverage, 0) / coverageValues.length).toFixed(2))
        : 0,
      responseCount: vendorResponses.length,
    };
  });
}

export function compareSchedules(candidates: readonly BudgetCandidate[]): Array<{ candidateId: string; longestScheduleDays?: number; shortestScheduleDays?: number }> {
  return candidates.map((candidate) => {
    const scheduleDays = candidate.vendorResponses
      .map((response) => response.scheduleDays)
      .filter((days): days is number => typeof days === "number");
    return {
      candidateId: candidate.candidateId,
      longestScheduleDays: scheduleDays.length ? Math.max(...scheduleDays) : undefined,
      shortestScheduleDays: scheduleDays.length ? Math.min(...scheduleDays) : undefined,
    };
  });
}

export function compareCapacity(candidates: readonly BudgetCandidate[]): Array<{ candidateId: string; capacity: string[] }> {
  return candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    capacity: candidate.vendorResponses.map(responseCapacitySummary).filter(Boolean),
  }));
}

export function compareEstimatedToCandidate(candidate: BudgetCandidate): BudgetVariance[] {
  return candidate.lineItems.map((lineItem) => {
    const varianceAmount = lineItem.candidateCost - lineItem.estimatedCost;
    return {
      varianceId: `VAR-EST-${candidate.candidateId}-${lineItem.lineItemId}`,
      baselineLabel: "Estimate",
      comparisonLabel: "Budget Candidate",
      varianceAmount,
      variancePercent: lineItem.estimatedCost ? Number(((varianceAmount / lineItem.estimatedCost) * 100).toFixed(2)) : 0,
      affectedStations: lineItem.stationAllocations.map((allocation) => allocation.stationReference.stationId),
      affectedSegments: lineItem.segmentAllocations.map((allocation) => allocation.segmentReference.segmentId),
      affectedObjects: [lineItem.objectReference.objectId],
    };
  });
}

export function compareCandidateToLockedBudget(candidate: BudgetCandidate, lockedTotal: number): BudgetVariance {
  const varianceAmount = candidate.totalCost - lockedTotal;
  return {
    varianceId: `VAR-LOCKED-${candidate.candidateId}`,
    baselineLabel: "Locked Budget",
    comparisonLabel: "Budget Candidate",
    varianceAmount,
    variancePercent: lockedTotal ? Number(((varianceAmount / lockedTotal) * 100).toFixed(2)) : 0,
    affectedStations: [...new Set(candidate.lineItems.flatMap((lineItem) => lineItem.stationAllocations.map((allocation) => allocation.stationReference.stationId)))],
    affectedSegments: [...new Set(candidate.lineItems.flatMap((lineItem) => lineItem.segmentAllocations.map((allocation) => allocation.segmentReference.segmentId)))],
    affectedObjects: [...new Set(candidate.lineItems.map((lineItem) => lineItem.objectReference.objectId))],
  };
}

function responseCapacitySummary(response: BudgetVendorResponse): string {
  return response.capacitySummary ?? "";
}

function confidenceRank(confidence: BudgetCandidate["confidence"]): number {
  const order: BudgetCandidate["confidence"][] = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERIFIED"];
  return order.indexOf(confidence);
}

