import type { CandidateSite } from "../types/candidateSite";
import type { BuildPath } from "../types/networkAffinity";
import type { SpatialLayers, WaterCrossing, WaterCrossingType, WaterIntelligence } from "./types";
import { clamp, siteText, stableHash } from "./spatialUtils";

function inferWaterType(text: string): WaterCrossingType {
  if (/\blake\b/.test(text)) return "Lake";
  if (/\bcanal\b/.test(text)) return "Canal";
  if (/\b(river|bayou)\b/.test(text)) return "River";
  return "Stream";
}

function waterHint(site: CandidateSite) {
  return /\b(river|creek|stream|lake|canal|bayou|water|flood|wetland)\b/.test(siteText(site)) ? 1 : 0;
}

export function analyzeWaterCrossings(site: CandidateSite, buildPath?: BuildPath, layers?: SpatialLayers): WaterIntelligence {
  const text = siteText(site);
  const layerCount = layers?.waters?.length ?? 0;
  const pathCount = Number(buildPath?.waterCrossingCount ?? 0);
  const distanceHint = Math.floor(Number(buildPath?.buildFeet ?? 0) / 12000);
  const crossingCount = Math.max(layerCount, pathCount + waterHint(site) + distanceHint);
  const crossingType = inferWaterType(text);
  const crossings: WaterCrossing[] =
    layers?.waters?.slice(0, crossingCount) ??
    Array.from({ length: crossingCount }, (_, index) => ({
      crossingId: `water-${stableHash(`${site.candidateId}|${index}|${crossingType}`).toString(16).slice(0, 8)}`,
      name: index === 0 && waterHint(site) ? `Inferred ${crossingType.toLowerCase()} crossing` : "Inferred water crossing",
      crossingType,
      riskScore: crossingType === "River" ? 32 : crossingType === "Lake" ? 34 : crossingType === "Canal" ? 24 : 18,
    }));
  const waterRiskScore = clamp(crossings.reduce((sum, crossing) => sum + crossing.riskScore, 0));

  return {
    waterCrossingCount: crossingCount,
    waterRiskScore,
    crossings,
    notes: crossingCount ? [`Estimated ${crossingCount} water crossing(s).`] : ["No water crossings inferred."],
  };
}
