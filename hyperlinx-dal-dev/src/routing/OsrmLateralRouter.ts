import { haversineFeet } from "../affinity/geo";
import type { DALCoordinate } from "../types/dal";
import type { RoutingAudit, StreetGraphNode, StreetGraphRouteFailureReason, StreetGraphRouteResult } from "./StreetGraphRouter";

const OSRM_BASE_URL = "https://router.project-osrm.org";

type OsrmSnap = {
  coordinate: DALCoordinate;
  distanceFeet: number;
  url: string;
};

function validCoordinate(coordinate: DALCoordinate | undefined): coordinate is DALCoordinate {
  return Boolean(coordinate && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]));
}

function routeLengthFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let index = 1; index < geometry.length; index += 1) feet += haversineFeet(geometry[index - 1], geometry[index]);
  return Math.round(feet);
}

async function snapToOsrmRoad(coordinate: DALCoordinate | undefined): Promise<OsrmSnap | null> {
  if (!validCoordinate(coordinate)) return null;
  const url = `${OSRM_BASE_URL}/nearest/v1/driving/${coordinate[0]},${coordinate[1]}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const location = data?.waypoints?.[0]?.location;
  if (!Array.isArray(location) || !Number.isFinite(location[0]) || !Number.isFinite(location[1])) return null;
  const snapped = [Number(location[0]), Number(location[1])] as DALCoordinate;
  const distanceFeet = Number.isFinite(data?.waypoints?.[0]?.distance) ? Math.round(Number(data.waypoints[0].distance) * 3.28084) : Math.round(haversineFeet(coordinate, snapped));
  return { coordinate: snapped, distanceFeet, url };
}

function failureResult(args: {
  startedAt: number;
  failureReason: StreetGraphRouteFailureReason;
  candidateCoordinate?: DALCoordinate;
  attachmentCoordinate?: DALCoordinate;
  snappedStartCoordinate?: DALCoordinate;
  snappedEndCoordinate?: DALCoordinate;
  distanceToStartNode?: number;
  distanceToEndNode?: number;
  existingInventoryLengthFeet?: number;
  attachmentId?: string;
  routeUrl?: string;
  nearestStartUrl?: string;
  nearestEndUrl?: string;
}): StreetGraphRouteResult {
  const audit: RoutingAudit = {
    routingEngine: "OSRMLateralRouter",
    graphNodes: 0,
    graphEdges: 0,
    streetFeatureCount: 0,
    streetLayerLoaded: true,
    streetLayerAuthority: "OSRM_PUBLIC_API",
    streetLayerCertificationUse: "ROUTING_REFERENCE",
    streetLayerBboxCoverage: true,
    pathFound: false,
    pathNodeCount: 0,
    pathEdgeCount: 0,
    pathSegmentCount: 0,
    totalTraversedLength: 0,
    routingMethod: "OSRM_ROUTE",
    routingExecutionTime: Math.round(performance.now() - args.startedAt),
    fallbackUsed: false,
    routeStatus: "ROUTE_NOT_FOUND",
    failureReason: args.failureReason,
    graphSource: "OSRM_PUBLIC_API",
    routingProvider: "OSRM_PUBLIC_API",
    osmRoutingAllowedScope: "NEW_LATERAL_SEGMENT",
    candidateCoordinate: args.candidateCoordinate,
    attachmentCoordinate: args.attachmentCoordinate,
    snappedStartCoordinate: args.snappedStartCoordinate,
    snappedEndCoordinate: args.snappedEndCoordinate,
    distanceToStartNode: args.distanceToStartNode,
    distanceToEndNode: args.distanceToEndNode,
    routingScope: "NEW_LATERAL_ONLY",
    existingInventoryRoutePreserved: true,
    existingInventoryLengthFeet: args.existingInventoryLengthFeet,
    newLateralLengthFeet: 0,
    attachmentId: args.attachmentId,
    osmRouteFound: false,
    osmSnapDistanceFeet: args.distanceToStartNode,
    candidateSnapDistanceFeet: args.distanceToEndNode,
  };
  console.log({
    routingEngine: audit.routingEngine,
    routingProvider: audit.routingProvider,
    routeStatus: audit.routeStatus,
    failureReason: audit.failureReason,
    fallbackUsed: audit.fallbackUsed,
    nearestStartUrl: args.nearestStartUrl,
    nearestEndUrl: args.nearestEndUrl,
    routeUrl: args.routeUrl,
  });
  return {
    routeStatus: "ROUTE_NOT_FOUND",
    failureReason: args.failureReason,
    geometry: [],
    routeFeet: 0,
    routeMiles: 0,
    streetGraphPath: [],
    pathNodeIds: [],
    pathEdgeIds: [],
    roadSegmentCount: 0,
    roadNamesTraversed: [],
    roadClassesTraversed: [],
    audit,
    graphPreview: { nodes: [], edges: [] },
  };
}

export async function routeInventoryExtensionViaOsrm(args: {
  candidateCoordinate?: DALCoordinate;
  attachmentCoordinate?: DALCoordinate;
  existingInventoryLengthFeet?: number;
  attachmentId?: string;
}): Promise<StreetGraphRouteResult> {
  const startedAt = performance.now();
  if (!validCoordinate(args.candidateCoordinate)) {
    return failureResult({
      startedAt,
      failureReason: "INVALID_CANDIDATE",
      attachmentCoordinate: args.attachmentCoordinate,
      existingInventoryLengthFeet: args.existingInventoryLengthFeet,
      attachmentId: args.attachmentId,
    });
  }
  if (!validCoordinate(args.attachmentCoordinate)) {
    return failureResult({
      startedAt,
      failureReason: "NO_ATTACHMENT_FOUND",
      candidateCoordinate: args.candidateCoordinate,
      existingInventoryLengthFeet: args.existingInventoryLengthFeet,
      attachmentId: args.attachmentId,
    });
  }

  try {
    const startSnap = await snapToOsrmRoad(args.attachmentCoordinate);
    const endSnap = await snapToOsrmRoad(args.candidateCoordinate);
    if (!startSnap || !endSnap) {
      return failureResult({
        startedAt,
        failureReason: "OSRM_SNAP_FAILED",
        candidateCoordinate: args.candidateCoordinate,
        attachmentCoordinate: args.attachmentCoordinate,
        snappedStartCoordinate: startSnap?.coordinate,
        snappedEndCoordinate: endSnap?.coordinate,
        distanceToStartNode: startSnap?.distanceFeet,
        distanceToEndNode: endSnap?.distanceFeet,
        existingInventoryLengthFeet: args.existingInventoryLengthFeet,
        attachmentId: args.attachmentId,
        nearestStartUrl: startSnap?.url,
        nearestEndUrl: endSnap?.url,
      });
    }

    const routeUrl = `${OSRM_BASE_URL}/route/v1/driving/${startSnap.coordinate[0]},${startSnap.coordinate[1]};${endSnap.coordinate[0]},${endSnap.coordinate[1]}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(routeUrl);
    if (!response.ok) {
      return failureResult({
        startedAt,
        failureReason: "OSRM_ROUTE_FAILED",
        candidateCoordinate: args.candidateCoordinate,
        attachmentCoordinate: args.attachmentCoordinate,
        snappedStartCoordinate: startSnap.coordinate,
        snappedEndCoordinate: endSnap.coordinate,
        distanceToStartNode: startSnap.distanceFeet,
        distanceToEndNode: endSnap.distanceFeet,
        existingInventoryLengthFeet: args.existingInventoryLengthFeet,
        attachmentId: args.attachmentId,
        nearestStartUrl: startSnap.url,
        nearestEndUrl: endSnap.url,
        routeUrl,
      });
    }
    const data = await response.json();
    const routeCoordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
      return failureResult({
        startedAt,
        failureReason: "OSRM_ROUTE_NOT_FOUND",
        candidateCoordinate: args.candidateCoordinate,
        attachmentCoordinate: args.attachmentCoordinate,
        snappedStartCoordinate: startSnap.coordinate,
        snappedEndCoordinate: endSnap.coordinate,
        distanceToStartNode: startSnap.distanceFeet,
        distanceToEndNode: endSnap.distanceFeet,
        existingInventoryLengthFeet: args.existingInventoryLengthFeet,
        attachmentId: args.attachmentId,
        nearestStartUrl: startSnap.url,
        nearestEndUrl: endSnap.url,
        routeUrl,
      });
    }

    const osrmGeometry = routeCoordinates
      .map((coordinate: unknown) => (Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]) ? ([Number(coordinate[0]), Number(coordinate[1])] as DALCoordinate) : null))
      .filter((coordinate: DALCoordinate | null): coordinate is DALCoordinate => Boolean(coordinate));
    if (osrmGeometry.length < 2) {
      return failureResult({
        startedAt,
        failureReason: "OSRM_ROUTE_NOT_FOUND",
        candidateCoordinate: args.candidateCoordinate,
        attachmentCoordinate: args.attachmentCoordinate,
        snappedStartCoordinate: startSnap.coordinate,
        snappedEndCoordinate: endSnap.coordinate,
        distanceToStartNode: startSnap.distanceFeet,
        distanceToEndNode: endSnap.distanceFeet,
        existingInventoryLengthFeet: args.existingInventoryLengthFeet,
        attachmentId: args.attachmentId,
        nearestStartUrl: startSnap.url,
        nearestEndUrl: endSnap.url,
        routeUrl,
      });
    }

    const geometry = osrmGeometry;
    const routeFeet = routeLengthFeet(geometry);
    const pathNodeIds = osrmGeometry.map((_, index) => `osrm-node-${index}`);
    const pathEdgeIds = osrmGeometry.slice(1).map((_, index) => `osrm-edge-${index}`);
    const startNode: StreetGraphNode = { nodeId: "osrm-start", coordinate: startSnap.coordinate };
    const endNode: StreetGraphNode = { nodeId: "osrm-end", coordinate: endSnap.coordinate };
    const audit: RoutingAudit = {
      routingEngine: "OSRMLateralRouter",
      graphNodes: osrmGeometry.length,
      graphEdges: Math.max(0, osrmGeometry.length - 1),
      streetFeatureCount: osrmGeometry.length,
      streetLayerLoaded: true,
      streetLayerAuthority: "OSRM_PUBLIC_API",
      streetLayerCertificationUse: "ROUTING_REFERENCE",
      streetLayerBboxCoverage: true,
      startNode: startNode.nodeId,
      endNode: endNode.nodeId,
      pathFound: true,
      pathNodeCount: osrmGeometry.length,
      pathEdgeCount: Math.max(0, osrmGeometry.length - 1),
      pathSegmentCount: Math.max(0, osrmGeometry.length - 1),
      totalTraversedLength: routeFeet,
      routingMethod: "OSRM_ROUTE",
      routingExecutionTime: Math.round(performance.now() - startedAt),
      fallbackUsed: false,
      routeStatus: "VALID",
      graphSource: "OSRM_PUBLIC_API",
      routingProvider: "OSRM_PUBLIC_API",
      osmRoutingAllowedScope: "NEW_LATERAL_SEGMENT",
      candidateCoordinate: args.candidateCoordinate,
      attachmentCoordinate: args.attachmentCoordinate,
      snappedStartCoordinate: startSnap.coordinate,
      snappedEndCoordinate: endSnap.coordinate,
      distanceToStartNode: startSnap.distanceFeet,
      distanceToEndNode: endSnap.distanceFeet,
      routingScope: "NEW_LATERAL_ONLY",
      existingInventoryRoutePreserved: true,
      existingInventoryLengthFeet: args.existingInventoryLengthFeet,
      newLateralLengthFeet: routeFeet,
      attachmentId: args.attachmentId,
      osmRouteFound: true,
      osmSnapDistanceFeet: startSnap.distanceFeet,
      candidateSnapDistanceFeet: endSnap.distanceFeet,
    };
    console.log({
      routingEngine: audit.routingEngine,
      routingProvider: audit.routingProvider,
      pathFound: audit.pathFound,
      pathNodeCount: audit.pathNodeCount,
      pathSegmentCount: audit.pathSegmentCount,
      renderedVertexCount: geometry.length,
      routeStatus: audit.routeStatus,
      fallbackUsed: audit.fallbackUsed,
      routeUrl,
    });
    return {
      routeStatus: "VALID",
      geometry,
      routeFeet,
      routeMiles: routeFeet / 5280,
      streetGraphPath: osrmGeometry,
      startNode,
      endNode,
      pathNodeIds,
      pathEdgeIds,
      roadSegmentCount: Math.max(0, osrmGeometry.length - 1),
      roadNamesTraversed: ["OSRM driving route"],
      roadClassesTraversed: ["OSRM_ROUTE"],
      audit,
      graphPreview: { nodes: [startNode, endNode], edges: [] },
    };
  } catch (error) {
    console.warn("OSRM lateral route failed", error);
    return failureResult({
      startedAt,
      failureReason: "OSRM_ROUTE_NOT_FOUND",
      candidateCoordinate: args.candidateCoordinate,
      attachmentCoordinate: args.attachmentCoordinate,
      existingInventoryLengthFeet: args.existingInventoryLengthFeet,
      attachmentId: args.attachmentId,
    });
  }
}
