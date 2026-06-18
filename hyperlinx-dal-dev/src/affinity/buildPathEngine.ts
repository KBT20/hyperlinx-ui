import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { AttachmentType, BuildPath } from "../types/networkAffinity";
import type { StreetCenterline } from "../street/streetTypes";
import { DEFAULT_CONSTRUCTION_TYPE, estimateBuriedConstructionCost, BURIED_CONSTRUCTION_ASSUMPTIONS } from "../engineering/constructionModel";
import { routeInventoryExtensionViaStreetGraph } from "../routing/StreetGraphRouter";

export function buildPathForAttachment(args: {
  graph?: InventoryGraph;
  site: CandidateSite;
  attachmentCoordinate?: DALCoordinate;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType: AttachmentType;
  streetCenterlines?: StreetCenterline[];
}): BuildPath {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  const attach = args.attachmentCoordinate ?? siteCoord;
  const streetGraphRoute = routeInventoryExtensionViaStreetGraph({
    candidateCoordinate: siteCoord,
    attachmentCoordinate: attach,
    streetCenterlines: args.streetCenterlines,
  });
  const routeableFeet = streetGraphRoute.routeStatus === "VALID" ? streetGraphRoute.routeFeet : 0;
  const estimatedUndergroundFeet = Math.round(routeableFeet);
  const estimatedAerialFeet = 0;
  const estimatedCrossings = streetGraphRoute.routeStatus === "VALID" ? Math.max(0, Math.round(routeableFeet / 2200)) : 0;
  const estimatedBores = Math.max(0, Math.round(estimatedUndergroundFeet / 2200));
  const buriedCost = estimateBuriedConstructionCost({
    buildFeet: routeableFeet,
    boreFeet: estimatedBores * 180,
    crossings: estimatedCrossings,
  });
  return {
    siteId: args.site.candidateId,
    routeId: args.routeId,
    nodeId: args.nodeId,
    stationId: args.stationId,
    attachmentType: args.attachmentType,
    buildFeet: Math.round(routeableFeet),
    buildMiles: routeableFeet / 5280,
    estimatedRouteMiles: routeableFeet / 5280,
    estimatedCrossings,
    estimatedBores,
    estimatedAerialFeet,
    estimatedUndergroundFeet,
    railCrossingCount: 0,
    highwayCrossingCount: estimatedCrossings,
    waterCrossingCount: 0,
    turnCount: Math.max(0, streetGraphRoute.geometry.length - 2),
    segmentCount: streetGraphRoute.roadSegmentCount,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    estimatedCost: buriedCost.totalCost,
    riskScore: streetGraphRoute.routeStatus === "VALID" ? undefined : 100,
    constructabilityScore: streetGraphRoute.routeStatus === "VALID" ? undefined : 0,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
    routingMode: "STREET_GRAPH_TRAVERSAL",
    routingClassification: "STREET_GRAPH_ASTAR",
    pathConfidence: streetGraphRoute.routeStatus === "VALID" ? "HIGH" : "LOW",
    routeStatus: streetGraphRoute.routeStatus,
    routeFailureReason: streetGraphRoute.failureReason,
    routingAudit: streetGraphRoute.audit,
    streetGraphRoute,
    roadSegmentCount: streetGraphRoute.roadSegmentCount,
    roadNamesTraversed: streetGraphRoute.roadNamesTraversed,
    roadClassesTraversed: streetGraphRoute.roadClassesTraversed,
    attachmentMethod: streetGraphRoute.routeStatus === "VALID" ? "STREET_GRAPH_ATTACHMENT" : "ROUTE_NOT_FOUND",
    missingRoutingDependencies: streetGraphRoute.routeStatus === "VALID" ? [] : [streetGraphRoute.failureReason ?? "NO_REACHABLE_PATH"],
    routeAccessPoints: {
      streetGraphStartNode: streetGraphRoute.startNode?.coordinate,
      streetGraphEndNode: streetGraphRoute.endNode?.coordinate,
    },
    geometry: streetGraphRoute.routeStatus === "VALID" ? streetGraphRoute.geometry : [],
  };
}
