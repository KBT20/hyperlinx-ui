import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate } from "../types/dal";
import { clamp, haversineFeet } from "../affinity/geo";

export { clamp };

export function stableHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function siteText(site: CandidateSite) {
  return `${site.companyName} ${site.address} ${site.city} ${site.county ?? ""} ${site.facilityType ?? ""} ${site.marketSegment ?? ""}`.toLowerCase();
}

export function siteCoordinate(site: CandidateSite): DALCoordinate | undefined {
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) return undefined;
  return [Number(site.longitude), Number(site.latitude)];
}

export function minDistanceToGeometryFeet(target: DALCoordinate | undefined, geometry: DALCoordinate[] | undefined) {
  if (!target || !Array.isArray(geometry) || !geometry.length) return Infinity;
  let min = Infinity;
  for (const coordinate of geometry) {
    if (!Array.isArray(coordinate) || coordinate.length < 2 || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) continue;
    min = Math.min(min, haversineFeet(target, coordinate));
  }
  return min;
}

export function scoreFromRisk(risk: number) {
  return clamp(100 - risk);
}

export function bandedCost(base: number, count: number, multiplier: number) {
  return Math.round(Math.max(0, base + count * multiplier));
}
