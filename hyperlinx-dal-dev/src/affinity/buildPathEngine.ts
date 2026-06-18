import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { AttachmentType, BuildPath } from "../types/networkAffinity";
import { generateCorridorPathOptions, selectBestCorridorPath } from "../corridor/corridorPathEngine";
import { DEFAULT_CONSTRUCTION_TYPE, estimateBuriedConstructionCost, BURIED_CONSTRUCTION_ASSUMPTIONS } from "../engineering/constructionModel";
import { buildDeterministicStreetDrivewayRoute } from "../routing/DeterministicStreetDrivewayRouting";
import { haversineFeet } from "./geo";

function stationCoordinateFor(graph: InventoryGraph | undefined, stationId?: string, routeId?: string): DALCoordinate | undefined {
  const station =
    (stationId ? graph?.stations.find((item) => item.stationId === stationId) : undefined) ??
    (routeId ? graph?.stations.find((item) => item.routeId === routeId) : undefined);
  return station ? [station.lon, station.lat] : undefined;
}

export function buildPathForAttachment(args: {
  graph?: InventoryGraph;
  site: CandidateSite;
  attachmentCoordinate?: DALCoordinate;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType: AttachmentType;
}): BuildPath {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  const attach = args.attachmentCoordinate ?? siteCoord;
  const deterministicRoute = buildDeterministicStreetDrivewayRoute({
    candidateCoordinate: siteCoord,
    attachmentCoordinate: attach,
    stationCoordinate: stationCoordinateFor(args.graph, args.stationId, args.routeId),
    site: args.site,
    variant: args.attachmentType.toLowerCase(),
  });
  const corridorPath =
    args.graph && args.attachmentCoordinate
      ? selectBestCorridorPath(
          generateCorridorPathOptions({
            graph: args.graph,
            site: args.site,
            attachmentCoordinate: args.attachmentCoordinate,
            routeId: args.routeId,
            nodeId: args.nodeId,
            stationId: args.stationId,
            attachmentType: args.attachmentType,
          })
        )
      : null;
  const buildFeet = haversineFeet(siteCoord, attach);
  const routeableFeet = deterministicRoute.distanceFeet || corridorPath?.distanceFeet || buildFeet;
  const estimatedUndergroundFeet = Math.round(routeableFeet);
  const estimatedAerialFeet = 0;
  const estimatedCrossings = corridorPath?.crossings ?? Math.max(0, Math.round(routeableFeet / 2200));
  const estimatedBores = Math.max(0, Math.round(estimatedUndergroundFeet / 2200));
  const buriedCost = estimateBuriedConstructionCost({
    buildFeet: routeableFeet,
    boreFeet: estimatedBores * 180,
    crossings: estimatedCrossings,
  });
  return {
    siteId: args.site.candidateId,
    routeId: corridorPath?.attachmentRouteId ?? args.routeId,
    nodeId: corridorPath?.attachmentNodeId ?? args.nodeId,
    stationId: corridorPath?.attachmentStationId ?? args.stationId,
    attachmentType: args.attachmentType,
    buildFeet: Math.round(routeableFeet),
    buildMiles: routeableFeet / 5280,
    estimatedRouteMiles: routeableFeet / 5280,
    estimatedCrossings,
    estimatedBores,
    estimatedAerialFeet,
    estimatedUndergroundFeet,
    railCrossingCount: corridorPath?.railCrossingCount,
    highwayCrossingCount: corridorPath?.highwayCrossingCount,
    waterCrossingCount: corridorPath?.waterCrossingCount,
    turnCount: Math.max(0, deterministicRoute.geometry.length - 2),
    segmentCount: deterministicRoute.roadSegmentCount,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    estimatedCost: buriedCost.totalCost,
    riskScore: corridorPath?.risk.riskScore,
    constructabilityScore: corridorPath?.constructabilityScore,
    corridorPath: corridorPath ?? undefined,
    corridorCost: corridorPath?.cost,
    corridorRisk: corridorPath?.risk,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
    routingMode: deterministicRoute.routingMode,
    routingClassification: deterministicRoute.routingClassification,
    pathConfidence: deterministicRoute.pathConfidence,
    roadSegmentCount: deterministicRoute.roadSegmentCount,
    roadNamesTraversed: deterministicRoute.roadNamesTraversed,
    roadClassesTraversed: deterministicRoute.roadClassesTraversed,
    attachmentMethod: deterministicRoute.attachmentMethod,
    missingRoutingDependencies: deterministicRoute.missingDependencies,
    routeAccessPoints: deterministicRoute.accessPoints,
    geometry: deterministicRoute.geometry.length >= 2 ? deterministicRoute.geometry : corridorPath?.coordinates ?? [siteCoord, attach],
  };
}
