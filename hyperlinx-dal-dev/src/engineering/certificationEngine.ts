import { haversineFeet, clamp } from "../affinity/geo";
import { BURIED_CONSTRUCTION_ASSUMPTIONS } from "./constructionModel";
import type { CandidateSite } from "../types/candidateSite";
import type {
  AttachmentPoint,
  CertificationSnapshot,
  CertificationStatus,
  DALCoordinate,
  InventoryEdge,
  InventoryGraph,
  InventoryNode,
  InventoryStation,
  LateralPath,
  ServiceabilityAssessment,
} from "../types/dal";
import type { BuildPath } from "../types/networkAffinity";
import type { GraphExtension } from "../types/graphExtension";

const FEET_PER_DEGREE_LAT = 364000;

function validCoord(coord?: DALCoordinate | null): coord is DALCoordinate {
  return Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]));
}

function feetPerDegreeLon(lat: number) {
  return Math.max(1, Math.cos((lat * Math.PI) / 180) * FEET_PER_DEGREE_LAT);
}

function projectPointToSegment(target: DALCoordinate, a: DALCoordinate, b: DALCoordinate) {
  const centerLat = (target[1] + a[1] + b[1]) / 3;
  const fx = feetPerDegreeLon(centerLat);
  const toXY = (coord: DALCoordinate) => ({
    x: coord[0] * fx,
    y: coord[1] * FEET_PER_DEGREE_LAT,
  });
  const p = toXY(target);
  const p1 = toXY(a);
  const p2 = toXY(b);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? clamp(((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lengthSq, 0, 1) : 0;
  const projectedXY = {
    x: p1.x + dx * t,
    y: p1.y + dy * t,
  };
  const coordinate: DALCoordinate = [projectedXY.x / fx, projectedXY.y / FEET_PER_DEGREE_LAT];
  return {
    coordinate,
    distanceFeet: haversineFeet(target, coordinate),
  };
}

function nearestNodeForEdge(graph: InventoryGraph, edge: InventoryEdge, point: DALCoordinate) {
  const nodeIds = new Set([edge.fromNodeId, edge.toNodeId]);
  const candidates = graph.nodes.filter((node) => nodeIds.has(node.nodeId));
  return nearestNode(candidates.length ? candidates : graph.nodes, point);
}

function nearestNode(nodes: InventoryNode[], point: DALCoordinate) {
  let best: { node: InventoryNode; distanceFeet: number } | null = null;
  for (const node of nodes) {
    const distanceFeet = haversineFeet([node.lon, node.lat], point);
    if (!best || distanceFeet < best.distanceFeet) best = { node, distanceFeet };
  }
  return best;
}

function nearestStation(stations: InventoryStation[], point: DALCoordinate, routeId?: string) {
  const pool = routeId ? stations.filter((station) => station.routeId === routeId) : stations;
  let best: { station: InventoryStation; distanceFeet: number } | null = null;
  for (const station of pool.length ? pool : stations) {
    const distanceFeet = haversineFeet([station.lon, station.lat], point);
    if (!best || distanceFeet < best.distanceFeet) best = { station, distanceFeet };
  }
  return best;
}

function routeEdges(graph: InventoryGraph, preferredRouteId?: string) {
  const filtered = preferredRouteId ? graph.edges.filter((edge) => edge.routeId === preferredRouteId) : [];
  return filtered.length ? filtered : graph.edges;
}

export function certifyAttachmentPoint(args: {
  site: Pick<CandidateSite, "candidateId" | "latitude" | "longitude">;
  graph: InventoryGraph;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
}): AttachmentPoint {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  if (!validCoord(siteCoord) || !args.graph.edges.length) {
    return {
      attachmentId: `attach-${args.site.candidateId}-failed`,
      routeId: "",
      routeSegmentId: "",
      nodeId: "",
      stationId: "",
      latitude: Number.NaN,
      longitude: Number.NaN,
      distanceFeet: Number.POSITIVE_INFINITY,
      confidenceScore: 0,
      certificationStatus: "FAILED",
    };
  }

  let best:
    | {
        edge: InventoryEdge;
        coordinate: DALCoordinate;
        distanceFeet: number;
      }
    | null = null;
  for (const edge of routeEdges(args.graph, args.routeId)) {
    const coordinates = edge.coordinates ?? [];
    for (let i = 1; i < coordinates.length; i += 1) {
      const a = coordinates[i - 1];
      const b = coordinates[i];
      if (!validCoord(a) || !validCoord(b)) continue;
      const projected = projectPointToSegment(siteCoord, a, b);
      if (!best || projected.distanceFeet < best.distanceFeet) {
        best = { edge, ...projected };
      }
    }
  }

  if (!best) {
    return {
      attachmentId: `attach-${args.site.candidateId}-failed`,
      routeId: "",
      routeSegmentId: "",
      nodeId: "",
      stationId: "",
      latitude: Number.NaN,
      longitude: Number.NaN,
      distanceFeet: Number.POSITIVE_INFINITY,
      confidenceScore: 0,
      certificationStatus: "FAILED",
    };
  }

  const node = nearestNodeForEdge(args.graph, best.edge, best.coordinate);
  const station = nearestStation(args.graph.stations, best.coordinate, best.edge.routeId);
  const confidenceScore = clamp(96 - best.distanceFeet / 550 - (station ? Math.min(station.distanceFeet / 1800, 12) : 15));
  const certificationStatus: CertificationStatus = best.edge.edgeId && best.edge.routeId ? (confidenceScore >= 45 ? "CERTIFIED" : "WARNING") : "FAILED";
  return {
    attachmentId: `attach-${args.site.candidateId}-${best.edge.routeId}-${best.edge.edgeId}`,
    routeId: best.edge.routeId,
    routeSegmentId: best.edge.edgeId,
    nodeId: args.nodeId ?? node?.node.nodeId ?? best.edge.fromNodeId,
    stationId: args.stationId ?? station?.station.stationId ?? "",
    latitude: best.coordinate[1],
    longitude: best.coordinate[0],
    distanceFeet: Math.round(best.distanceFeet),
    confidenceScore: Math.round(confidenceScore),
    certificationStatus,
  };
}

function countTurns(geometry: DALCoordinate[]) {
  if (geometry.length < 3) return 0;
  let turns = 0;
  for (let i = 2; i < geometry.length; i += 1) {
    const a = geometry[i - 2];
    const b = geometry[i - 1];
    const c = geometry[i];
    const v1 = [b[0] - a[0], b[1] - a[1]];
    const v2 = [c[0] - b[0], c[1] - b[1]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const mag = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
    if (!mag) continue;
    const angle = Math.acos(clamp(dot / mag, -1, 1));
    if (angle > Math.PI / 5) turns += 1;
  }
  return turns;
}

function pathLengthFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let i = 1; i < geometry.length; i += 1) feet += haversineFeet(geometry[i - 1], geometry[i]);
  return feet;
}

export function certifyLateralPath(args: {
  site: Pick<CandidateSite, "candidateId" | "latitude" | "longitude">;
  attachmentPoint: AttachmentPoint;
  buildPath?: BuildPath;
  permitCount?: number;
}): LateralPath {
  const candidateCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  const attachmentCoord: DALCoordinate = [Number(args.attachmentPoint.longitude), Number(args.attachmentPoint.latitude)];
  const sourceGeometry = args.buildPath?.geometry?.filter(validCoord) ?? [];
  const middle = sourceGeometry.length > 2 ? sourceGeometry.slice(1, -1) : [];
  const geometry = validCoord(candidateCoord) && validCoord(attachmentCoord) ? [candidateCoord, ...middle, attachmentCoord] : [];
  const buildFeet = Math.round(pathLengthFeet(geometry));
  const crossings = Number(args.buildPath?.estimatedCrossings ?? 0);
  const turns = Number(args.buildPath?.turnCount ?? countTurns(geometry));
  const certificationStatus: CertificationStatus =
    args.attachmentPoint.certificationStatus === "FAILED" || geometry.length < 2 || buildFeet <= 0
      ? "FAILED"
      : args.attachmentPoint.certificationStatus === "WARNING"
        ? "WARNING"
        : "CERTIFIED";
  return {
    lateralId: `lat-${args.site.candidateId}-${args.attachmentPoint.attachmentId}`,
    attachmentId: args.attachmentPoint.attachmentId,
    geometry,
    buildFeet,
    buildMiles: buildFeet / 5280,
    segmentCount: Math.max(0, geometry.length - 1),
    crossings,
    turns,
    permitCount: Number(args.permitCount ?? 0),
    certificationStatus,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
  };
}

export function assessServiceability(args: {
  attachmentPoint: AttachmentPoint;
  lateralPath: LateralPath;
  permitRisk?: number;
  buildRisk?: number;
}): ServiceabilityAssessment {
  const attachmentCertified = args.attachmentPoint.certificationStatus === "CERTIFIED";
  const lateralCertified = args.lateralPath.certificationStatus === "CERTIFIED";
  const routeCertified = Boolean(args.attachmentPoint.routeId && args.attachmentPoint.routeSegmentId);
  const permitRisk = clamp(Number(args.permitRisk ?? 35));
  const buildRisk = clamp(Number(args.buildRisk ?? args.lateralPath.crossings * 8 + args.lateralPath.turns * 2));
  const confidenceScore = Math.round(
    args.attachmentPoint.confidenceScore * 0.46 +
      (lateralCertified ? 34 : args.lateralPath.certificationStatus === "WARNING" ? 22 : 0) +
      (routeCertified ? 20 : 0) -
      permitRisk * 0.08 -
      buildRisk * 0.06
  );
  const serviceable = routeCertified && args.attachmentPoint.certificationStatus !== "FAILED" && args.lateralPath.certificationStatus !== "FAILED";
  const status = !serviceable
    ? "NOT_SERVICEABLE"
    : attachmentCertified && lateralCertified && confidenceScore >= 65 && permitRisk < 70 && buildRisk < 80
      ? "SERVICEABLE"
      : "CONDITIONALLY_SERVICEABLE";
  return {
    serviceable,
    attachmentCertified,
    lateralCertified,
    routeCertified,
    permitRisk,
    buildRisk,
    confidenceScore: clamp(confidenceScore),
    status,
  };
}

export function createCertificationSnapshot(args: {
  attachmentPoint: AttachmentPoint;
  lateralPath: LateralPath;
  serviceabilityAssessment: ServiceabilityAssessment;
}): CertificationSnapshot {
  return {
    attachmentPoint: args.attachmentPoint,
    lateralPath: args.lateralPath,
    serviceabilityAssessment: args.serviceabilityAssessment,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
    certifiedAt: new Date().toISOString(),
  };
}

export function certifySiteDecision(args: {
  site: CandidateSite;
  graph: InventoryGraph;
  buildPath?: BuildPath;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  permitRisk?: number;
  buildRisk?: number;
  permitCount?: number;
}) {
  const attachmentPoint = certifyAttachmentPoint(args);
  const lateralPath = certifyLateralPath({
    site: args.site,
    attachmentPoint,
    buildPath: args.buildPath,
    permitCount: args.permitCount,
  });
  const serviceabilityAssessment = assessServiceability({
    attachmentPoint,
    lateralPath,
    permitRisk: args.permitRisk,
    buildRisk: args.buildRisk,
  });
  const certificationSnapshot = createCertificationSnapshot({
    attachmentPoint,
    lateralPath,
    serviceabilityAssessment,
  });
  return {
    attachmentPoint,
    lateralPath,
    serviceabilityAssessment,
    certificationSnapshot,
  };
}

export function certifyGraphExtension(graph: InventoryGraph, extension: GraphExtension): GraphExtension {
  const route = extension.routes[0];
  const lastNode = extension.nodes[extension.nodes.length - 1];
  const nodeTarget = lastNode ? ([lastNode.lng, lastNode.lat] as DALCoordinate) : undefined;
  const target = route?.geometry?.[route.geometry.length - 1] ?? nodeTarget;
  if (!validCoord(target)) {
    return {
      ...extension,
      extensionCertificationStatus: "FAILED",
      metadata: {
        ...extension.metadata,
        extensionCertificationStatus: "FAILED",
        certificationReason: "Extension has no valid target geometry.",
      },
    };
  }
  const syntheticSite = {
    candidateId: extension.extensionId,
    latitude: target[1],
    longitude: target[0],
  };
  const attachmentPoint = certifyAttachmentPoint({
    site: syntheticSite,
    graph,
    routeId: String(extension.metadata.selectedRouteId ?? extension.metadata.nearestRouteId ?? ""),
  });
  const start: DALCoordinate = [attachmentPoint.longitude, attachmentPoint.latitude];
  const geometry = attachmentPoint.certificationStatus === "FAILED" ? route?.geometry ?? [] : [start, target];
  const lengthFeet = geometry.length >= 2 ? Math.round(pathLengthFeet(geometry)) : 0;
  const status: CertificationStatus =
    attachmentPoint.certificationStatus === "FAILED" || geometry.length < 2
      ? "FAILED"
      : attachmentPoint.certificationStatus === "WARNING"
        ? "WARNING"
        : "CERTIFIED";
  return {
    ...extension,
    extensionCertificationStatus: status,
    nodes: extension.nodes.map((node, index) =>
      index === 0 && status !== "FAILED"
        ? {
            ...node,
            lat: start[1],
            lng: start[0],
          }
        : node
    ),
    edges: extension.edges.map((edge) => ({
      ...edge,
      geometry,
      lengthFeet,
    })),
    routes: extension.routes.map((item) => ({
      ...item,
      geometry,
      lengthFeet,
    })),
    metadata: {
      ...extension.metadata,
      extensionCertificationStatus: status,
      certifiedAttachmentPoint: attachmentPoint,
      routeContinuityValidated: status !== "FAILED",
      graphConnectivityValidated: status !== "FAILED",
    },
  };
}
