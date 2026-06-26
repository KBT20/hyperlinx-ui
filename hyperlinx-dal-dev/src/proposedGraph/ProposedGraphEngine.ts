import type { DesignLaunchSession } from "../design/DesignLaunchSession";
import { generateFixtureStationedCorridor, generateStationedCorridor } from "../corridor/CorridorGenerationEngine";
import type { CorridorInventoryObject, CorridorInventoryObjectType } from "../corridor/CorridorInventoryObject";
import type { CorridorSegment } from "../corridor/CorridorSegment";
import type { StationedCorridor } from "../corridor/StationedCorridor";
import { resolveDesignDoctrineForSession } from "../designDoctrine/DesignDoctrineEngine";
import { generateRouteCandidate } from "../routeGeneration/RouteGenerationEngine";
import type { RouteCandidate, RouteCandidateNode } from "../routeGeneration/RouteCandidate";
import type { RouteConstraintType } from "../routeGeneration/RouteConstraint";
import type { RouteStatistics } from "../routeGeneration/RouteStatistics";
import { createProposedGraphDiagnostic } from "./ProposedGraphDiagnostics";
import type { ProposedGraph } from "./ProposedGraph";
import type { ProposedGraphCrossing, ProposedGraphEdge } from "./ProposedGraphEdge";
import type { ProposedGraphNode, ProposedGraphNodeType } from "./ProposedGraphNode";
import type { ProposedGraphStatistics } from "./ProposedGraphStatistics";

function graphNodeType(node: RouteCandidateNode): ProposedGraphNodeType {
  if (node.nodeType === "A_SITE") return "A_SITE";
  if (node.nodeType === "Z_SITE") return "Z_SITE";
  if (node.nodeType === "VAULT") return "VAULT";
  if (node.nodeType === "REGENERATION_SITE") return "REGENERATION_SITE";
  if (node.nodeType === "CABINET") return "CABINET";
  if (node.nodeType === "INTERMEDIATE_SITE") return "INTERMEDIATE_SITE";
  return "SPLICE";
}

function graphNode(node: RouteCandidateNode, graphId: string): ProposedGraphNode {
  return {
    id: `${graphId}:${node.nodeId}`,
    type: graphNodeType(node),
    name: node.name,
    lng: node.coordinate[0],
    lat: node.coordinate[1],
    stationLabel: node.stationLabel,
    estimatedCost: node.estimatedCost,
    estimatedConstructionType: "BURIED",
    status: "PROPOSED",
    comments: ["Estimated route candidate object. Route Engineering validation required."],
    confidence: node.confidence,
    readiness: "READY_FOR_PROPOSAL",
    metadata: {
      ...node.metadata,
      sourceRouteNodeId: node.nodeId,
      estimatedOnly: true,
    },
    readOnly: true,
  };
}

function crossingType(type: RouteConstraintType): ProposedGraphCrossing["crossingType"] {
  if (type === "RAILROAD_CROSSING") return "RAIL";
  if (type === "RIVER_CREEK_CROSSING" || type === "LARGE_WATER_BODY" || type === "BRIDGE_CROSSING") return "WATER";
  if (type === "UTILITY_CORRIDOR") return "UTILITY";
  if (type === "UNKNOWN_CONSTRAINT") return "UNKNOWN";
  return "ROAD";
}

function graphStatistics(routeCandidate: RouteCandidate): ProposedGraphStatistics {
  return {
    totalMiles: routeCandidate.statistics.totalRouteLengthMiles,
    fiberFeet: routeCandidate.statistics.fiberFeet,
    ductFeet: routeCandidate.statistics.ductFeet,
    estimatedStationCount: routeCandidate.statistics.estimatedStationCount,
    estimatedVaults: routeCandidate.statistics.estimatedVaultCount,
    estimatedRegenSites: routeCandidate.statistics.estimatedRegenCount,
    estimatedCabinets: routeCandidate.nodes.filter((node) => node.nodeType === "CABINET").length,
    estimatedCrossings:
      routeCandidate.statistics.estimatedHighwayCrossings +
      routeCandidate.statistics.estimatedRailroadCrossings +
      routeCandidate.statistics.estimatedWaterCrossings,
    estimatedHighwayCrossings: routeCandidate.statistics.estimatedHighwayCrossings,
    estimatedRailroadCrossings: routeCandidate.statistics.estimatedRailroadCrossings,
    estimatedWaterCrossings: routeCandidate.statistics.estimatedWaterCrossings,
    estimatedUrbanSegments: routeCandidate.statistics.estimatedUrbanSegments,
    estimatedRuralSegments: routeCandidate.statistics.estimatedRuralSegments,
    estimatedConstructionCost: routeCandidate.statistics.estimatedConstructionCost,
    confidenceScore: routeCandidate.statistics.confidenceScore,
    routeCandidateDerived: true,
    estimatedOnly: true,
  };
}

function graphStatisticsFromCorridor(stationedCorridor: StationedCorridor): ProposedGraphStatistics {
  const takeoff = stationedCorridor.takeoff;
  return {
    totalMiles: takeoff.routeMiles,
    fiberFeet: takeoff.fiberFeet,
    ductFeet: takeoff.ductFeet,
    estimatedStationCount: stationedCorridor.stations.length,
    estimatedVaults: takeoff.vaultCount,
    estimatedRegenSites: takeoff.regenSiteCount,
    estimatedCabinets: 0,
    estimatedCrossings:
      takeoff.roadCrossingCount +
      takeoff.railCrossingCount +
      takeoff.waterCrossingCount +
      takeoff.bridgeCrossingCount +
      takeoff.unknownConstraintCount,
    estimatedHighwayCrossings: takeoff.roadCrossingCount,
    estimatedRailroadCrossings: takeoff.railCrossingCount,
    estimatedWaterCrossings: takeoff.waterCrossingCount + takeoff.bridgeCrossingCount,
    estimatedUrbanSegments: 0,
    estimatedRuralSegments: stationedCorridor.segments.length,
    estimatedConstructionCost: takeoff.estimatedConstructionCost,
    confidenceScore: takeoff.confidence === "HIGH" ? 82 : takeoff.confidence === "MEDIUM" ? 68 : 46,
    routeCandidateDerived: false,
    centerlineRouteDerived: true,
    stationedCorridorDerived: true,
    estimatedOnly: true,
  };
}

function routeStatisticsFromCorridor(stationedCorridor: StationedCorridor, fallback: RouteStatistics): RouteStatistics {
  const takeoff = stationedCorridor.takeoff;
  return {
    ...fallback,
    totalRouteLengthFeet: takeoff.routeFeet,
    totalRouteLengthMiles: takeoff.routeMiles,
    fiberFeet: takeoff.fiberFeet,
    ductFeet: takeoff.ductFeet,
    estimatedStationCount: stationedCorridor.stations.length,
    estimatedVaultCount: takeoff.vaultCount + takeoff.handholeCount,
    estimatedRegenCount: takeoff.regenSiteCount,
    estimatedHighwayCrossings: takeoff.roadCrossingCount,
    estimatedRailroadCrossings: takeoff.railCrossingCount,
    estimatedWaterCrossings: takeoff.waterCrossingCount + takeoff.bridgeCrossingCount,
    estimatedConstructionCost: takeoff.estimatedConstructionCost,
    confidenceScore: takeoff.confidence === "HIGH" ? 82 : takeoff.confidence === "MEDIUM" ? 68 : 46,
    estimatedOnly: true,
  };
}

function graphEdges(routeCandidate: RouteCandidate, graphId: string): ProposedGraphEdge[] {
  return routeCandidate.segments.map((segment) => ({
    id: `${graphId}:${segment.segmentId}`,
    segmentId: segment.segmentId,
    from: `${graphId}:${segment.fromNode}`,
    to: `${graphId}:${segment.toNode}`,
    estimatedDistance: segment.estimatedLength,
    roadName: segment.roadName,
    county: segment.county,
    constructionMethod: segment.constructionMethod,
    estimatedFiberFeet: segment.estimatedFiberFeet,
    estimatedDuctFeet: segment.estimatedDuctFeet,
    estimatedCost: segment.estimatedCost,
    constructionType: "BURIED",
    crossings: segment.constraints.map((constraint) => ({
      crossingId: constraint.constraintId,
      crossingType: crossingType(constraint.constraintType),
      label: constraint.constraintType.replaceAll("_", " "),
      estimatedCost: constraint.estimatedCost,
    })),
    estimatedConstraints: segment.constraints,
    confidence: segment.confidence,
    comments: ["Sales estimate segment generated from deterministic Layer 1 design doctrine."],
    engineeringNotes: segment.engineeringNotes,
    coordinates: segment.geometry,
    metadata: {
      sourceRouteCandidateId: routeCandidate.routeCandidateId,
      sourceSegmentId: segment.segmentId,
      salesEstimate: true,
      engineeringCertificationRequired: true,
    },
    readOnly: true,
  }));
}

function objectNodeType(object: CorridorInventoryObject): ProposedGraphNodeType {
  if (object.objectType === "REGEN_SITE") return "REGENERATION_SITE";
  if (object.objectType === "VAULT" || object.objectType === "HANDHOLE") return "VAULT";
  if (object.objectType === "SPLICE_POINT") return "SPLICE";
  return "CABINET";
}

function objectDisplayName(object: CorridorInventoryObject) {
  if (object.objectType === "REGEN_SITE") return `Regen ${object.stationLabel}`;
  if (object.objectType === "VAULT") return `Vault ${object.stationLabel}`;
  if (object.objectType === "HANDHOLE") return `Handhole ${object.stationLabel}`;
  if (object.objectType === "SPLICE_POINT") return `Splice ${object.stationLabel}`;
  return object.objectType.replaceAll("_", " ");
}

function proposedGraphNodesFromCorridor(stationedCorridor: StationedCorridor, graphId: string): ProposedGraphNode[] {
  const route = stationedCorridor.centerlineRoute;
  const endpointNodes: ProposedGraphNode[] = [route.aSite, route.zSite]
    .filter((site) => site.coordinate)
    .map((site, index) => ({
      id: `${graphId}:${site.role}`,
      type: site.role === "A_SITE" ? "A_SITE" : "Z_SITE",
      name: site.facilityName,
      lng: site.coordinate?.[0] ?? 0,
      lat: site.coordinate?.[1] ?? 0,
      stationLabel: index === 0 ? "A Site" : "Z Site",
      estimatedCost: 0,
      estimatedConstructionType: "BURIED",
      status: "PROPOSED",
      comments: ["Customer supplied endpoint. Engineering validation required."],
      confidence: route.confidence === "HIGH" ? 82 : route.confidence === "MEDIUM" ? 68 : 46,
      readiness: stationedCorridor.status === "BLOCKED" ? "BLOCKED" : "READY_FOR_PROPOSAL",
      metadata: { source: "CENTERLINE_ROUTE", centerlineRouteId: route.centerlineRouteId, siteId: site.siteId },
      readOnly: true,
    }));
  const majorObjects = stationedCorridor.inventoryObjects.filter((object) => ["VAULT", "HANDHOLE", "REGEN_SITE", "SPLICE_POINT"].includes(object.objectType));
  const objectNodes = majorObjects.map((object) => ({
    id: `${graphId}:${object.objectId}`,
    type: objectNodeType(object),
    name: objectDisplayName(object),
    lng: object.lng,
    lat: object.lat,
    stationLabel: object.stationLabel,
    estimatedCost: object.estimatedCost,
    estimatedConstructionType: "BURIED" as const,
    status: "PROPOSED" as const,
    comments: ["Proposed corridor inventory object. Route Engineering verification required."],
    confidence: 64,
    readiness: "READY_FOR_PROPOSAL" as const,
    metadata: {
      source: "STATIONED_CORRIDOR_OBJECT",
      objectId: object.objectId,
      objectType: object.objectType,
      engineeringStatus: object.engineeringStatus,
    },
    readOnly: true as const,
  }));
  return [...endpointNodes, ...objectNodes];
}

function crossingTypeFromObject(type: CorridorInventoryObjectType): ProposedGraphCrossing["crossingType"] {
  if (type === "RAIL_CROSSING") return "RAIL";
  if (type === "WATER_CROSSING" || type === "BRIDGE_CROSSING") return "WATER";
  if (type === "UNKNOWN_CONSTRAINT") return "UNKNOWN";
  return "ROAD";
}

function graphEdgeFromCorridorSegment(segment: CorridorSegment, stationedCorridor: StationedCorridor, graphId: string): ProposedGraphEdge {
  const crossingObjects = stationedCorridor.inventoryObjects.filter((object) => segment.constraintIds.includes(object.objectId));
  return {
    id: `${graphId}:${segment.segmentId}`,
    segmentId: segment.segmentId,
    from: segment.fromStationId,
    to: segment.toStationId,
    estimatedDistance: segment.lengthFeet,
    constructionMethod: segment.constructionMethod,
    estimatedFiberFeet: stationedCorridor.inventoryObjects
      .filter((object) => object.objectType === "FIBER" && object.metadata.segmentId === segment.segmentId)
      .reduce((sum, object) => sum + object.quantity, 0),
    estimatedDuctFeet: stationedCorridor.inventoryObjects
      .filter((object) => object.objectType === "DUCT" && object.metadata.segmentId === segment.segmentId)
      .reduce((sum, object) => sum + object.quantity, 0),
    estimatedCost: segment.estimatedCost,
    constructionType: "BURIED",
    crossings: crossingObjects.map((object) => ({
      crossingId: object.objectId,
      crossingType: crossingTypeFromObject(object.objectType),
      label: object.objectType.replaceAll("_", " "),
      estimatedCost: object.estimatedCost,
    })),
    confidence: segment.confidence,
    comments: ["Segment generated from the stationed centerline design candidate."],
    engineeringNotes: ["PENDING_VERIFICATION. Route Engineering must certify final alignment and quantities."],
    coordinates: segment.geometry,
    metadata: {
      source: "STATIONED_CORRIDOR_SEGMENT",
      centerlineRouteId: stationedCorridor.centerlineRouteId,
      stationedCorridorId: stationedCorridor.stationedCorridorId,
      engineeringStatus: segment.engineeringStatus,
      salesEstimate: true,
    },
    readOnly: true,
  };
}

function graphEdgesFromCorridor(stationedCorridor: StationedCorridor, graphId: string): ProposedGraphEdge[] {
  return stationedCorridor.segments.map((segment) => graphEdgeFromCorridorSegment(segment, stationedCorridor, graphId));
}

function buildProposedGraph(session: DesignLaunchSession, stationedCorridor: StationedCorridor): ProposedGraph {
  const graphId = `PG-${session.launchId}`;
  const appliedDoctrine = resolveDesignDoctrineForSession(session);
  const routeCandidate = generateRouteCandidate(session);
  const nodes = proposedGraphNodesFromCorridor(stationedCorridor, graphId);
  const edges = graphEdgesFromCorridor(stationedCorridor, graphId);
  const statistics = graphStatisticsFromCorridor(stationedCorridor);
  const routeStatistics = routeStatisticsFromCorridor(stationedCorridor, routeCandidate.statistics);
  const readiness = nodes.length >= 2 && edges.length >= 1 ? "READY_FOR_PROPOSAL" : "BLOCKED";
  const diagnostics = [
    createProposedGraphDiagnostic("PROPOSED_GRAPH_CREATED", "INFO", "Canonical ProposedGraph created from stationed centerline corridor.", graphId, {
      launchId: session.launchId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    }),
    createProposedGraphDiagnostic("DESIGN_DOCTRINE_ATTACHED", "INFO", "Layer 1 design doctrine attached to ProposedGraph.", graphId, {
      designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
      networkClass: appliedDoctrine.networkClass,
      topology: appliedDoctrine.topology,
      protectionClass: appliedDoctrine.protection,
    }),
    createProposedGraphDiagnostic("ROUTE_CANDIDATE_ATTACHED", "INFO", "RouteCandidate attached to ProposedGraph for sales estimate review.", graphId, {
      routeCandidateId: routeCandidate.routeCandidateId,
      routeFeet: routeCandidate.statistics.totalRouteLengthFeet,
      constraintCount: routeCandidate.constraints.length,
    }),
    createProposedGraphDiagnostic("CENTERLINE_ROUTE_ATTACHED", stationedCorridor.status === "BLOCKED" ? "ERROR" : "INFO", "CenterlineRoute and StationedCorridor attached as the route and takeoff authority for proposal review.", graphId, {
      centerlineRouteId: stationedCorridor.centerlineRouteId,
      stationedCorridorId: stationedCorridor.stationedCorridorId,
      takeoffId: stationedCorridor.takeoff.takeoffId,
      status: stationedCorridor.status,
      source: stationedCorridor.centerlineRoute.source,
    }),
    createProposedGraphDiagnostic(readiness === "READY_FOR_PROPOSAL" ? "PROPOSED_GRAPH_READY_FOR_PROPOSAL" : "PROPOSED_GRAPH_BLOCKED", readiness === "READY_FOR_PROPOSAL" ? "INFO" : "ERROR", readiness === "READY_FOR_PROPOSAL" ? "ProposedGraph is ready for Proposal workspace." : "ProposedGraph is blocked.", graphId),
  ];

  return {
    proposedGraphId: graphId,
    proposalId: `PROP-${graphId}`,
    customerId: session.customerId,
    customerName: session.customerName,
    opportunityId: session.opportunityId,
    opportunityName: session.opportunityName,
    routeRequestId: session.launchId.replace(/^DESIGN-LAUNCH-DESIGN-/, ""),
    sourceDesignLaunchId: session.launchId,
    designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
    routeCandidateId: routeCandidate.routeCandidateId,
    centerlineRouteId: stationedCorridor.centerlineRouteId,
    stationedCorridorId: stationedCorridor.stationedCorridorId,
    takeoffId: stationedCorridor.takeoff.takeoffId,
    networkType: session.networkIntent.networkType ?? "METRO",
    networkClass: appliedDoctrine.networkClass,
    topology: appliedDoctrine.topology,
    protection: session.protection ?? "LINEAR",
    protectionClass: appliedDoctrine.protection,
    primaryProduct: session.primaryProduct ?? "FIBER",
    nodes,
    edges,
    statistics,
    routeStatistics,
    routeCandidate,
    centerlineRoute: stationedCorridor.centerlineRoute,
    stationedCorridor,
    takeoff: stationedCorridor.takeoff,
    engineeringConstraintCandidates: routeCandidate.engineeringConstraintCandidates,
    readiness,
    diagnostics,
    generatedAt: new Date().toISOString(),
    metadata: {
      source: "STATIONED_CORRIDOR",
      routeCandidateId: routeCandidate.routeCandidateId,
      centerlineRouteId: stationedCorridor.centerlineRouteId,
      stationedCorridorId: stationedCorridor.stationedCorridorId,
      takeoffId: stationedCorridor.takeoff.takeoffId,
      salesEstimate: true,
      designOwnsSynthesis: true,
      designDoctrine: {
        designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
        networkClass: appliedDoctrine.networkClass,
        topology: appliedDoctrine.topology,
        protection: appliedDoctrine.protection,
        constructionProfileId: appliedDoctrine.constructionProfileId,
        materialProfileId: appliedDoctrine.materialProfileId,
        facilityProfileId: appliedDoctrine.facilityProfileId,
        msaClassification: appliedDoctrine.msaClassification,
      },
    },
    readOnly: true,
    noEngineering: true,
    salesEstimate: true,
    engineeringCertificationRequired: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noPersistence: true,
  };
}

export function createProposedGraphFromStationedCorridor(session: DesignLaunchSession, stationedCorridor: StationedCorridor): ProposedGraph {
  return buildProposedGraph(session, stationedCorridor);
}

export function createProposedGraph(session: DesignLaunchSession): ProposedGraph {
  return buildProposedGraph(session, generateFixtureStationedCorridor(session));
}

export async function createProposedGraphWithCenterline(session: DesignLaunchSession): Promise<ProposedGraph> {
  return buildProposedGraph(session, await generateStationedCorridor(session));
}

export function approveProposedGraphForEngineering(graph: ProposedGraph): ProposedGraph {
  return {
    ...graph,
    readiness: "READY_FOR_ENGINEERING",
    nodes: graph.nodes.map((node) => ({ ...node, status: "CUSTOMER_APPROVED", readiness: "READY_FOR_ENGINEERING" })),
    diagnostics: [
      ...graph.diagnostics,
      createProposedGraphDiagnostic("PROPOSED_GRAPH_READY_FOR_ENGINEERING", "INFO", "Customer approved ProposedGraph for Route Engineering handoff eligibility.", graph.proposedGraphId),
    ],
  };
}
