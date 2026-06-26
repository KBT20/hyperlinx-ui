import type { DesignLaunchSession } from "../design/DesignLaunchSession";
import { resolveDesignDoctrineForSession } from "../designDoctrine/DesignDoctrineEngine";
import type { NetworkClass } from "../designDoctrine/NetworkClass";
import type { TeralinxPrimaryProduct } from "../teralinx/TeralinxDesignIntent";
import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";
import type { DALCoordinate } from "../types/dal";
import type { RouteCandidate, RouteCandidateNode, RouteCandidateNodeType } from "./RouteCandidate";
import type { RouteConstraint, RouteConstraintType, EngineeringConstraintCandidate } from "./RouteConstraint";
import { routeGenerationDiagnostic } from "./RouteGenerationDiagnostics";
import type { RouteSegment, RouteConstructionMethod } from "./RouteSegment";
import type { RouteStatistics } from "./RouteStatistics";

type ResolvedEndpoint = {
  coordinate: DALCoordinate;
  confidence: number;
  method: "INPUT_COORDINATE" | "FIXTURE_ADDRESS_LOOKUP" | "DETERMINISTIC_TEXT_FALLBACK";
};

const KNOWN_COORDINATES: Array<{ tokens: string[]; coordinate: DALCoordinate; confidence: number }> = [
  { tokens: ["dallas", "stemmons"], coordinate: [-96.8385, 32.8065], confidence: 88 },
  { tokens: ["dallas"], coordinate: [-96.797, 32.7767], confidence: 82 },
  { tokens: ["temple"], coordinate: [-97.3428, 31.0256], confidence: 84 },
  { tokens: ["austin pop"], coordinate: [-97.7431, 30.2672], confidence: 92 },
  { tokens: ["611 walker", "austin"], coordinate: [-97.7278, 30.2609], confidence: 72 },
  { tokens: ["downtown austin"], coordinate: [-97.7392, 30.2655], confidence: 80 },
  { tokens: ["austin"], coordinate: [-97.7431, 30.2672], confidence: 82 },
  { tokens: ["wichita falls"], coordinate: [-98.4934, 33.9137], confidence: 84 },
  { tokens: ["lawton"], coordinate: [-98.3959, 34.6087], confidence: 84 },
];

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceFeet(a: DALCoordinate, b: DALCoordinate) {
  const earthRadiusFeet = 20_902_231;
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusFeet * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function midpoint(a: DALCoordinate, b: DALCoordinate, ratio: number): DALCoordinate {
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

function addOffset(coordinate: DALCoordinate, lonOffset: number, latOffset: number): DALCoordinate {
  return [Number((coordinate[0] + lonOffset).toFixed(6)), Number((coordinate[1] + latOffset).toFixed(6))];
}

function textHash(text: string) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function siteText(site: TeralinxSite) {
  return `${site.facilityName ?? ""} ${site.address ?? ""}`.trim().toLowerCase();
}

function resolveEndpoint(site: TeralinxSite, fallbackIndex: number): ResolvedEndpoint {
  if (Number.isFinite(site.latitude) && Number.isFinite(site.longitude)) {
    return { coordinate: [Number(site.longitude), Number(site.latitude)], confidence: 96, method: "INPUT_COORDINATE" };
  }

  const text = siteText(site);
  const match = KNOWN_COORDINATES.find((item) => item.tokens.every((token) => text.includes(token)));
  if (match) return { coordinate: match.coordinate, confidence: match.confidence, method: "FIXTURE_ADDRESS_LOOKUP" };

  const hash = textHash(text || site.siteId);
  const base: DALCoordinate = [-97.4, 31.8];
  const lonOffset = ((hash % 120) - 60) / 100;
  const latOffset = (((hash / 7) % 90) - 45) / 100;
  return {
    coordinate: addOffset(base, lonOffset + fallbackIndex * 0.35, latOffset - fallbackIndex * 0.2),
    confidence: 42,
    method: "DETERMINISTIC_TEXT_FALLBACK",
  };
}

function routeGeometryForDoctrine(a: DALCoordinate, z: DALCoordinate, networkClass: NetworkClass): DALCoordinate[] {
  if (networkClass === "LONG_HAUL") {
    return [a, addOffset(midpoint(a, z, 0.22), 0.08, -0.04), addOffset(midpoint(a, z, 0.48), -0.06, 0.05), addOffset(midpoint(a, z, 0.74), 0.04, -0.03), z];
  }
  if (networkClass === "MIDDLE_MILE") {
    return [a, addOffset(midpoint(a, z, 0.33), 0.05, 0.03), addOffset(midpoint(a, z, 0.66), -0.04, -0.02), z];
  }
  if (networkClass === "CAMPUS") {
    return [a, addOffset(midpoint(a, z, 0.45), 0.004, 0.006), addOffset(midpoint(a, z, 0.7), -0.003, 0.004), z];
  }
  return [a, addOffset(midpoint(a, z, 0.32), 0.01, -0.006), addOffset(midpoint(a, z, 0.68), -0.008, 0.006), z];
}

function constructionMethod(networkClass: NetworkClass): RouteConstructionMethod {
  if (networkClass === "LONG_HAUL") return "BURIED_BACKBONE";
  if (networkClass === "MIDDLE_MILE") return "BURIED_MIDDLE_MILE";
  if (networkClass === "CAMPUS") return "CAMPUS_DUCT";
  return "URBAN_UNDERGROUND";
}

function estimatedCostPerFoot(method: RouteConstructionMethod) {
  if (method === "URBAN_UNDERGROUND") return 58;
  if (method === "CAMPUS_DUCT") return 74;
  if (method === "BURIED_MIDDLE_MILE") return 38;
  if (method === "BURIED_BACKBONE") return 31;
  return 45;
}

function productFeet(product: TeralinxPrimaryProduct | undefined, lengthFeet: number) {
  return {
    estimatedFiberFeet: product === "DUCT" ? 0 : Math.round(lengthFeet),
    estimatedDuctFeet: product === "FIBER" ? 0 : Math.round(lengthFeet),
  };
}

function nearestKnownUrban(coordinate: DALCoordinate) {
  const urbanCenters: Array<{ name: string; coordinate: DALCoordinate; radiusMiles: number }> = [
    { name: "Dallas Urban Area", coordinate: [-96.797, 32.7767], radiusMiles: 35 },
    { name: "Austin Urban Area", coordinate: [-97.7431, 30.2672], radiusMiles: 25 },
    { name: "Temple Urban Area", coordinate: [-97.3428, 31.0256], radiusMiles: 16 },
    { name: "Wichita Falls Urban Area", coordinate: [-98.4934, 33.9137], radiusMiles: 16 },
    { name: "Lawton Urban Area", coordinate: [-98.3959, 34.6087], radiusMiles: 16 },
  ];
  return urbanCenters.find((center) => distanceFeet(coordinate, center.coordinate) / 5280 <= center.radiusMiles);
}

function constraintCost(type: RouteConstraintType) {
  if (type === "RAILROAD_CROSSING") return 95_000;
  if (type === "MAJOR_HIGHWAY_CROSSING") return 72_000;
  if (type === "STATE_HIGHWAY_CROSSING") return 42_000;
  if (type === "RIVER_CREEK_CROSSING" || type === "LARGE_WATER_BODY" || type === "BRIDGE_CROSSING") return 68_000;
  if (type === "ENVIRONMENTAL_AREA") return 36_000;
  if (type === "UTILITY_CORRIDOR") return 28_000;
  if (type === "URBAN_AREA") return 18_000;
  return 8_000;
}

function makeConstraint(type: RouteConstraintType, segmentId: string, location: DALCoordinate, confidence: number, basis: string): RouteConstraint {
  return {
    constraintId: `${segmentId}:${type}`,
    constraintType: type,
    segmentId,
    estimatedLocation: location,
    estimatedCost: constraintCost(type),
    confidence,
    classificationBasis: basis,
    estimatedOnly: true,
  };
}

function estimateConstraints(segmentId: string, start: DALCoordinate, end: DALCoordinate, lengthFeet: number, segmentIndex: number, networkClass: NetworkClass): RouteConstraint[] {
  const mid = midpoint(start, end, 0.5);
  const constraints: RouteConstraint[] = [];
  const lengthMiles = lengthFeet / 5280;
  const urban = nearestKnownUrban(mid);

  if (urban) constraints.push(makeConstraint("URBAN_AREA", segmentId, mid, 72, `Segment midpoint enters ${urban.name} fixture radius.`));
  if (lengthMiles > 25) constraints.push(makeConstraint("MAJOR_HIGHWAY_CROSSING", segmentId, addOffset(mid, 0.01, -0.01), 64, "Long span likely crosses a major roadway."));
  if (lengthMiles > 8 && networkClass !== "CAMPUS") constraints.push(makeConstraint("STATE_HIGHWAY_CROSSING", segmentId, addOffset(mid, -0.01, 0.01), 58, "Inter-community span likely crosses a state highway."));
  if (lengthMiles > 35 && segmentIndex % 2 === 0) constraints.push(makeConstraint("RAILROAD_CROSSING", segmentId, addOffset(mid, 0.015, 0.012), 54, "Long uninterrupted span flagged as probable rail interface."));
  if (Math.abs(start[1] - end[1]) > 0.45 || Math.abs(start[0] - end[0]) > 0.5) constraints.push(makeConstraint("RIVER_CREEK_CROSSING", segmentId, addOffset(mid, -0.012, -0.008), 52, "Large coordinate delta flagged as probable waterway crossing."));
  if (networkClass === "LONG_HAUL" && segmentIndex === 1) constraints.push(makeConstraint("UTILITY_CORRIDOR", segmentId, addOffset(mid, 0.018, -0.004), 48, "Backbone corridor segment flagged for utility interface review."));
  if (networkClass === "METRO" && lengthMiles > 2.5) constraints.push(makeConstraint("BRIDGE_CROSSING", segmentId, addOffset(mid, -0.006, 0.006), 46, "Metro span flagged for possible bridge review."));
  if (!constraints.length) constraints.push(makeConstraint("UNKNOWN_CONSTRAINT", segmentId, mid, 35, "No deterministic heuristic classified this segment with sufficient confidence."));

  return constraints;
}

function nodeTypeForIndex(index: number, total: number): RouteCandidateNodeType {
  if (index === 0) return "A_SITE";
  if (index === total - 1) return "Z_SITE";
  return "ROUTE_POINT";
}

function routeNode(routeCandidateId: string, index: number, total: number, coordinate: DALCoordinate, name?: string): RouteCandidateNode {
  const nodeType = nodeTypeForIndex(index, total);
  return {
    nodeId: `${routeCandidateId}:NODE:${index}:${nodeType}`,
    nodeType,
    name: name ?? (nodeType === "A_SITE" ? "A Site" : nodeType === "Z_SITE" ? "Z Site" : `Route Point ${index}`),
    coordinate,
    stationLabel: nodeType === "A_SITE" ? "A Site" : nodeType === "Z_SITE" ? "Z Site" : `Route Point ${index}`,
    estimatedCost: nodeType === "ROUTE_POINT" ? 0 : 42_000,
    confidence: nodeType === "ROUTE_POINT" ? 68 : 82,
    metadata: { generatedBy: "RouteGenerationEngine" },
    estimatedOnly: true,
  };
}

function infrastructureNodes(routeCandidateId: string, geometry: DALCoordinate[], statisticsSeedFeet: number, networkClass: NetworkClass): RouteCandidateNode[] {
  const nodes: RouteCandidateNode[] = [];
  const vaultSamples = Math.min(4, Math.max(1, Math.round(statisticsSeedFeet / 125_000)));
  for (let index = 1; index <= vaultSamples; index += 1) {
    const coordinate = geometry[Math.min(index, geometry.length - 2)] ?? midpoint(geometry[0], geometry[geometry.length - 1], index / (vaultSamples + 1));
    nodes.push({
      nodeId: `${routeCandidateId}:INFRA:VAULT:${index}`,
      nodeType: "VAULT",
      name: `Estimated Vault ${index.toString().padStart(2, "0")}`,
      coordinate,
      stationLabel: `VLT-${index.toString().padStart(2, "0")}`,
      estimatedCost: 18_500,
      confidence: 62,
      metadata: { estimatedOnly: true, networkClass },
      estimatedOnly: true,
    });
  }
  if (networkClass === "LONG_HAUL" && statisticsSeedFeet > 250_000) {
    const coordinate = geometry[Math.floor(geometry.length / 2)] ?? midpoint(geometry[0], geometry[geometry.length - 1], 0.5);
    nodes.push({
      nodeId: `${routeCandidateId}:INFRA:REGEN:1`,
      nodeType: "REGENERATION_SITE",
      name: "Estimated Regen 01",
      coordinate,
      stationLabel: "REG-01",
      estimatedCost: 125_000,
      confidence: 58,
      metadata: { estimatedOnly: true, networkClass },
      estimatedOnly: true,
    });
  }
  return nodes;
}

function buildSegments(routeCandidateId: string, geometry: DALCoordinate[], routeNodes: RouteCandidateNode[], product: TeralinxPrimaryProduct | undefined, networkClass: NetworkClass): RouteSegment[] {
  return geometry.slice(0, -1).map((start, index) => {
    const end = geometry[index + 1];
    const segmentId = `${routeCandidateId}:SEGMENT:${index + 1}`;
    const estimatedLength = Math.round(distanceFeet(start, end));
    const method = constructionMethod(networkClass);
    const feet = productFeet(product, estimatedLength);
    const constraints = estimateConstraints(segmentId, start, end, estimatedLength, index, networkClass);
    const constraintCostTotal = constraints.reduce((sum, constraint) => sum + constraint.estimatedCost, 0);
    return {
      segmentId,
      fromNode: routeNodes[index]?.nodeId ?? `${routeCandidateId}:NODE:${index}`,
      toNode: routeNodes[index + 1]?.nodeId ?? `${routeCandidateId}:NODE:${index + 1}`,
      geometry: [start, end],
      estimatedLength,
      roadName: networkClass === "METRO" ? `Estimated Metro Corridor ${index + 1}` : networkClass === "CAMPUS" ? `Estimated Campus Path ${index + 1}` : undefined,
      county: networkClass === "LONG_HAUL" ? "Estimated multi-county corridor" : undefined,
      constructionMethod: method,
      estimatedFiberFeet: feet.estimatedFiberFeet,
      estimatedDuctFeet: feet.estimatedDuctFeet,
      estimatedCost: Math.round(estimatedLength * estimatedCostPerFoot(method) + constraintCostTotal),
      confidence: Math.max(42, Math.round(76 - constraints.filter((constraint) => constraint.constraintType !== "URBAN_AREA").length * 6)),
      constraints,
      engineeringNotes: [
        "Sales route candidate only.",
        "Constraint and construction quantities require Route Engineering verification.",
      ],
      estimatedOnly: true,
    };
  });
}

function buildEngineeringCandidates(routeCandidateId: string, constraints: RouteConstraint[]): EngineeringConstraintCandidate[] {
  return constraints.map((constraint) => ({
    constraintId: constraint.constraintId,
    constraintType: constraint.constraintType,
    estimatedLocation: constraint.estimatedLocation,
    confidence: constraint.confidence,
    engineeringStatus: "PENDING_VERIFICATION",
    sourceRouteCandidateId: routeCandidateId,
    sourceSegmentId: constraint.segmentId,
    estimatedOnly: true,
  }));
}

function buildStatistics(segments: RouteSegment[], nodes: RouteCandidateNode[], networkClass: NetworkClass): RouteStatistics {
  const totalRouteLengthFeet = segments.reduce((sum, segment) => sum + segment.estimatedLength, 0);
  const constraints = segments.flatMap((segment) => segment.constraints);
  const estimatedRegenSpacingFeet = networkClass === "LONG_HAUL" ? 60 * 5280 : networkClass === "MIDDLE_MILE" ? 45 * 5280 : Number.POSITIVE_INFINITY;
  const confidenceValues = [...segments.map((segment) => segment.confidence), ...constraints.map((constraint) => constraint.confidence), ...nodes.map((node) => node.confidence)];
  return {
    totalRouteLengthFeet,
    totalRouteLengthMiles: Number((totalRouteLengthFeet / 5280).toFixed(2)),
    fiberFeet: segments.reduce((sum, segment) => sum + segment.estimatedFiberFeet, 0),
    ductFeet: segments.reduce((sum, segment) => sum + segment.estimatedDuctFeet, 0),
    estimatedStationCount: Math.max(2, Math.ceil(totalRouteLengthFeet / 1000)),
    estimatedVaultCount: Math.max(nodes.filter((node) => node.nodeType === "VAULT").length, Math.ceil(totalRouteLengthFeet / 18_000)),
    estimatedRegenCount: Number.isFinite(estimatedRegenSpacingFeet) ? Math.max(0, Math.floor(totalRouteLengthFeet / estimatedRegenSpacingFeet)) : 0,
    estimatedHighwayCrossings: constraints.filter((constraint) => constraint.constraintType === "MAJOR_HIGHWAY_CROSSING" || constraint.constraintType === "STATE_HIGHWAY_CROSSING").length,
    estimatedRailroadCrossings: constraints.filter((constraint) => constraint.constraintType === "RAILROAD_CROSSING").length,
    estimatedWaterCrossings: constraints.filter((constraint) => constraint.constraintType === "RIVER_CREEK_CROSSING" || constraint.constraintType === "LARGE_WATER_BODY" || constraint.constraintType === "BRIDGE_CROSSING").length,
    estimatedUrbanSegments: segments.filter((segment) => segment.constraints.some((constraint) => constraint.constraintType === "URBAN_AREA")).length,
    estimatedRuralSegments: segments.filter((segment) => !segment.constraints.some((constraint) => constraint.constraintType === "URBAN_AREA")).length,
    estimatedConstructionCost: Math.round(segments.reduce((sum, segment) => sum + segment.estimatedCost, 0) + nodes.reduce((sum, node) => sum + node.estimatedCost, 0)),
    confidenceScore: Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, confidenceValues.length)),
    estimatedOnly: true,
  };
}

export function generateRouteCandidate(session: DesignLaunchSession): RouteCandidate {
  const routeCandidateId = `RC-${session.launchId}`;
  const appliedDoctrine = resolveDesignDoctrineForSession(session);
  const aSite = session.siteList.find((site) => site.role === "A_SITE") ?? session.siteList[0];
  const zSite = session.siteList.find((site) => site.role === "Z_SITE") ?? session.siteList[session.siteList.length - 1];
  const aEndpoint = resolveEndpoint(aSite, 0);
  const zEndpoint = resolveEndpoint(zSite, 1);
  const geometry = routeGeometryForDoctrine(aEndpoint.coordinate, zEndpoint.coordinate, appliedDoctrine.networkClass);
  const baseNodes = geometry.map((coordinate, index) =>
    routeNode(
      routeCandidateId,
      index,
      geometry.length,
      coordinate,
      index === 0 ? aSite?.facilityName || "A Site" : index === geometry.length - 1 ? zSite?.facilityName || "Z Site" : undefined,
    ),
  );
  const preliminaryLengthFeet = geometry.slice(0, -1).reduce((sum, coordinate, index) => sum + distanceFeet(coordinate, geometry[index + 1]), 0);
  const generatedInfrastructureNodes = infrastructureNodes(routeCandidateId, geometry, preliminaryLengthFeet, appliedDoctrine.networkClass);
  const nodes = [...baseNodes, ...generatedInfrastructureNodes];
  const segments = buildSegments(routeCandidateId, geometry, baseNodes, session.primaryProduct, appliedDoctrine.networkClass);
  const constraints = segments.flatMap((segment) => segment.constraints);
  const engineeringConstraintCandidates = buildEngineeringCandidates(routeCandidateId, constraints);
  const statistics = buildStatistics(segments, nodes, appliedDoctrine.networkClass);
  const diagnostics = [
    routeGenerationDiagnostic("ROUTE_ENDPOINT_RESOLVED", "INFO", "Route candidate endpoints resolved deterministically.", routeCandidateId, {
      aEndpoint,
      zEndpoint,
    }),
    routeGenerationDiagnostic("ROUTE_SEGMENTS_GENERATED", "INFO", "Route candidate segments generated from Layer 1 doctrine.", routeCandidateId, {
      segmentCount: segments.length,
    }),
    routeGenerationDiagnostic("ROUTE_CONSTRAINTS_ESTIMATED", "INFO", "Sales constraints estimated using deterministic heuristics.", routeCandidateId, {
      constraintCount: constraints.length,
    }),
    routeGenerationDiagnostic("ROUTE_STATISTICS_GENERATED", "INFO", "Route statistics generated for sales estimate.", routeCandidateId, { ...statistics }),
    routeGenerationDiagnostic("ROUTE_CANDIDATE_CREATED", "INFO", "RouteCandidate created for customer discussion and preliminary proposal.", routeCandidateId, {
      designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
      networkClass: appliedDoctrine.networkClass,
    }),
  ];

  return {
    routeCandidateId,
    sourceDesignLaunchId: session.launchId,
    designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
    networkClass: appliedDoctrine.networkClass,
    topology: appliedDoctrine.topology,
    protectionClass: appliedDoctrine.protection,
    geometry,
    nodes,
    segments,
    constraints,
    engineeringConstraintCandidates,
    statistics,
    estimatedConstructionProfile: appliedDoctrine.constructionProfileId,
    estimatedMaterialProfile: appliedDoctrine.materialProfileId,
    estimatedFacilityProfile: appliedDoctrine.facilityProfileId,
    generatedAt: new Date().toISOString(),
    diagnostics,
    salesEstimate: true,
    engineeringCertificationRequired: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noPersistence: true,
  };
}
