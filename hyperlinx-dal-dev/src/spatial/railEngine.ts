import type { CandidateSite } from "../types/candidateSite";
import type { BuildPath } from "../types/networkAffinity";
import type { RailIntelligence, RailSegment, SpatialLayers } from "./types";
import { clamp, siteText, stableHash } from "./spatialUtils";

function railHint(site: CandidateSite) {
  return /\b(rail|railroad|bnsf|union pacific|uprr|kcs|amtrak|spur|switchyard)\b/.test(siteText(site)) ? 1 : 0;
}

export function analyzeRailCrossings(site: CandidateSite, buildPath?: BuildPath, layers?: SpatialLayers): RailIntelligence {
  const layerCount = layers?.rails?.length ?? 0;
  const pathCount = Number(buildPath?.railCrossingCount ?? 0);
  const distanceHint = Math.floor(Number(buildPath?.buildFeet ?? 0) / 18000);
  const crossingCount = Math.max(layerCount, pathCount + railHint(site) + distanceHint);
  const crossings: RailSegment[] =
    layers?.rails?.slice(0, crossingCount) ??
    Array.from({ length: crossingCount }, (_, index) => ({
      railId: `rail-${stableHash(`${site.candidateId}|${index}`).toString(16).slice(0, 8)}`,
      name: index === 0 && railHint(site) ? "Inferred rail-adjacent crossing" : "Inferred rail crossing",
      operator: "Unknown",
    }));
  const railRiskScore = clamp(crossingCount * 24 + railHint(site) * 12);

  return {
    railCrossingCount: crossingCount,
    railRiskScore,
    crossings,
    notes: crossingCount ? [`Estimated ${crossingCount} rail crossing(s).`] : ["No rail crossings inferred."],
  };
}
