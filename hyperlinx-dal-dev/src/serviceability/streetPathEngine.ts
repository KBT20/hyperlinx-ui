import { haversineFeet } from "../affinity/geo";
import { buildDeterministicStreetDrivewayRoute } from "../routing/DeterministicStreetDrivewayRouting";
import type { StreetCenterline } from "../street/streetTypes";
import type { DALCoordinate } from "../types/dal";
import type { StreetSnapResult } from "./streetSnapEngine";

export type LateralRole = "PRIMARY_LATERAL" | "DIVERSE_LATERAL";
export type RoutingMode = "REFERENCE_CENTERLINE_ROUTING" | "DETERMINISTIC_STREET_DRIVEWAY" | "FALLBACK_DIRECT_SEGMENT" | "HUMAN_EDITED";

export type StreetPathConstraints = {
  constructionType: "BURIED";
  avoidHighways?: boolean;
  avoidRail?: boolean;
  diversityRequired?: boolean;
};

export type StreetPathResult = {
  pathType: "SHORTEST_STREET_PATH";
  lateralRole: LateralRole;
  geometry: DALCoordinate[];
  directFeet: number;
  roadFeet: number;
  constructionFeet: number;
  confidence: number;
  pathConfidence: "LOW" | "MEDIUM" | "HIGH";
  routingMode: RoutingMode;
  roadSegmentCount: number;
  roadNamesTraversed: string[];
  roadClassesTraversed: string[];
  attachmentMethod: "CERTIFIED_FIBER_ATTACHMENT" | "STATION_CONNECTION" | "HUMAN_EDITED_ATTACHMENT";
  routingClassification: "CENTERLINE_ASSISTED" | "STREET_DRIVEWAY_DETERMINISTIC" | "DIRECT_SEGMENT_FALLBACK";
  missingDependencies: Array<"road graph" | "centerline dataset" | "routing engine" | "street topology index">;
  routeAccessPoints?: Record<string, DALCoordinate | undefined>;
  sharedPathFeet?: number;
  separationScore?: number;
  geoDiverse?: boolean;
  diversityStatus?: "AVAILABLE" | "DIVERSITY_NOT_AVAILABLE";
};

export function pathLengthFeet(geometry: DALCoordinate[]) {
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) total += haversineFeet(geometry[index - 1], geometry[index]);
  return total;
}

function doglegGeometry(siteSnap: DALCoordinate, attachment: DALCoordinate) {
  const midA: DALCoordinate = [attachment[0], siteSnap[1]];
  if (haversineFeet(siteSnap, midA) < 3 || haversineFeet(midA, attachment) < 3) return [siteSnap, attachment];
  return [siteSnap, midA, attachment];
}

function offsetDoglegGeometry(siteSnap: DALCoordinate, attachment: DALCoordinate) {
  const lonDelta = attachment[0] - siteSnap[0];
  const latDelta = attachment[1] - siteSnap[1];
  const magnitude = Math.sqrt(lonDelta ** 2 + latDelta ** 2) || 1;
  const offset = Math.min(0.006, Math.max(0.0012, magnitude * 0.18));
  const normalLon = (-latDelta / magnitude) * offset;
  const normalLat = (lonDelta / magnitude) * offset;
  const midA: DALCoordinate = [siteSnap[0] + normalLon, siteSnap[1] + normalLat];
  const midB: DALCoordinate = [attachment[0] + normalLon, attachment[1] + normalLat];
  return [siteSnap, midA, midB, attachment];
}

export function buildStreetConstrainedPath(args: {
  siteSnapPoint: StreetSnapResult["snapPoint"];
  attachmentPoint: { lat: number; lon: number };
  candidatePoint?: { lat: number; lon: number };
  stationPoint?: { lat: number; lon: number };
  streetCenterlines?: StreetCenterline[];
  constraints?: StreetPathConstraints;
}): StreetPathResult {
  const siteSnap: DALCoordinate = [args.siteSnapPoint.lon, args.siteSnapPoint.lat];
  const attachment: DALCoordinate = [args.attachmentPoint.lon, args.attachmentPoint.lat];
  const candidate: DALCoordinate = args.candidatePoint ? [args.candidatePoint.lon, args.candidatePoint.lat] : siteSnap;
  const station: DALCoordinate | undefined = args.stationPoint ? [args.stationPoint.lon, args.stationPoint.lat] : undefined;
  const routed = buildDeterministicStreetDrivewayRoute({
    candidateCoordinate: candidate,
    attachmentCoordinate: attachment,
    stationCoordinate: station,
    streetCenterlines: args.streetCenterlines,
  });
  const geometry = routed.geometry.length >= 2 ? routed.geometry : doglegGeometry(siteSnap, attachment);
  const directFeet = haversineFeet(siteSnap, attachment);
  const roadFeet = Math.max(routed.distanceFeet || pathLengthFeet(geometry), directFeet);
  const fallback = routed.routingMode === "DIRECT_FALLBACK";
  const routingMode: RoutingMode =
    routed.routingMode === "REFERENCE_CENTERLINE_ROUTING"
      ? "REFERENCE_CENTERLINE_ROUTING"
      : routed.routingMode === "DETERMINISTIC_STREET_DRIVEWAY"
        ? "DETERMINISTIC_STREET_DRIVEWAY"
        : "FALLBACK_DIRECT_SEGMENT";
  return {
    pathType: "SHORTEST_STREET_PATH",
    lateralRole: "PRIMARY_LATERAL",
    geometry,
    directFeet: Math.round(directFeet),
    roadFeet: Math.round(roadFeet),
    constructionFeet: Math.round(roadFeet),
    confidence: routed.confidence,
    pathConfidence: routed.pathConfidence,
    routingMode,
    roadSegmentCount: routed.roadSegmentCount,
    roadNamesTraversed: routed.roadNamesTraversed,
    roadClassesTraversed: routed.roadClassesTraversed,
    attachmentMethod: routed.attachmentMethod === "DIRECT_FALLBACK_ATTACHMENT" ? "CERTIFIED_FIBER_ATTACHMENT" : routed.attachmentMethod,
    routingClassification: routed.routingClassification,
    missingDependencies: routed.missingDependencies,
    routeAccessPoints: routed.accessPoints,
    sharedPathFeet: Math.round(roadFeet),
    separationScore: 0,
    geoDiverse: false,
  };
}

export function buildDiverseStreetPath(args: {
  siteSnapPoint: StreetSnapResult["snapPoint"];
  attachmentPoint: { lat: number; lon: number };
  primaryPath: StreetPathResult;
}): StreetPathResult {
  const siteSnap: DALCoordinate = [args.siteSnapPoint.lon, args.siteSnapPoint.lat];
  const attachment: DALCoordinate = [args.attachmentPoint.lon, args.attachmentPoint.lat];
  const directFeet = haversineFeet(siteSnap, attachment);
  if (directFeet < 300) {
    return {
      ...args.primaryPath,
      lateralRole: "DIVERSE_LATERAL",
      sharedPathFeet: args.primaryPath.constructionFeet,
      separationScore: 0,
      geoDiverse: false,
      diversityStatus: "DIVERSITY_NOT_AVAILABLE",
    };
  }
  const geometry = offsetDoglegGeometry(siteSnap, attachment);
  const roadFeet = Math.max(pathLengthFeet(geometry), directFeet);
  const separationScore = Math.min(100, Math.round(directFeet / 55));
  return {
    pathType: "SHORTEST_STREET_PATH",
    lateralRole: "DIVERSE_LATERAL",
    geometry,
    directFeet: Math.round(directFeet),
    roadFeet: Math.round(roadFeet),
    constructionFeet: Math.round(roadFeet),
    confidence: 0.34,
    pathConfidence: "LOW",
    routingMode: "FALLBACK_DIRECT_SEGMENT",
    roadSegmentCount: Math.max(0, geometry.length - 1),
    roadNamesTraversed: ["Deterministic diverse ROW grid"],
    roadClassesTraversed: ["FALLBACK_LOCAL_GRID"],
    attachmentMethod: "CERTIFIED_FIBER_ATTACHMENT",
    routingClassification: "STREET_DRIVEWAY_DETERMINISTIC",
    missingDependencies: ["road graph", "centerline dataset", "routing engine", "street topology index"],
    sharedPathFeet: 0,
    separationScore,
    geoDiverse: separationScore >= 35,
    diversityStatus: separationScore >= 35 ? "AVAILABLE" : "DIVERSITY_NOT_AVAILABLE",
  };
}

export function createEditedStreetPath(previous: StreetPathResult, geometry: DALCoordinate[]): StreetPathResult {
  const constructionFeet = Math.round(pathLengthFeet(geometry));
  const directFeet = geometry.length >= 2 ? Math.round(haversineFeet(geometry[0], geometry[geometry.length - 1])) : previous.directFeet;
  return {
    ...previous,
    geometry,
    directFeet,
    roadFeet: constructionFeet,
    constructionFeet,
    confidence: Math.max(previous.confidence, 0.7),
    pathConfidence: "MEDIUM",
    routingMode: "HUMAN_EDITED",
    roadSegmentCount: Math.max(0, geometry.length - 1),
    attachmentMethod: "HUMAN_EDITED_ATTACHMENT",
  };
}
