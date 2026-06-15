import type { CandidateSite } from "../types/candidateSite";
import type { RoadIntelligence, RoadSegment, RoadType, SpatialLayers } from "./types";
import { clamp, minDistanceToGeometryFeet, siteCoordinate, siteText, stableHash } from "./spatialUtils";

function inferRoadType(site: CandidateSite): RoadType {
  const text = siteText(site);
  if (/\b(i-|interstate)\s?\d+/.test(text)) return "Interstate";
  if (/\b(us|tx|state|hwy|highway)\s?-?\s?\d+/.test(text)) return "Highway";
  if (/\b(fm|rm|farm to market|ranch road)\s?-?\s?\d+/.test(text)) return "Farm To Market";
  if (/\b(cr|county road)\s?-?\s?\d+/.test(text)) return "County Road";
  if (/\b(private|pvt)\b/.test(text)) return "Private Road";
  return "City Street";
}

function accessScore(type: RoadType, distanceFeet: number) {
  const base: Record<RoadType, number> = {
    Interstate: 72,
    Highway: 80,
    "Farm To Market": 76,
    "County Road": 66,
    "City Street": 84,
    "Private Road": 42,
  };
  return clamp(base[type] - Math.min(distanceFeet / 180, 28));
}

function fallbackDistance(type: RoadType, site: CandidateSite) {
  if (!site.address) return 1200;
  if (type === "Private Road") return 900;
  if (type === "County Road") return 420;
  if (type === "Interstate") return 650;
  if (type === "Highway") return 260;
  if (type === "Farm To Market") return 340;
  return 90;
}

export function analyzeRoadAccess(site: CandidateSite, layers?: SpatialLayers): RoadIntelligence {
  const target = siteCoordinate(site);
  const nearestLayerRoad = layers?.roads
    ?.map((road) => ({ road, distanceFeet: minDistanceToGeometryFeet(target, road.geometry) }))
    .sort((a, b) => a.distanceFeet - b.distanceFeet)[0];

  if (nearestLayerRoad && Number.isFinite(nearestLayerRoad.distanceFeet)) {
    return {
      nearestRoad: nearestLayerRoad.road,
      roadDistanceFeet: Math.round(nearestLayerRoad.distanceFeet),
      roadAccessScore: accessScore(nearestLayerRoad.road.roadType, nearestLayerRoad.distanceFeet),
      notes: ["Nearest road supplied by spatial road layer."],
    };
  }

  const roadType = inferRoadType(site);
  const distanceFeet = fallbackDistance(roadType, site);
  const road: RoadSegment = {
    roadId: `road-${stableHash(`${site.address}|${site.city}|${roadType}`).toString(16).slice(0, 8)}`,
    name: site.address?.split(",")[0] || `${site.city || "Local"} access road`,
    roadType,
  };

  return {
    nearestRoad: road,
    roadDistanceFeet: distanceFeet,
    roadAccessScore: accessScore(roadType, distanceFeet),
    notes: [`Inferred ${roadType} access from address text.`],
  };
}
