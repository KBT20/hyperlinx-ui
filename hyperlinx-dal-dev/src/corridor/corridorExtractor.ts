import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate } from "../types/dal";
import type { CorridorSegment } from "../types/corridor";
import {
  classifyCorridorSegment,
  corridorConstructabilityScore,
  corridorCostPerFoot,
  corridorRiskScore,
  deterministicHash,
  segmentDistanceFeet,
} from "./corridorGraph";

export function extractCorridorSegments(args: {
  site: CandidateSite;
  coordinates: DALCoordinate[];
  variant: string;
}) {
  const segments: CorridorSegment[] = [];
  for (let index = 0; index < args.coordinates.length - 1; index += 1) {
    const start = args.coordinates[index];
    const end = args.coordinates[index + 1];
    if (!start || !end) continue;
    const corridorType = classifyCorridorSegment(start, end, args.site, args.variant);
    const distanceFeet = Math.round(segmentDistanceFeet(start, end));
    if (!Number.isFinite(distanceFeet) || distanceFeet <= 0) continue;
    segments.push({
      id: `corridor-segment-${deterministicHash(`${args.site.candidateId}|${args.variant}|${index}|${start.join(",")}|${end.join(",")}`).toString(16)}`,
      startLat: start[1],
      startLon: start[0],
      endLat: end[1],
      endLon: end[0],
      distanceFeet,
      corridorType,
      estimatedCostPerFoot: corridorCostPerFoot(corridorType),
      riskScore: corridorRiskScore(corridorType),
      constructabilityScore: corridorConstructabilityScore(corridorType),
      geometry: [start, end],
    });
  }
  return segments;
}

