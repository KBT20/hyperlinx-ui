import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate } from "../types/dal";
import type { CorridorType } from "../types/corridor";
import { haversineFeet } from "../affinity/geo";

const COST_PER_FOOT: Record<CorridorType, number> = {
  ROAD: 18,
  RAIL: 42,
  UTILITY: 12,
  HIGHWAY: 55,
  CITY_STREET: 24,
  UNKNOWN: 30,
};

const RISK_SCORE: Record<CorridorType, number> = {
  ROAD: 38,
  RAIL: 78,
  UTILITY: 24,
  HIGHWAY: 86,
  CITY_STREET: 52,
  UNKNOWN: 62,
};

const CONSTRUCTABILITY_SCORE: Record<CorridorType, number> = {
  ROAD: 72,
  RAIL: 34,
  UTILITY: 84,
  HIGHWAY: 28,
  CITY_STREET: 58,
  UNKNOWN: 48,
};

export function deterministicHash(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function corridorCostPerFoot(type: CorridorType) {
  return COST_PER_FOOT[type] ?? COST_PER_FOOT.UNKNOWN;
}

export function corridorRiskScore(type: CorridorType) {
  return RISK_SCORE[type] ?? RISK_SCORE.UNKNOWN;
}

export function corridorConstructabilityScore(type: CorridorType) {
  return CONSTRUCTABILITY_SCORE[type] ?? CONSTRUCTABILITY_SCORE.UNKNOWN;
}

export function coordinateKey(coord: DALCoordinate) {
  return `${coord[1].toFixed(5)},${coord[0].toFixed(5)}`;
}

export function segmentDistanceFeet(start: DALCoordinate, end: DALCoordinate) {
  return haversineFeet(start, end);
}

export function midpoint(start: DALCoordinate, end: DALCoordinate): DALCoordinate {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
}

export function urbanDensityForSite(site: CandidateSite) {
  const text = `${site.companyName} ${site.address} ${site.city} ${site.facilityType ?? ""} ${site.marketSegment ?? ""}`.toLowerCase();
  if (/downtown|central|hospital|school|government|municipal|city|county/.test(text)) return 82;
  if (/data center|industrial|carrier|tower|utility/.test(text)) return 38;
  if (/business|office|enterprise|retail|medical/.test(text)) return 58;
  return 46;
}

export function classifyCorridorSegment(start: DALCoordinate, end: DALCoordinate, site: CandidateSite, variant: string): CorridorType {
  const distance = segmentDistanceFeet(start, end);
  const hash = deterministicHash(`${coordinateKey(start)}|${coordinateKey(end)}|${site.candidateId}|${variant}`);
  const headingBias = Math.abs(start[0] - end[0]) > Math.abs(start[1] - end[1]) ? "ew" : "ns";
  const urbanDensity = urbanDensityForSite(site);
  if (variant.includes("rail") || hash % 29 === 0) return "RAIL";
  if (variant.includes("highway") || distance > 4200 || hash % 23 === 0) return "HIGHWAY";
  if (variant.includes("utility") || hash % 5 === 0) return "UTILITY";
  if (urbanDensity > 68 || headingBias === "ew") return "CITY_STREET";
  if (hash % 11 === 0) return "UNKNOWN";
  return "ROAD";
}

export function routeableCorridorCoordinates(siteCoord: DALCoordinate, attachment: DALCoordinate, variant: string): DALCoordinate[] {
  const lonDelta = attachment[0] - siteCoord[0];
  const latDelta = attachment[1] - siteCoord[1];
  const offsetSign = deterministicHash(`${coordinateKey(siteCoord)}|${coordinateKey(attachment)}|${variant}`) % 2 === 0 ? 1 : -1;
  const offset = Math.min(Math.max(Math.abs(lonDelta + latDelta) * 0.14, 0.0007), 0.018) * offsetSign;

  if (variant === "direct") return [siteCoord, attachment];
  if (variant === "street-grid") return [siteCoord, [attachment[0], siteCoord[1]], attachment];
  if (variant === "city-street") return [siteCoord, [siteCoord[0] + lonDelta * 0.45, siteCoord[1]], [siteCoord[0] + lonDelta * 0.45, attachment[1]], attachment];
  if (variant === "utility") return [siteCoord, [siteCoord[0] + offset, siteCoord[1] + latDelta * 0.35], [attachment[0] + offset, attachment[1] - latDelta * 0.25], attachment];
  if (variant === "highway") return [siteCoord, [siteCoord[0] + lonDelta * 0.25, siteCoord[1] + offset], [siteCoord[0] + lonDelta * 0.75, attachment[1] + offset], attachment];
  if (variant === "rail-avoid") return [siteCoord, [siteCoord[0] - offset, siteCoord[1] + latDelta * 0.5], [attachment[0] - offset, siteCoord[1] + latDelta * 0.5], attachment];
  return [siteCoord, midpoint(siteCoord, attachment), attachment];
}

