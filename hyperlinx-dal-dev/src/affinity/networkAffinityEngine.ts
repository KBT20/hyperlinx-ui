import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { NetworkAffinity } from "../types/networkAffinity";
import type { CorridorAnalysis } from "../types/corridor";
import { BURIED_CONSTRUCTION_ASSUMPTIONS, DEFAULT_CONSTRUCTION_TYPE } from "../engineering/constructionModel";
import { certifySiteDecision } from "../engineering/certificationEngine";
import { estimateRevenue } from "../prism/revenueEstimator";
import {
  getConstraintRegistryAnalysisContext,
  streetCenterlinesFromConstraintFeatures,
  type ConstraintBounds,
  type ConstraintRegistryAnalysisContext,
} from "../reference/ConstraintGeometryRegistry";
import { compareAttachmentStrategies } from "./attachmentStrategyEngine";
import { clamp } from "./geo";
import { findNearestNode } from "./nearestNodeEngine";
import { findNearestRoute } from "./nearestRouteEngine";
import { findNearestStation } from "./nearestStationEngine";

const DEFAULT_ROUTING_BUFFER_MILES = 2;
const EXPANDED_ROUTING_BUFFER_MILES = 4;
const MIN_ROUTING_BUFFER_MILES = 0.5;

function candidateType(site: CandidateSite) {
  const text = `${site.facilityType ?? ""} ${site.marketSegment ?? ""} ${site.companyName}`.toLowerCase();
  if (/data center|hyperscaler/.test(text)) return "data_center";
  if (/tower|wireless|public safety|dispatch/.test(text)) return "tower";
  if (/carrier|telecom/.test(text)) return "carrier";
  return "enterprise";
}

function routingBufferDegrees(centerLat: number, bufferMiles: number) {
  const clamped = Math.max(MIN_ROUTING_BUFFER_MILES, bufferMiles);
  const latDegrees = clamped / 69;
  const lonDegrees = clamped / Math.max(20, 69 * Math.cos((centerLat * Math.PI) / 180));
  return { latDegrees, lonDegrees };
}

function paddedStreetLookupBounds(a: DALCoordinate, b: DALCoordinate, bufferMiles = DEFAULT_ROUTING_BUFFER_MILES): ConstraintBounds {
  const centerLat = (a[1] + b[1]) / 2;
  const { latDegrees, lonDegrees } = routingBufferDegrees(centerLat, bufferMiles);
  return [
    Math.min(a[0], b[0]) - lonDegrees,
    Math.min(a[1], b[1]) - latDegrees,
    Math.max(a[0], b[0]) + lonDegrees,
    Math.max(a[1], b[1]) + latDegrees,
  ];
}

function boundsContainsPoint(bounds: ConstraintBounds | undefined, coordinate: DALCoordinate) {
  return Boolean(bounds && coordinate[0] >= bounds[0] && coordinate[0] <= bounds[2] && coordinate[1] >= bounds[1] && coordinate[1] <= bounds[3]);
}

function streetRoutingLookup(target: DALCoordinate, attachmentCoordinate: DALCoordinate | undefined, bufferMiles: number) {
  const routingBBox = attachmentCoordinate ? paddedStreetLookupBounds(target, attachmentCoordinate, bufferMiles) : undefined;
  const context: ConstraintRegistryAnalysisContext = getConstraintRegistryAnalysisContext({
    bbox: routingBBox,
    requiredLayers: ["STREETS"],
  });
  const streetLayers = context.constraintRegistrySnapshot.layers.filter((layer) => layer.layerType === "STREETS" && layer.status === "LOADED");
  const streetFeatures = context.constraintRegistryFeatures.filter((feature) => feature.layerType === "STREETS");
  const primaryStreetLayer = streetLayers[0];
  return {
    streetCenterlines: streetCenterlinesFromConstraintFeatures(streetFeatures),
    metadata: {
      streetLayerLoaded: streetLayers.length > 0,
      streetFeatureCount: streetFeatures.length,
      streetLayerAuthority: primaryStreetLayer?.authority,
      streetLayerCertificationUse: primaryStreetLayer?.certificationUse,
      streetLayerBboxCoverage: attachmentCoordinate
        ? streetLayers.some((layer) => boundsContainsPoint(layer.coverage?.bbox, target) && boundsContainsPoint(layer.coverage?.bbox, attachmentCoordinate))
        : false,
      routingBBox,
      routingBufferMiles: bufferMiles,
    },
  };
}

export function analyzeNetworkAffinity(graph: InventoryGraph, site: CandidateSite): NetworkAffinity | null {
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) return null;
  const target: DALCoordinate = [Number(site.longitude), Number(site.latitude)];
  const nearestRoute = findNearestRoute(graph, target);
  const nearestNode = findNearestNode(graph, target);
  const nearestStation = findNearestStation(graph, target);
  const attachmentCoordinate = nearestRoute.coordinate ?? nearestStation.coordinate ?? nearestNode.coordinate;
  const streetLookup = streetRoutingLookup(target, attachmentCoordinate, DEFAULT_ROUTING_BUFFER_MILES);
  const revenue = estimateRevenue({
    id: site.candidateId,
    name: site.companyName,
    candidateType: candidateType(site),
    latitude: Number(site.latitude),
    longitude: Number(site.longitude),
    tags: [site.facilityType ?? "", site.marketSegment ?? ""].filter(Boolean),
  });
  let strategies = compareAttachmentStrategies({
    graph,
    site,
    nearestRoute,
    nearestNode,
    nearestStation,
    revenue,
    streetCenterlines: streetLookup.streetCenterlines,
    streetRoutingMetadata: streetLookup.metadata,
  });
  if (!strategies.some((strategy) => strategy.buildPath.routeStatus === "VALID" && strategy.buildPath.geometry.length >= 2)) {
    const expandedLookup = streetRoutingLookup(target, attachmentCoordinate, EXPANDED_ROUTING_BUFFER_MILES);
    const expandedStrategies = compareAttachmentStrategies({
      graph,
      site,
      nearestRoute,
      nearestNode,
      nearestStation,
      revenue,
      streetCenterlines: expandedLookup.streetCenterlines,
      streetRoutingMetadata: expandedLookup.metadata,
    });
    if (expandedStrategies.some((strategy) => strategy.buildPath.routeStatus === "VALID" && strategy.buildPath.geometry.length >= 2)) {
      strategies = expandedStrategies;
    }
  }
  const preferredStrategy = strategies[0];
  if (!preferredStrategy) return null;
  const capacityScore = preferredStrategy.capacity.projectedUtilization === "LOW" ? 100 : preferredStrategy.capacity.projectedUtilization === "MEDIUM" ? 76 : preferredStrategy.capacity.projectedUtilization === "HIGH" ? 48 : 20;
  const distanceScore = clamp(100 - Math.min(preferredStrategy.buildFeet / 150, 85));
  const riskScore = preferredStrategy.riskScore;
  const riskScoreInverted = Math.max(0, 100 - riskScore);
  const constructabilityAssessment = preferredStrategy.constructabilityAssessment ?? preferredStrategy.buildPath.constructabilityAssessment;
  const permitCount = constructabilityAssessment?.permitting.authorities.length ?? 0;
  const certification = certifySiteDecision({
    site,
    graph,
    buildPath: preferredStrategy.buildPath,
    routeId: preferredStrategy.buildPath.routeId ?? preferredStrategy.routeId,
    nodeId: preferredStrategy.buildPath.nodeId ?? preferredStrategy.nodeId,
    stationId: preferredStrategy.buildPath.stationId ?? preferredStrategy.stationId,
    permitRisk: constructabilityAssessment ? 100 - constructabilityAssessment.permitScore : undefined,
    buildRisk: preferredStrategy.riskScore,
    permitCount,
  });
  const certifiedBuildPath = {
    ...preferredStrategy.buildPath,
    routeId: certification.attachmentPoint.routeId || preferredStrategy.buildPath.routeId,
    nodeId: certification.attachmentPoint.nodeId || preferredStrategy.buildPath.nodeId,
    stationId: certification.attachmentPoint.stationId || preferredStrategy.buildPath.stationId,
    buildFeet: certification.lateralPath.buildFeet,
    buildMiles: certification.lateralPath.buildMiles,
    segmentCount: certification.lateralPath.segmentCount,
    estimatedCrossings: certification.lateralPath.crossings,
    turnCount: certification.lateralPath.turns,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
    attachmentCertification: certification.attachmentPoint,
    lateralCertification: certification.lateralPath,
    serviceabilityAssessment: certification.serviceabilityAssessment,
    routingAudit: certification.lateralPath.routingAudit,
    streetGraphRoute: certification.lateralPath.streetGraphRoute,
    routingScope: certification.lateralPath.routingScope,
    existingInventoryRoutePreserved: certification.lateralPath.existingInventoryRoutePreserved,
    existingInventoryLengthFeet: certification.lateralPath.existingInventoryLengthFeet,
    newLateralLengthFeet: certification.lateralPath.newLateralLengthFeet,
    attachmentId: certification.attachmentPoint.attachmentId,
    osmRouteFound: certification.lateralPath.osmRouteFound,
    osmSnapDistanceFeet: certification.lateralPath.osmSnapDistanceFeet,
    candidateSnapDistanceFeet: certification.lateralPath.candidateSnapDistanceFeet,
    geometry: certification.lateralPath.geometry,
  };
  const certifiedPreferredStrategy = {
    ...preferredStrategy,
    routeId: certifiedBuildPath.routeId,
    nodeId: certifiedBuildPath.nodeId,
    stationId: certifiedBuildPath.stationId,
    buildFeet: certifiedBuildPath.buildFeet,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    buildPath: certifiedBuildPath,
    attachmentCertification: certification.attachmentPoint,
    lateralCertification: certification.lateralPath,
    serviceabilityAssessment: certification.serviceabilityAssessment,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
  };
  const constructabilityScore = constructabilityAssessment?.constructabilityScore ?? preferredStrategy.constructabilityScore ?? preferredStrategy.buildPath.constructabilityScore ?? 50;
  const affinityScore = Math.round(
    preferredStrategy.compositeScore * 0.4 +
      constructabilityScore * 0.18 +
      distanceScore * 0.14 +
      capacityScore * 0.1 +
      riskScoreInverted * 0.1 +
      (revenue.estimatedTCV / 10000) * 0.08
  );
  const corridorPaths = strategies.map((strategy) => strategy.buildPath.corridorPath).filter(Boolean);
  const corridorAnalysis: CorridorAnalysis | undefined = certifiedBuildPath.corridorPath
    ? {
        candidateSiteId: site.candidateId,
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        paths: corridorPaths as NonNullable<typeof preferredStrategy.buildPath.corridorPath>[],
        bestPath: certifiedBuildPath.corridorPath,
        risk: certifiedBuildPath.corridorPath.risk,
        cost: certifiedBuildPath.corridorPath.cost,
      }
    : undefined;
  return {
    siteId: site.candidateId,
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    nearestRoute,
    nearestNode,
    nearestStation,
    preferredAttachmentPoint: [certification.attachmentPoint.longitude, certification.attachmentPoint.latitude],
    preferredStrategy: certifiedPreferredStrategy,
    strategies,
    buildPath: certifiedBuildPath,
    capacity: preferredStrategy.capacity,
    networkSegmentUtilized: certifiedBuildPath.routeId ?? certifiedBuildPath.nodeId ?? certifiedBuildPath.stationId,
    estimatedBuildFootage: certifiedBuildPath.buildFeet,
    estimatedLateralFootage: certifiedBuildPath.buildFeet,
    corridorAnalysis,
    corridorPath: preferredStrategy.buildPath.corridorPath,
    constructabilityAssessment,
    constructabilityScore,
    permitScore: constructabilityAssessment?.permitScore ?? preferredStrategy.permitScore,
    parcelScore: constructabilityAssessment?.parcelScore ?? preferredStrategy.parcelScore,
    roadAccessScore: constructabilityAssessment?.roadAccessScore ?? preferredStrategy.roadAccessScore,
    crossingScore: constructabilityAssessment?.crossingScore ?? preferredStrategy.crossingScore,
    estimatedPermitCost: constructabilityAssessment?.estimatedPermitCost ?? preferredStrategy.estimatedPermitCost,
    estimatedCrossingCost: constructabilityAssessment?.estimatedCrossingCost ?? preferredStrategy.estimatedCrossingCost,
    estimatedEnvironmentalCost: constructabilityAssessment?.estimatedEnvironmentalCost ?? preferredStrategy.estimatedEnvironmentalCost,
    estimatedEngineeringCost: constructabilityAssessment?.estimatedEngineeringCost ?? preferredStrategy.estimatedEngineeringCost,
    riskScore,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    estimatedCost: preferredStrategy.estimatedCost,
    estimatedPayback: preferredStrategy.paybackMonths,
    roi: preferredStrategy.roi,
    affinityScore: clamp(affinityScore),
    attachmentCertification: certification.attachmentPoint,
    lateralCertification: certification.lateralPath,
    serviceabilityAssessment: certification.serviceabilityAssessment,
    certificationSnapshot: certification.certificationSnapshot,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
  };
}

export function analyzeNetworkAffinities(graph: InventoryGraph, sites: CandidateSite[]) {
  return sites.map((site) => analyzeNetworkAffinity(graph, site)).filter(Boolean) as NetworkAffinity[];
}
