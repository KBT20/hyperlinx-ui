import type { TransparentCorridorEstimate } from "../commercial/TransparentEstimatingEngine";
import type { CorridorAggregateProjection, CorridorConstructionSummary, CorridorSegment } from "./CorridorExecutionTypes";

export function buildCorridorAggregateProjection(input: {
  corridorId: string;
  segments: CorridorSegment[];
  estimate?: TransparentCorridorEstimate | null;
}): CorridorAggregateProjection {
  const startedAt = Date.now();
  const totalLengthFeet = sum(input.segments, (segment) => segment.lengthFeet);
  const totalLengthMiles = totalLengthFeet / 5280;
  const estimatedCost = sum(input.segments, (segment) => segment.costSummary.totalCost) || input.estimate?.totalKnownCost || 0;
  const revenue = input.estimate?.sellPrice ?? input.estimate?.financialModel.sellPrice.value ?? 0;
  const lifecycleValue = input.estimate?.mrc ? input.estimate.mrc * 36 : input.estimate?.financialModel.mrc.value ? input.estimate.financialModel.mrc.value * 36 : 0;
  const constructionMix = aggregateConstructionMix(input.segments);
  const unknownCount = sum(input.segments, (segment) => segment.riskSummary.unknownCount);
  const confidence = input.segments.length
    ? Math.round(sum(input.segments, (segment) => segment.riskSummary.confidenceScore) / input.segments.length)
    : input.estimate?.confidence.score ?? 0;
  const margin = revenue && estimatedCost ? Math.round(((revenue - estimatedCost) / revenue) * 10000) / 100 : input.estimate?.grossMarginPercent ?? 0;
  const warnings = input.segments.flatMap((segment) => segment.riskSummary.warnings.map((warning) => `${segment.segmentId}: ${warning}`));

  return {
    projectionId: `CORRIDOR-AGGREGATE-${input.corridorId}-${startedAt}`,
    corridorId: input.corridorId,
    segmentCount: input.segments.length,
    totalLengthFeet: Math.round(totalLengthFeet),
    totalLengthMiles: Math.round(totalLengthMiles * 1000) / 1000,
    estimatedCost: Math.round(estimatedCost),
    revenue: Math.round(revenue),
    lifecycleValue: Math.round(lifecycleValue),
    margin,
    constructionMix,
    unknownCount,
    confidence,
    ilaCount: sum(input.segments, (segment) => segment.ILASummary.ilaCount),
    bookendCount: sum(input.segments, (segment) => segment.bookendSummary.bookendCount),
    workbookSummary: {
      lineItemCount: input.segments.length,
      sectionCount: Math.max(1, new Set(input.segments.map((segment) => segment.constructionSummary.dominantMethod)).size),
      executesFromSegmentSummaries: true,
      fullDetailExportOnDemand: true,
    },
    proposalSummary: {
      consumesAggregateProjectionOnly: true,
      detailedSchedulesAsync: true,
      estimatedCost: Math.round(estimatedCost),
      revenue: Math.round(revenue),
      margin,
    },
    validationState: input.segments.some((segment) => segment.validationState === "FAIL")
      ? "FAIL"
      : input.segments.some((segment) => segment.validationState === "WARNING")
        ? "WARNING"
        : "PASS",
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function aggregateConstructionMix(segments: CorridorSegment[]): CorridorConstructionSummary {
  const summary = segments.reduce<CorridorConstructionSummary>(
    (acc, segment) => ({
      dominantMethod: acc.dominantMethod,
      plowFeet: acc.plowFeet + segment.constructionSummary.plowFeet,
      boreFeet: acc.boreFeet + segment.constructionSummary.boreFeet,
      trenchFeet: acc.trenchFeet + segment.constructionSummary.trenchFeet,
      rockFeet: acc.rockFeet + segment.constructionSummary.rockFeet,
      unknownFeet: acc.unknownFeet + segment.constructionSummary.unknownFeet,
    }),
    {
      dominantMethod: "UNKNOWN",
      plowFeet: 0,
      boreFeet: 0,
      trenchFeet: 0,
      rockFeet: 0,
      unknownFeet: 0,
    },
  );
  const entries: Array<[string, number]> = [
    ["PLOW", summary.plowFeet],
    ["BORE", summary.boreFeet],
    ["TRENCH", summary.trenchFeet],
    ["UNKNOWN", summary.unknownFeet],
  ];
  return {
    ...summary,
    dominantMethod: entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "UNKNOWN",
  };
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}
