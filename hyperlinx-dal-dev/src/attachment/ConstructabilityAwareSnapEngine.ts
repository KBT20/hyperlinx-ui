import { haversineFeet } from "../affinity/geo";
import { analyzeRouteConstraints, type ConstraintAnalysisResult, type ReferenceLayerSet } from "../routing/ConstraintAnalysisEngine";
import type { ConstraintGeometryFeature, ConstraintRegistrySnapshot } from "../reference/ConstraintGeometryRegistry";
import type { DALCoordinate, InventoryEdge, InventoryNode, InventoryRoute, InventoryStation, ScopeVersion } from "../types/dal";
import type { AttachmentAuthorityResult } from "./AttachmentAuthorityEngine";

export type ConstructabilitySnapAlternative = "LOWEST_DISTANCE" | "LOWEST_CONFLICT" | "LOWEST_COST" | "ENGINEER_PREFERRED";

export type ConstructabilityAttachmentCandidateType =
  | "NEAREST_STATION"
  | "NEAREST_NODE"
  | "NEAREST_EDGE"
  | "NEAREST_ROUTE_SEGMENT"
  | "NEAREST_ATTACHMENT";

export type ConstructabilitySnapMethod =
  | "STATION_SNAP"
  | "NODE_SNAP"
  | "EDGE_SNAP"
  | "ROUTE_SEGMENT_SNAP"
  | "CERTIFIED_ATTACHMENT_SNAP"
  | "CONSTRUCTABILITY_AWARE_SNAP";

export type ConstructabilityImpactSummary = {
  waterCrossings: number;
  railCrossings: number;
  parcelImpacts: number;
  buildingImpacts: number;
  roadImpacts: number;
  terrainImpacts: number;
  unknownImpactCount: number;
};

export type ConstructabilityAttachmentCandidate = {
  candidateId: string;
  candidateType: ConstructabilityAttachmentCandidateType;
  label: string;
  attachmentCoordinate: DALCoordinate;
  distanceFeet: number;
  routeId?: string;
  routeSegmentId?: string;
  stationId?: string;
  nodeId?: string;
  edgeId?: string;
  authorityMethod?: string;
  sourceAuthority: string;
  corridorGeometry: DALCoordinate[];
  impacts: ConstructabilityImpactSummary;
  scores: {
    distanceScore: number;
    conflictScore: number;
    costScore: number;
    authorityScore: number;
    constructabilityScore: number;
  };
  estimatedCostImpact: number;
  constraintEvidenceId?: string;
  constraintAnalysis?: ConstraintAnalysisResult;
  evidence: string[];
};

export type AttachmentCorridorEvidence = {
  corridorId: string;
  geometry: DALCoordinate[];
  directFeet: number;
  constraintEvidenceId?: string;
  constraintSummary?: ConstraintAnalysisResult["summary"];
  unresolvedConstraints: string[];
  certificationReadiness?: ConstraintAnalysisResult["certificationReadiness"];
};

export type ConstructabilityAwareSnapEvidence = {
  generatedBy: "ConstructabilityAwareSnapEngine";
  generatedAt: string;
  doctrine: string[];
  selectedCandidateId: string;
  selectedCandidateType: ConstructabilityAttachmentCandidateType;
  selectedAlternative: ConstructabilitySnapAlternative;
  candidates: ConstructabilityAttachmentCandidate[];
  alternatives: Partial<Record<ConstructabilitySnapAlternative, string>>;
  constraintRegistrySnapshot?: ConstraintRegistrySnapshot;
  attachmentAuthority: AttachmentAuthorityResult;
  notes: string[];
  futureHooks: string[];
};

export type ConstructabilityAwareSnapInput = {
  candidateCoordinate: DALCoordinate;
  inventoryScopeVersion: ScopeVersion;
  attachmentAuthority: AttachmentAuthorityResult;
  constraintRegistrySnapshot?: ConstraintRegistrySnapshot;
  constraintRegistryFeatures?: ConstraintGeometryFeature[];
  preferredAlternative?: ConstructabilitySnapAlternative;
  candidateSnapCoordinate?: DALCoordinate;
  maxRouteSegmentsToInspect?: number;
};

export type ConstructabilityAwareSnapResult = {
  snapId: string;
  attachmentCoordinate: DALCoordinate;
  snapMethod: ConstructabilitySnapMethod;
  snapConfidence: number;
  snapEvidence: ConstructabilityAwareSnapEvidence;
  constructabilityScore: number;
  selectedAlternative: ConstructabilitySnapAlternative;
  selectedCandidate: ConstructabilityAttachmentCandidate;
  candidates: ConstructabilityAttachmentCandidate[];
  alternatives: Partial<Record<ConstructabilitySnapAlternative, ConstructabilityAttachmentCandidate>>;
  attachmentCorridorEvidence: AttachmentCorridorEvidence;
  futureHooks: string[];
};

type GraphCollections = {
  routes: InventoryRoute[];
  nodes: InventoryNode[];
  edges: InventoryEdge[];
  stations: InventoryStation[];
};

const FUTURE_HOOKS = ["GEO_DIVERSE_SNAPPING", "ROW_SNAPPING", "UTILITY_CORRIDOR_SNAPPING", "RAIL_CORRIDOR_SNAPPING", "POWER_CORRIDOR_SNAPPING"];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isCoordinate(value: unknown): value is DALCoordinate {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function graphFromScopeVersion(scopeVersion: ScopeVersion): GraphCollections {
  const truth = asRecord(scopeVersion.canonicalTruth);
  const network = asRecord(truth.network);
  return {
    routes: asArray<InventoryRoute>(truth.routes ?? network.routes),
    nodes: asArray<InventoryNode>(truth.nodes ?? network.nodes),
    edges: asArray<InventoryEdge>(truth.edges ?? network.edges),
    stations: asArray<InventoryStation>(truth.stations ?? network.stations),
  };
}

function nearestPointOnSegment(point: DALCoordinate, start: DALCoordinate, end: DALCoordinate): DALCoordinate {
  const [px, py] = point;
  const [ax, ay] = start;
  const [bx, by] = end;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator));
  return [ax + t * dx, ay + t * dy];
}

function nearestOnLine(point: DALCoordinate, geometry: DALCoordinate[], maxSegments = Number.POSITIVE_INFINITY) {
  let best: { coordinate: DALCoordinate; distanceFeet: number; segmentIndex: number } | null = null;
  const limit = Math.min(Math.max(0, maxSegments), Math.max(0, geometry.length - 1));
  for (let index = 1; index <= limit; index += 1) {
    const start = geometry[index - 1];
    const end = geometry[index];
    if (!isCoordinate(start) || !isCoordinate(end)) continue;
    const coordinate = nearestPointOnSegment(point, start, end);
    const distanceFeet = haversineFeet(point, coordinate);
    if (!best || distanceFeet < best.distanceFeet) best = { coordinate, distanceFeet, segmentIndex: index - 1 };
  }
  return best;
}

function nearestStation(stations: InventoryStation[], point: DALCoordinate) {
  let bestStation: InventoryStation | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const station of stations) {
    const coordinate: DALCoordinate = [Number(station.lon), Number(station.lat)];
    if (!isCoordinate(coordinate)) continue;
    const distance = haversineFeet(point, coordinate);
    if (distance < bestDistance) {
      bestStation = station;
      bestDistance = distance;
    }
  }
  return bestStation ? { station: bestStation, coordinate: [bestStation.lon, bestStation.lat] as DALCoordinate, distanceFeet: bestDistance } : null;
}

function nearestNode(nodes: InventoryNode[], point: DALCoordinate) {
  let bestNode: InventoryNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const coordinate: DALCoordinate = [Number(node.lon), Number(node.lat)];
    if (!isCoordinate(coordinate)) continue;
    const distance = haversineFeet(point, coordinate);
    if (distance < bestDistance) {
      bestNode = node;
      bestDistance = distance;
    }
  }
  return bestNode ? { node: bestNode, coordinate: [bestNode.lon, bestNode.lat] as DALCoordinate, distanceFeet: bestDistance } : null;
}

function nearestEdge(edges: InventoryEdge[], point: DALCoordinate, maxRouteSegmentsToInspect: number) {
  let inspected = 0;
  let best: { edge: InventoryEdge; coordinate: DALCoordinate; distanceFeet: number; segmentIndex: number } | null = null;
  for (const edge of edges) {
    const remaining = Math.max(0, maxRouteSegmentsToInspect - inspected);
    if (remaining <= 0) break;
    const nearest = nearestOnLine(point, edge.coordinates ?? [], remaining);
    inspected += Math.max(0, Math.min(remaining, (edge.coordinates?.length ?? 1) - 1));
    if (!nearest) continue;
    if (!best || nearest.distanceFeet < best.distanceFeet) best = { edge, ...nearest };
  }
  return best;
}

function nearestRouteSegment(routes: InventoryRoute[], point: DALCoordinate, maxRouteSegmentsToInspect: number) {
  let inspected = 0;
  let best: { route: InventoryRoute; coordinate: DALCoordinate; distanceFeet: number; segmentIndex: number } | null = null;
  for (const route of routes) {
    const remaining = Math.max(0, maxRouteSegmentsToInspect - inspected);
    if (remaining <= 0) break;
    const nearest = nearestOnLine(point, route.coordinates ?? [], remaining);
    inspected += Math.max(0, Math.min(remaining, (route.coordinates?.length ?? 1) - 1));
    if (!nearest) continue;
    if (!best || nearest.distanceFeet < best.distanceFeet) best = { route, ...nearest };
  }
  return best;
}

function methodForType(type: ConstructabilityAttachmentCandidateType): ConstructabilitySnapMethod {
  if (type === "NEAREST_STATION") return "STATION_SNAP";
  if (type === "NEAREST_NODE") return "NODE_SNAP";
  if (type === "NEAREST_EDGE") return "EDGE_SNAP";
  if (type === "NEAREST_ROUTE_SEGMENT") return "ROUTE_SEGMENT_SNAP";
  return "CERTIFIED_ATTACHMENT_SNAP";
}

function authorityScoreForType(type: ConstructabilityAttachmentCandidateType) {
  if (type === "NEAREST_ATTACHMENT") return 96;
  if (type === "NEAREST_EDGE") return 90;
  if (type === "NEAREST_ROUTE_SEGMENT") return 84;
  if (type === "NEAREST_STATION") return 78;
  return 74;
}

function impactsFromAnalysis(analysis: ConstraintAnalysisResult): ConstructabilityImpactSummary {
  return {
    waterCrossings: analysis.summary.waterCrossings,
    railCrossings: analysis.summary.railroadCrossings,
    parcelImpacts: analysis.summary.parcelCrossings,
    buildingImpacts: analysis.summary.buildingConflicts,
    roadImpacts: analysis.summary.roadCrossings,
    terrainImpacts: analysis.summary.terrainFlags,
    unknownImpactCount: Object.values(analysis.unknownCounts).filter(Boolean).length,
  };
}

function conflictPenalty(impacts: ConstructabilityImpactSummary) {
  return (
    impacts.buildingImpacts * 36 +
    impacts.railCrossings * 26 +
    impacts.waterCrossings * 24 +
    impacts.parcelImpacts * 10 +
    impacts.terrainImpacts * 8 +
    impacts.roadImpacts * 3 +
    impacts.unknownImpactCount * 8
  );
}

function estimatedCost(distanceFeet: number, impacts: ConstructabilityImpactSummary) {
  return Math.round(
    distanceFeet * 28 +
      impacts.buildingImpacts * 50000 +
      impacts.railCrossings * 35000 +
      impacts.waterCrossings * 30000 +
      impacts.parcelImpacts * 2500 +
      impacts.terrainImpacts * 7500 +
      impacts.roadImpacts * 1200
  );
}

function scoreCandidate(args: {
  candidate: Omit<ConstructabilityAttachmentCandidate, "scores" | "estimatedCostImpact" | "impacts" | "constraintAnalysis" | "constraintEvidenceId" | "evidence">;
  sourceCandidateCoordinate: DALCoordinate;
  attachmentAuthority: AttachmentAuthorityResult;
  referenceLayers: ReferenceLayerSet;
  parentScopeVersionId: string;
}) {
  const corridorGeometry: DALCoordinate[] = [args.sourceCandidateCoordinate, args.candidate.attachmentCoordinate];
  const analysis = analyzeRouteConstraints({
    parentScopeVersionId: args.parentScopeVersionId,
    candidateSiteId: args.candidate.candidateId,
    attachmentAuthority: args.attachmentAuthority,
    candidateCoordinate: { lon: args.sourceCandidateCoordinate[0], lat: args.sourceCandidateCoordinate[1] },
    proposedGeometry: corridorGeometry,
    referenceLayers: args.referenceLayers,
    routeGeometrySource: "SERVICEABILITY_PROPOSED",
    analysisMode: "REFERENCE_LAYER_ASSISTED",
  });
  const impacts = impactsFromAnalysis(analysis);
  const cost = estimatedCost(args.candidate.distanceFeet, impacts);
  const distanceScore = clamp(100 - args.candidate.distanceFeet / 85);
  const conflictScore = clamp(100 - conflictPenalty(impacts));
  const costScore = clamp(100 - cost / 18000);
  const authorityScore = authorityScoreForType(args.candidate.candidateType);
  const constructabilityScore = Math.round(distanceScore * 0.24 + conflictScore * 0.34 + costScore * 0.18 + authorityScore * 0.24);
  const evidence = [
    `Candidate ${args.candidate.candidateType} evaluated from ScopeVersion truth.`,
    `Distance ${Math.round(args.candidate.distanceFeet).toLocaleString()} ft.`,
    `Constraint score ${conflictScore}/100; cost score ${costScore}/100; authority score ${authorityScore}/100.`,
    analysis.certificationReadiness === "UNKNOWN"
      ? "Constraint registry is incomplete; snap remains review-only until human certification."
      : `Constraint readiness ${analysis.certificationReadiness}.`,
  ];
  return {
    ...args.candidate,
    corridorGeometry,
    impacts,
    scores: {
      distanceScore: Math.round(distanceScore),
      conflictScore: Math.round(conflictScore),
      costScore: Math.round(costScore),
      authorityScore,
      constructabilityScore,
    },
    estimatedCostImpact: cost,
    constraintEvidenceId: analysis.evidenceId,
    constraintAnalysis: analysis,
    evidence,
  } satisfies ConstructabilityAttachmentCandidate;
}

function buildBaseCandidates(input: ConstructabilityAwareSnapInput, graph: GraphCollections) {
  const point = input.candidateCoordinate;
  const maxSegments = input.maxRouteSegmentsToInspect ?? 85000;
  const candidates: Array<Omit<ConstructabilityAttachmentCandidate, "scores" | "estimatedCostImpact" | "impacts" | "constraintAnalysis" | "constraintEvidenceId" | "evidence">> = [];
  const station = nearestStation(graph.stations, point);
  if (station) {
    candidates.push({
      candidateId: `snap-station:${station.station.stationId}`,
      candidateType: "NEAREST_STATION",
      label: `Nearest station ${station.station.label ?? station.station.stationId}`,
      attachmentCoordinate: station.coordinate,
      distanceFeet: Math.round(station.distanceFeet),
      routeId: station.station.routeId,
      stationId: station.station.stationId,
      sourceAuthority: "ScopeVersion Station",
      corridorGeometry: [point, station.coordinate],
    });
  }
  const node = nearestNode(graph.nodes, point);
  if (node) {
    candidates.push({
      candidateId: `snap-node:${node.node.nodeId}`,
      candidateType: "NEAREST_NODE",
      label: `Nearest node ${node.node.nodeId}`,
      attachmentCoordinate: node.coordinate,
      distanceFeet: Math.round(node.distanceFeet),
      nodeId: node.node.nodeId,
      sourceAuthority: "ScopeVersion Node",
      corridorGeometry: [point, node.coordinate],
    });
  }
  const edge = nearestEdge(graph.edges, point, maxSegments);
  if (edge) {
    candidates.push({
      candidateId: `snap-edge:${edge.edge.edgeId}`,
      candidateType: "NEAREST_EDGE",
      label: `Nearest edge ${edge.edge.edgeId}`,
      attachmentCoordinate: edge.coordinate,
      distanceFeet: Math.round(edge.distanceFeet),
      routeId: edge.edge.routeId,
      routeSegmentId: edge.edge.edgeId,
      edgeId: edge.edge.edgeId,
      sourceAuthority: "ScopeVersion Edge Projection",
      corridorGeometry: [point, edge.coordinate],
    });
  }
  const routeSegment = nearestRouteSegment(graph.routes, point, maxSegments);
  if (routeSegment) {
    candidates.push({
      candidateId: `snap-route:${routeSegment.route.routeId}:${routeSegment.segmentIndex}`,
      candidateType: "NEAREST_ROUTE_SEGMENT",
      label: `Nearest route segment ${routeSegment.route.name ?? routeSegment.route.routeId}`,
      attachmentCoordinate: routeSegment.coordinate,
      distanceFeet: Math.round(routeSegment.distanceFeet),
      routeId: routeSegment.route.routeId,
      routeSegmentId: `${routeSegment.route.routeId}:segment-${routeSegment.segmentIndex}`,
      sourceAuthority: "ScopeVersion Route Segment",
      corridorGeometry: [point, routeSegment.coordinate],
    });
  }
  if (isCoordinate(input.attachmentAuthority.attachmentCoordinate)) {
    candidates.push({
      candidateId: `snap-authority:${input.attachmentAuthority.attachmentMethod}:${input.attachmentAuthority.routeId ?? input.attachmentAuthority.edgeId ?? "attachment"}`,
      candidateType: "NEAREST_ATTACHMENT",
      label: `Attachment authority ${input.attachmentAuthority.attachmentMethod}`,
      attachmentCoordinate: input.attachmentAuthority.attachmentCoordinate,
      distanceFeet: Math.round(haversineFeet(point, input.attachmentAuthority.attachmentCoordinate)),
      routeId: input.attachmentAuthority.routeId,
      routeSegmentId: input.attachmentAuthority.edgeId,
      stationId: input.attachmentAuthority.stationId,
      nodeId: input.attachmentAuthority.nodeId,
      edgeId: input.attachmentAuthority.edgeId,
      authorityMethod: input.attachmentAuthority.attachmentMethod,
      sourceAuthority: input.attachmentAuthority.attachmentAuthority,
      corridorGeometry: [point, input.attachmentAuthority.attachmentCoordinate],
    });
  }
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.candidateType}:${candidate.attachmentCoordinate[0].toFixed(7)},${candidate.attachmentCoordinate[1].toFixed(7)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickAlternatives(candidates: ConstructabilityAttachmentCandidate[]) {
  const byDistance = [...candidates].sort((a, b) => a.distanceFeet - b.distanceFeet)[0];
  const byConflict = [...candidates].sort((a, b) => b.scores.conflictScore - a.scores.conflictScore || a.distanceFeet - b.distanceFeet)[0];
  const byCost = [...candidates].sort((a, b) => a.estimatedCostImpact - b.estimatedCostImpact || b.scores.constructabilityScore - a.scores.constructabilityScore)[0];
  const byEngineer = [...candidates].sort((a, b) => b.scores.constructabilityScore - a.scores.constructabilityScore || b.scores.authorityScore - a.scores.authorityScore)[0];
  return {
    LOWEST_DISTANCE: byDistance,
    LOWEST_CONFLICT: byConflict,
    LOWEST_COST: byCost,
    ENGINEER_PREFERRED: byEngineer,
  } satisfies Record<ConstructabilitySnapAlternative, ConstructabilityAttachmentCandidate | undefined>;
}

function confidenceFor(candidate: ConstructabilityAttachmentCandidate, attachmentAuthority: AttachmentAuthorityResult) {
  const scoreConfidence = candidate.scores.constructabilityScore / 100;
  const authorityConfidence = attachmentAuthority.attachmentConfidence;
  const unknownPenalty = Math.min(0.18, candidate.impacts.unknownImpactCount * 0.03);
  return clamp(round(scoreConfidence * 0.64 + authorityConfidence * 0.36 - unknownPenalty, 2), 0.1, 0.98);
}

function corridorEvidenceFor(candidate: ConstructabilityAttachmentCandidate): AttachmentCorridorEvidence {
  return {
    corridorId: `corridor:${candidate.candidateId}`,
    geometry: candidate.corridorGeometry,
    directFeet: Math.round(candidate.distanceFeet),
    constraintEvidenceId: candidate.constraintEvidenceId,
    constraintSummary: candidate.constraintAnalysis?.summary,
    unresolvedConstraints: candidate.constraintAnalysis?.unresolvedConstraints ?? [],
    certificationReadiness: candidate.constraintAnalysis?.certificationReadiness,
  };
}

export function resolveConstructabilityAwareSnap(input: ConstructabilityAwareSnapInput): ConstructabilityAwareSnapResult | null {
  if (!isCoordinate(input.candidateCoordinate) || !input.attachmentAuthority) return null;
  const graph = graphFromScopeVersion(input.inventoryScopeVersion);
  const baseCandidates = buildBaseCandidates(input, graph);
  if (!baseCandidates.length) return null;
  const referenceLayers: ReferenceLayerSet = {
    constraintRegistrySnapshot: input.constraintRegistrySnapshot,
    constraintRegistryFeatures: input.constraintRegistryFeatures,
  };
  const scored = baseCandidates
    .map((candidate) =>
      scoreCandidate({
        candidate,
        sourceCandidateCoordinate: input.candidateSnapCoordinate ?? input.candidateCoordinate,
        attachmentAuthority: input.attachmentAuthority,
        referenceLayers,
        parentScopeVersionId: input.inventoryScopeVersion.scopeVersionId,
      })
    )
    .sort((a, b) => b.scores.constructabilityScore - a.scores.constructabilityScore || a.distanceFeet - b.distanceFeet);
  const alternatives = pickAlternatives(scored);
  const selectedAlternative = input.preferredAlternative ?? "ENGINEER_PREFERRED";
  const selectedCandidate = alternatives[selectedAlternative] ?? alternatives.ENGINEER_PREFERRED ?? scored[0];
  const snapId = createId("constructability-snap");
  const snapEvidence: ConstructabilityAwareSnapEvidence = {
    generatedBy: "ConstructabilityAwareSnapEngine",
    generatedAt: nowIso(),
    doctrine: [
      "Attachment Authority determines where a route may originate.",
      "Constructability-aware snapping determines where construction should originate.",
      "Reference layers influence scoring but do not establish network authority.",
    ],
    selectedCandidateId: selectedCandidate.candidateId,
    selectedCandidateType: selectedCandidate.candidateType,
    selectedAlternative,
    candidates: scored,
    alternatives: Object.fromEntries(Object.entries(alternatives).map(([key, candidate]) => [key, candidate?.candidateId])) as Partial<Record<ConstructabilitySnapAlternative, string>>,
    constraintRegistrySnapshot: input.constraintRegistrySnapshot,
    attachmentAuthority: input.attachmentAuthority,
    notes: [
      `${scored.length} attachment candidates evaluated.`,
      `Selected ${selectedCandidate.label} using ${selectedAlternative}.`,
      `Selected constructability score ${selectedCandidate.scores.constructabilityScore}/100.`,
    ],
    futureHooks: FUTURE_HOOKS,
  };
  return {
    snapId,
    attachmentCoordinate: selectedCandidate.attachmentCoordinate,
    snapMethod: methodForType(selectedCandidate.candidateType),
    snapConfidence: confidenceFor(selectedCandidate, input.attachmentAuthority),
    snapEvidence,
    constructabilityScore: selectedCandidate.scores.constructabilityScore,
    selectedAlternative,
    selectedCandidate,
    candidates: scored,
    alternatives,
    attachmentCorridorEvidence: corridorEvidenceFor(selectedCandidate),
    futureHooks: FUTURE_HOOKS,
  };
}
