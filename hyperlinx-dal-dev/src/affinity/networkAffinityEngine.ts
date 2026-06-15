import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { NetworkAffinity } from "../types/networkAffinity";
import type { CorridorAnalysis } from "../types/corridor";
import { BURIED_CONSTRUCTION_ASSUMPTIONS, DEFAULT_CONSTRUCTION_TYPE } from "../engineering/constructionModel";
import { certifySiteDecision } from "../engineering/certificationEngine";
import { estimateRevenue } from "../prism/revenueEstimator";
import { compareAttachmentStrategies } from "./attachmentStrategyEngine";
import { clamp } from "./geo";
import { findNearestNode } from "./nearestNodeEngine";
import { findNearestRoute } from "./nearestRouteEngine";
import { findNearestStation } from "./nearestStationEngine";

function candidateType(site: CandidateSite) {
  const text = `${site.facilityType ?? ""} ${site.marketSegment ?? ""} ${site.companyName}`.toLowerCase();
  if (/data center|hyperscaler/.test(text)) return "data_center";
  if (/tower|wireless|public safety|dispatch/.test(text)) return "tower";
  if (/carrier|telecom/.test(text)) return "carrier";
  return "enterprise";
}

export function analyzeNetworkAffinity(graph: InventoryGraph, site: CandidateSite): NetworkAffinity | null {
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) return null;
  const target: DALCoordinate = [Number(site.longitude), Number(site.latitude)];
  const nearestRoute = findNearestRoute(graph, target);
  const nearestNode = findNearestNode(graph, target);
  const nearestStation = findNearestStation(graph, target);
  const revenue = estimateRevenue({
    id: site.candidateId,
    name: site.companyName,
    candidateType: candidateType(site),
    latitude: Number(site.latitude),
    longitude: Number(site.longitude),
    tags: [site.facilityType ?? "", site.marketSegment ?? ""].filter(Boolean),
  });
  const strategies = compareAttachmentStrategies({ graph, site, nearestRoute, nearestNode, nearestStation, revenue });
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
