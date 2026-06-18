import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { AttachmentType, BuildPath, StreetRoutingMetadata } from "../types/networkAffinity";
import type { StreetCenterline } from "../street/streetTypes";
import { DEFAULT_CONSTRUCTION_TYPE, estimateBuriedConstructionCost, BURIED_CONSTRUCTION_ASSUMPTIONS } from "../engineering/constructionModel";
import { routeInventoryExtensionViaStreetGraph } from "../routing/StreetGraphRouter";
import { routeInventoryExtensionViaOsrm } from "../routing/OsrmLateralRouter";

export function buildPathForAttachment(args: {
  graph?: InventoryGraph;
  site: CandidateSite;
  attachmentCoordinate?: DALCoordinate;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType: AttachmentType;
  streetCenterlines?: StreetCenterline[];
  streetRoutingMetadata?: StreetRoutingMetadata;
}): BuildPath {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  const attach = args.attachmentCoordinate ?? siteCoord;
  const existingInventoryLengthFeet = Math.round(Number(args.graph?.routes.find((route) => route.routeId === args.routeId)?.lengthFeet ?? 0));
  const streetGraphRoute = routeInventoryExtensionViaStreetGraph({
    candidateCoordinate: siteCoord,
    attachmentCoordinate: attach,
    streetCenterlines: args.streetCenterlines,
    ...args.streetRoutingMetadata,
    existingInventoryLengthFeet,
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
    routingClassification: "OSM_LATERAL_STREET_GRAPH_ASTAR",
    pathConfidence: streetGraphRoute.routeStatus === "VALID" ? "HIGH" : "LOW",
    routeStatus: streetGraphRoute.routeStatus,
    routeFailureReason: streetGraphRoute.failureReason,
    routingAudit: streetGraphRoute.audit,
    streetGraphRoute,
    streetRouting: args.streetRoutingMetadata,
    streetLayerLoaded: args.streetRoutingMetadata?.streetLayerLoaded,
    streetFeatureCount: args.streetRoutingMetadata?.streetFeatureCount,
    streetLayerAuthority: args.streetRoutingMetadata?.streetLayerAuthority,
    streetLayerCertificationUse: args.streetRoutingMetadata?.streetLayerCertificationUse,
    streetLayerBboxCoverage: args.streetRoutingMetadata?.streetLayerBboxCoverage,
    routingBBox: args.streetRoutingMetadata?.routingBBox,
    routingBufferMiles: args.streetRoutingMetadata?.routingBufferMiles,
    routingScope: "NEW_LATERAL_ONLY",
    existingInventoryRoutePreserved: true,
    existingInventoryLengthFeet,
    newLateralLengthFeet: routeableFeet,
    osmRouteFound: streetGraphRoute.routeStatus === "VALID",
    osmSnapDistanceFeet: streetGraphRoute.audit.osmSnapDistanceFeet,
    candidateSnapDistanceFeet: streetGraphRoute.audit.candidateSnapDistanceFeet,
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

export async function buildOsrmPathForAttachment(args: {
  graph?: InventoryGraph;
  site: CandidateSite;
  attachmentCoordinate?: DALCoordinate;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType: AttachmentType;
}): Promise<BuildPath> {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  const attach = args.attachmentCoordinate ?? siteCoord;
  const existingInventoryLengthFeet = Math.round(Number(args.graph?.routes.find((route) => route.routeId === args.routeId)?.lengthFeet ?? 0));
  const osrmRoute = await routeInventoryExtensionViaOsrm({
    candidateCoordinate: siteCoord,
    attachmentCoordinate: attach,
    existingInventoryLengthFeet,
  });
  const routeableFeet = osrmRoute.routeStatus === "VALID" ? osrmRoute.routeFeet : 0;
  const estimatedUndergroundFeet = Math.round(routeableFeet);
  const estimatedAerialFeet = 0;
  const estimatedCrossings = osrmRoute.routeStatus === "VALID" ? Math.max(0, Math.round(routeableFeet / 2200)) : 0;
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
    turnCount: Math.max(0, osrmRoute.geometry.length - 2),
    segmentCount: osrmRoute.roadSegmentCount,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    estimatedCost: buriedCost.totalCost,
    riskScore: osrmRoute.routeStatus === "VALID" ? undefined : 100,
    constructabilityScore: osrmRoute.routeStatus === "VALID" ? undefined : 0,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
    routingMode: "OSRM_ROUTE",
    routingClassification: "OSRM_PUBLIC_DRIVING_ROUTE_NEW_LATERAL",
    pathConfidence: osrmRoute.routeStatus === "VALID" ? "HIGH" : "LOW",
    routeStatus: osrmRoute.routeStatus,
    routeFailureReason: osrmRoute.failureReason,
    routingAudit: osrmRoute.audit,
    streetGraphRoute: osrmRoute,
    streetRouting: {
      streetLayerLoaded: true,
      streetFeatureCount: osrmRoute.audit.streetFeatureCount,
      streetLayerAuthority: "OSRM_PUBLIC_API",
      streetLayerCertificationUse: "ROUTING_REFERENCE",
      streetLayerBboxCoverage: true,
    },
    streetLayerLoaded: true,
    streetFeatureCount: osrmRoute.audit.streetFeatureCount,
    streetLayerAuthority: "OSRM_PUBLIC_API",
    streetLayerCertificationUse: "ROUTING_REFERENCE",
    streetLayerBboxCoverage: true,
    routingScope: "NEW_LATERAL_ONLY",
    existingInventoryRoutePreserved: true,
    existingInventoryLengthFeet,
    newLateralLengthFeet: routeableFeet,
    osmRouteFound: osrmRoute.routeStatus === "VALID",
    osmSnapDistanceFeet: osrmRoute.audit.osmSnapDistanceFeet,
    candidateSnapDistanceFeet: osrmRoute.audit.candidateSnapDistanceFeet,
    roadSegmentCount: osrmRoute.roadSegmentCount,
    roadNamesTraversed: osrmRoute.roadNamesTraversed,
    roadClassesTraversed: osrmRoute.roadClassesTraversed,
    attachmentMethod: osrmRoute.routeStatus === "VALID" ? "OSRM_ROUTE_ATTACHMENT" : "OSRM_ROUTE_NOT_FOUND",
    missingRoutingDependencies: osrmRoute.routeStatus === "VALID" ? [] : [osrmRoute.failureReason ?? "OSRM_ROUTE_NOT_FOUND"],
    routeAccessPoints: {
      streetGraphStartNode: osrmRoute.startNode?.coordinate,
      streetGraphEndNode: osrmRoute.endNode?.coordinate,
    },
    geometry: osrmRoute.routeStatus === "VALID" ? osrmRoute.geometry : [],
  };
}
