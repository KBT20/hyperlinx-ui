import type { TransparentCorridorEstimate, TransparentEstimateLineItem } from "../commercial/TransparentEstimatingEngine";
import { createCorridorCheckpoint } from "./CorridorCheckpointStore";
import type { CorridorCheckpoint, CorridorSegment } from "./CorridorExecutionTypes";

export type CorridorSegmentWorkerInput = {
  segment: CorridorSegment;
  estimate?: TransparentCorridorEstimate | null;
  routeLengthMiles: number;
  isFirstSegment?: boolean;
  isLastSegment?: boolean;
};

export type CorridorSegmentWorkerResult = {
  segment: CorridorSegment;
  checkpoint: CorridorCheckpoint;
  workerDurationMs: number;
};

export async function processCorridorSegment(input: CorridorSegmentWorkerInput): Promise<CorridorSegmentWorkerResult> {
  const startedAt = nowMs();
  await yieldToRuntime();
  const segment = summarizeSegment(input.segment, input.estimate ?? null, input.routeLengthMiles, input.isFirstSegment === true, input.isLastSegment === true);
  await yieldToRuntime();
  const checkpoint = createCorridorCheckpoint(segment);
  return {
    segment: {
      ...checkpoint.segment,
      checkpointId: checkpoint.checkpointId,
      buildStatus: "CHECKPOINTED",
    },
    checkpoint,
    workerDurationMs: Math.round((nowMs() - startedAt) * 100) / 100,
  };
}

export async function processCorridorSegmentQueue(input: {
  segments: CorridorSegment[];
  estimate?: TransparentCorridorEstimate | null;
  routeLengthMiles: number;
  onSegmentComplete?: (result: CorridorSegmentWorkerResult, queueDepth: number) => void;
}) {
  const completed: CorridorSegment[] = [];
  const checkpoints: CorridorCheckpoint[] = [];
  const workerDurations: number[] = [];
  for (let index = 0; index < input.segments.length; index += 1) {
    const result = await processCorridorSegment({
      segment: {
        ...input.segments[index]!,
        buildStatus: "BUILDING",
      },
      estimate: input.estimate,
      routeLengthMiles: input.routeLengthMiles,
      isFirstSegment: index === 0,
      isLastSegment: index === input.segments.length - 1,
    });
    completed.push(result.segment);
    checkpoints.push(result.checkpoint);
    workerDurations.push(result.workerDurationMs);
    input.onSegmentComplete?.(result, Math.max(0, input.segments.length - index - 1));
  }
  return {
    segments: completed,
    checkpoints,
    workerDurations,
  };
}

function summarizeSegment(segment: CorridorSegment, estimate: TransparentCorridorEstimate | null, routeLengthMiles: number, isFirstSegment: boolean, isLastSegment: boolean): CorridorSegment {
  const totalRouteMiles = Math.max(routeLengthMiles || estimate?.physicalQuantities.routeMiles || segment.lengthMiles, segment.lengthMiles, 0.001);
  const ratio = Math.min(1, Math.max(0, segment.lengthMiles / totalRouteMiles));
  const constructionCost = Math.round((estimate?.financialModel.constructionCost.value ?? estimate?.totalKnownCost ?? 0) * ratio);
  const materialCost = Math.round((sumLineItems(estimate?.materialLineItems) || constructionCost * 0.35) * ratio);
  const laborCost = Math.round((sumLineItems(estimate?.laborLineItems) || constructionCost * 0.45) * ratio);
  const engineeringCost = Math.round((estimate?.financialModel.engineering.value ?? constructionCost * 0.08) * ratio);
  const permitCost = Math.round((estimate?.financialModel.permits.value ?? constructionCost * 0.04) * ratio);
  const contingencyCost = Math.round((estimate?.financialModel.contingency.value ?? constructionCost * 0.1) * ratio);
  const plowPercent = estimate?.civilMix.plowPercent ?? 0;
  const borePercent = (estimate?.civilMix.directionalBoreDirtPercent ?? 0) + (estimate?.civilMix.directionalBoreRockPercent ?? 0);
  const trenchPercent = estimate?.civilMix.openTrenchPercent ?? 0;
  const rockPercent = estimate?.civilMix.directionalBoreRockPercent ?? 0;
  const knownPercent = plowPercent + borePercent + trenchPercent;
  const routeFeet = segment.lengthFeet;
  const stationIntervalFeet = estimate?.physicalQuantities.stationSpacingFeet || 5280;
  const stationCount = Math.max(2, Math.ceil(routeFeet / stationIntervalFeet) + 1);
  const ilaCount = Math.round((estimate?.physicalQuantities.ilaCount ?? 0) * ratio);
  const bookendsEnabled = estimate?.controls.ilaPlanning.bookendIlaEnabled === true;
  const unknownCount = Math.max(0, Math.round((estimate?.unknownQuantities.length ?? (knownPercent ? 0 : 1)) * ratio));
  const confidenceScore = Math.max(0, Math.min(100, estimate?.confidence.score ?? (unknownCount ? 60 : 80)));

  return {
    ...segment,
    constructionSummary: {
      dominantMethod: dominantConstructionMethod(plowPercent, borePercent, trenchPercent),
      plowFeet: Math.round(routeFeet * (plowPercent / 100)),
      boreFeet: Math.round(routeFeet * (borePercent / 100)),
      trenchFeet: Math.round(routeFeet * (trenchPercent / 100)),
      rockFeet: Math.round(routeFeet * (rockPercent / 100)),
      unknownFeet: Math.max(0, Math.round(routeFeet * ((100 - knownPercent) / 100))),
    },
    materialSummary: {
      conduitFeet: Math.round((estimate?.physicalQuantities.conduitFeet ?? routeFeet) * ratio),
      fiberFeet: Math.round((estimate?.physicalQuantities.routeFiberFeet ?? routeFeet) * ratio),
      handholes: Math.round((estimate?.physicalQuantities.handholeCount ?? 0) * ratio),
      vaults: Math.round((estimate?.physicalQuantities.vaultCount ?? 0) * ratio),
      spliceCases: Math.round((estimate?.physicalQuantities.spliceCaseCount ?? 0) * ratio),
    },
    laborSummary: {
      laborCost,
      productionDays: Math.max(1, Math.ceil((estimate?.controls.targetDurationDays ?? 120) * ratio)),
      primaryCrew: "OSP_CONSTRUCTION",
    },
    costSummary: {
      constructionCost,
      materialCost,
      laborCost,
      engineeringCost,
      permitCost,
      contingencyCost,
      totalCost: constructionCost + engineeringCost + permitCost + contingencyCost,
    },
    stationSummary: {
      stationCount,
      firstStation: segment.startStation,
      lastStation: segment.endStation,
      stationIntervalFeet,
    },
    ILASummary: {
      ilaCount,
      candidateCount: Math.max(ilaCount, Math.ceil(segment.lengthMiles / 50)),
      affectedSpanIds: [`${segment.segmentId}:SPAN`],
    },
    bookendSummary: {
      bookendCount: bookendsEnabled ? Number(isFirstSegment) + Number(isLastSegment) : 0,
      startBookend: bookendsEnabled && isFirstSegment ? `${segment.segmentId}:BOOKEND:A` : undefined,
      endBookend: bookendsEnabled && isLastSegment ? `${segment.segmentId}:BOOKEND:Z` : undefined,
    },
    constraintSummary: {
      municipalityCount: 0,
      countyCount: 0,
      stateCount: 0,
      constructionMethodChanges: knownPercent ? 1 : 0,
      operatorBreakpoints: 0,
    },
    riskSummary: {
      unknownCount,
      confidenceScore,
      warnings: unknownCount ? ["Segment contains unresolved commercial quantities."] : [],
    },
    validationState: unknownCount ? "WARNING" : "PASS",
    buildStatus: "CHECKPOINTED",
  };
}

function sumLineItems(items: TransparentEstimateLineItem[] | undefined) {
  return (items ?? []).reduce((total, item) => total + Number(item.extendedCost.value ?? 0), 0);
}

function dominantConstructionMethod(plow: number, bore: number, trench: number) {
  const entries: Array<[string, number]> = [
    ["PLOW", plow],
    ["BORE", bore],
    ["TRENCH", trench],
  ];
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "UNKNOWN";
}

function yieldToRuntime() {
  return new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 16 });
      return;
    }
    setTimeout(resolve, 0);
  });
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
