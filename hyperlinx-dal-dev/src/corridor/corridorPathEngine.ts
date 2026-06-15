import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { AttachmentType } from "../types/networkAffinity";
import type { BestBuildPath, CorridorPath } from "../types/corridor";
import { findNearestNode } from "../affinity/nearestNodeEngine";
import { findNearestRoute } from "../affinity/nearestRouteEngine";
import { findNearestStation } from "../affinity/nearestStationEngine";
import { estimateCorridorCost } from "./corridorCostEngine";
import { extractCorridorSegments } from "./corridorExtractor";
import { deterministicHash, routeableCorridorCoordinates } from "./corridorGraph";
import { analyzeCorridorRisk } from "./corridorRiskEngine";
import { corridorConstructabilityScore, scoreCorridorPath } from "./corridorScoringEngine";

const variants = ["direct", "street-grid", "city-street", "utility", "highway", "rail-avoid"];

function turnCount(coordinates: DALCoordinate[]) {
  let turns = 0;
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const prev = coordinates[index - 1];
    const current = coordinates[index];
    const next = coordinates[index + 1];
    if (!prev || !current || !next) continue;
    const headingA = Math.atan2(current[1] - prev[1], current[0] - prev[0]);
    const headingB = Math.atan2(next[1] - current[1], next[0] - current[0]);
    if (Math.abs(headingA - headingB) > 0.25) turns += 1;
  }
  return turns;
}

function pathFromCoordinates(args: {
  graph: InventoryGraph;
  site: CandidateSite;
  coordinates: DALCoordinate[];
  variant: string;
  attachmentCoordinate: DALCoordinate;
  attachmentType: AttachmentType;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
}): CorridorPath | null {
  const segments = extractCorridorSegments({ site: args.site, coordinates: args.coordinates, variant: args.variant });
  if (!segments.length) return null;
  const distanceFeet = segments.reduce((sum, segment) => sum + segment.distanceFeet, 0);
  const risk = analyzeCorridorRisk(segments, args.site);
  const cost = estimateCorridorCost(segments, risk);
  const constructabilityScore = corridorConstructabilityScore(segments);
  const turns = turnCount(args.coordinates);
  const weightedScore = scoreCorridorPath({
    distanceFeet,
    risk,
    cost,
    turnCount: turns,
    segmentCount: segments.length,
    constructabilityScore,
  });
  return {
    id: `corridor-path-${deterministicHash(`${args.site.candidateId}|${args.attachmentType}|${args.variant}|${args.routeId ?? ""}|${args.nodeId ?? ""}|${args.stationId ?? ""}`).toString(16)}`,
    siteId: args.site.candidateId,
    attachmentRouteId: args.routeId,
    attachmentNodeId: args.nodeId,
    attachmentStationId: args.stationId,
    attachmentCoordinate: args.attachmentCoordinate,
    coordinates: args.coordinates,
    segments,
    distanceFeet: Math.round(distanceFeet),
    buildMiles: distanceFeet / 5280,
    estimatedRouteMiles: distanceFeet / 5280,
    crossings: risk.railCrossingCount + risk.highwayCrossingCount + risk.waterCrossingCount,
    railCrossingCount: risk.railCrossingCount,
    highwayCrossingCount: risk.highwayCrossingCount,
    waterCrossingCount: risk.waterCrossingCount,
    turnCount: turns,
    segmentCount: segments.length,
    constructionType: cost.constructionType,
    risk,
    cost,
    constructabilityScore,
    weightedScore,
  };
}

export function generateCorridorPathOptions(args: {
  graph: InventoryGraph;
  site: CandidateSite;
  attachmentCoordinate: DALCoordinate;
  attachmentType: AttachmentType;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
}) {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  return variants
    .map((variant) =>
      pathFromCoordinates({
        ...args,
        variant,
        coordinates: routeableCorridorCoordinates(siteCoord, args.attachmentCoordinate, variant),
      })
    )
    .filter(Boolean) as CorridorPath[];
}

export function selectBestCorridorPath(paths: CorridorPath[]): BestBuildPath | null {
  return (
    [...paths].sort(
      (a, b) =>
        b.weightedScore - a.weightedScore ||
        a.cost.nrcEstimate - b.cost.nrcEstimate ||
        a.distanceFeet - b.distanceFeet ||
        a.risk.riskScore - b.risk.riskScore
    )[0] ?? null
  );
}

export function findBestBuildPath(graph: InventoryGraph, site: CandidateSite): BestBuildPath | null {
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) return null;
  const target: DALCoordinate = [Number(site.longitude), Number(site.latitude)];
  const nearestRoute = findNearestRoute(graph, target);
  const nearestNode = findNearestNode(graph, target);
  const nearestStation = findNearestStation(graph, target);
  const candidates = [
    {
      attachmentType: "LATERAL" as AttachmentType,
      coordinate: nearestRoute.coordinate,
      routeId: nearestRoute.routeId ?? nearestStation.routeId,
      nodeId: nearestNode.nodeId,
      stationId: nearestStation.stationId,
    },
    {
      attachmentType: "EXISTING_NODE_ATTACH" as AttachmentType,
      coordinate: nearestNode.coordinate,
      routeId: nearestRoute.routeId ?? nearestStation.routeId,
      nodeId: nearestNode.nodeId,
      stationId: nearestStation.stationId,
    },
    {
      attachmentType: "EXISTING_STATION_ATTACH" as AttachmentType,
      coordinate: nearestStation.coordinate,
      routeId: nearestStation.routeId ?? nearestRoute.routeId,
      nodeId: nearestNode.nodeId,
      stationId: nearestStation.stationId,
    },
  ];
  const paths = candidates.flatMap((candidate) =>
    candidate.coordinate
      ? generateCorridorPathOptions({
          graph,
          site,
          attachmentCoordinate: candidate.coordinate,
          attachmentType: candidate.attachmentType,
          routeId: candidate.routeId,
          nodeId: candidate.nodeId,
          stationId: candidate.stationId,
        })
      : []
  );
  return selectBestCorridorPath(paths);
}

