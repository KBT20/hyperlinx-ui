import type { CandidateSite } from "../types/candidateSite";
import type { CorridorRisk, CorridorSegment } from "../types/corridor";
import { clamp } from "../affinity/geo";
import { urbanDensityForSite } from "./corridorGraph";

function waterCrossingEstimate(segments: CorridorSegment[], site: CandidateSite) {
  const text = `${site.address} ${site.city} ${site.county ?? ""}`.toLowerCase();
  const geographyHint = /river|creek|lake|bayou|canal|water/.test(text) ? 1 : 0;
  const distanceHint = Math.round(segments.reduce((sum, segment) => sum + segment.distanceFeet, 0) / 9500);
  return Math.min(4, geographyHint + distanceHint);
}

export function analyzeCorridorRisk(segments: CorridorSegment[], site: CandidateSite): CorridorRisk {
  const railCrossingCount = segments.filter((segment) => segment.corridorType === "RAIL").length;
  const highwayCrossingCount = segments.filter((segment) => segment.corridorType === "HIGHWAY").length;
  const waterCrossingCount = waterCrossingEstimate(segments, site);
  const urbanDensity = urbanDensityForSite(site);
  const weightedRisk = segments.reduce((sum, segment) => sum + segment.riskScore * segment.distanceFeet, 0) / Math.max(segments.reduce((sum, segment) => sum + segment.distanceFeet, 0), 1);
  const rowComplexity = clamp(weightedRisk * 0.72 + urbanDensity * 0.28 + railCrossingCount * 4 + highwayCrossingCount * 5);
  const permitComplexity = clamp(urbanDensity * 0.36 + railCrossingCount * 18 + highwayCrossingCount * 20 + waterCrossingCount * 14 + weightedRisk * 0.3);
  const riskScore = clamp(weightedRisk * 0.42 + rowComplexity * 0.24 + permitComplexity * 0.28 + waterCrossingCount * 4);
  return {
    railCrossingCount,
    highwayCrossingCount,
    waterCrossingCount,
    urbanDensity,
    rowComplexity,
    permitComplexity,
    riskScore,
  };
}

