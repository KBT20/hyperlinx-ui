import { buildPathForAttachment } from "../affinity/buildPathEngine";
import { haversineFeet } from "../affinity/geo";
import { findNearestNode } from "../affinity/nearestNodeEngine";
import { findNearestRoute } from "../affinity/nearestRouteEngine";
import { findNearestStation } from "../affinity/nearestStationEngine";
import { resolveConstructabilityAwareSnap, type ConstructabilityAwareSnapResult } from "../attachment/ConstructabilityAwareSnapEngine";
import { resolveAttachmentAuthority, type AttachmentAuthorityResult } from "../attachment/AttachmentAuthorityEngine";
import { deriveRouteCertificationState } from "../certification/CertificationAuthority";
import { certifySiteDecision } from "../engineering/certificationEngine";
import { DEFAULT_CONSTRUCTION_TYPE, estimateBuriedConstructionCost } from "../engineering/constructionModel";
import { renderConstraintAnalysis, analyzeRouteConstraints, type ConstraintAnalysisResult } from "../routing/ConstraintAnalysisEngine";
import { boundsForRouteGeometry, getConstraintRegistryAnalysisContext, streetCenterlinesFromConstraintFeatures } from "../reference/ConstraintGeometryRegistry";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryEdge, InventoryGraph, InventoryNode, InventoryRoute, InventoryStation, ScopeVersion } from "../types/dal";
import type { MapKernelRenderSpec, MapKernelPrimitive } from "../mapkernel";
import { createScopeVersionFromInventoryGraph } from "../scopeversion/scopeVersionUtils";
import { buildDeterministicStreetCenterlines } from "../street/StreetCenterlineLayer";
import { resolveSnapAuthority } from "../street/SnapAuthorityEngine";
import type { SnapAuthorityResult, SnapCertificationSnapshot, StreetCenterline } from "../street/streetTypes";
import { snapSiteToStreet, type StreetSnapResult } from "./streetSnapEngine";
import { buildDiverseStreetPath, buildStreetConstrainedPath, createEditedStreetPath, type StreetPathResult } from "./streetPathEngine";
import type { RouteCertificationSnapshot } from "./routeCertification";

export type ServiceabilityNearestStation = {
  stationId: string;
  station: string;
  lat: number;
  lon: number;
  distanceFeet: number;
};

export type ServiceabilityNearestNode = {
  nodeId: string;
  lat: number;
  lon: number;
  distanceFeet: number;
};

export type ServiceabilityNearestEdge = {
  edgeId: string;
  routeId?: string;
  distanceFeet: number;
  projectedLat: number;
  projectedLon: number;
};

export type ServiceabilityAnalysisResult = {
  sourceScopeVersionId: string;
  siteId: string;
  siteName: string;
  status: "READY" | "FAILED_GEOCODE" | "NON_SERVICEABLE";
  reason?: string;
  candidateCoordinate?: DALCoordinate;
  nearestRoute?: {
    routeId: string;
    routeName: string;
    lat: number;
    lon: number;
    distanceFeet: number;
  };
  nearestStation?: ServiceabilityNearestStation;
  nearestNode?: ServiceabilityNearestNode;
  nearestEdge?: ServiceabilityNearestEdge;
  geocodeStatus: {
    status: CandidateSite["geocodeStatus"] | "UNCERTIFIED";
    method?: CandidateSite["geocodeMethod"];
    provider?: string;
    confidence?: number;
    certifiedBy?: string;
    certifiedAt?: string;
  };
  streetSnap?: StreetSnapResult;
  streetCenterlines?: StreetCenterline[];
  snapAuthority?: SnapAuthorityResult;
  attachmentAuthority?: AttachmentAuthorityResult;
  constraintAnalysis?: ConstraintAnalysisResult;
  attachmentPoint?: {
    attachmentId: string;
    routeId: string;
    routeSegmentId: string;
    nodeId: string;
    stationId: string;
    lat: number;
    lon: number;
    distanceFeet: number;
    confidenceScore: number;
    certificationStatus: string;
  };
  lateralPath?: StreetPathResult & { constructionType: "BURIED"; feet: number };
  diverseLateralPath?: StreetPathResult & { constructionType: "BURIED"; feet: number };
  economics?: {
    buildFeet: number;
    constructionCost: number;
    NRC: number;
    MRC: number;
    TCV: number;
    margin: number;
    payback: number;
    ROI: number;
  };
  certificationReadiness: {
    hasCertifiedGeocode: boolean;
    hasStreetSnap: boolean;
    hasCertifiedStreetSnap?: boolean;
    hasAttachment: boolean;
    hasLateral: boolean;
    hasStationReference: boolean;
    hasParentScopeVersion: boolean;
    canCreateCandidateScopeVersion: boolean;
  };
  certificationStages?: {
    GEOCODE_CERTIFIED: boolean;
    STREET_SNAP_CERTIFIED: boolean;
    ATTACHMENT_CERTIFIED: boolean;
  };
  diagnostics: {
    routeCount: number;
    nodeCount: number;
    edgeCount: number;
    stationCount: number;
    parentScopeVersionId: string;
    attachmentId?: string;
    attachmentAuthority?: string;
    attachmentMethod?: string;
    serviceabilityStatus?: string;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isCoordinate(value: unknown): value is DALCoordinate {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function validSiteCoordinate(site: CandidateSite): DALCoordinate | null {
  const lat = Number(site.latitude);
  const lon = Number(site.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lon, lat];
}

function emptyReadiness() {
  return {
    hasCertifiedGeocode: false,
    hasStreetSnap: false,
    hasCertifiedStreetSnap: false,
    hasAttachment: false,
    hasLateral: false,
    hasStationReference: false,
    hasParentScopeVersion: false,
    canCreateCandidateScopeVersion: false,
  };
}

function graphSummary(scopeVersion: ScopeVersion, graph?: InventoryGraph) {
  return {
    routeCount: graph?.routes.length ?? Number(scopeVersion.graphSummary?.routeCount ?? 0),
    nodeCount: graph?.nodes.length ?? Number(scopeVersion.graphSummary?.nodeCount ?? 0),
    edgeCount: graph?.edges.length ?? Number(scopeVersion.graphSummary?.edgeCount ?? 0),
    stationCount: graph?.stations.length ?? Number(scopeVersion.graphSummary?.stationCount ?? 0),
  };
}

function inventoryGraphFromScopeVersion(scopeVersion: ScopeVersion): InventoryGraph | null {
  const truth = asRecord(scopeVersion.canonicalTruth);
  const metadata = asRecord(truth.inventoryGraphReference);
  const routes = asArray<InventoryRoute>(truth.routes ?? asRecord(truth.network).routes);
  const nodes = asArray<InventoryNode>(truth.nodes ?? asRecord(truth.network).nodes);
  const edges = asArray<InventoryEdge>(truth.edges ?? asRecord(truth.network).edges);
  const stations = asArray<InventoryStation>(truth.stations ?? asRecord(truth.network).stations);
  if (!routes.length && !nodes.length && !edges.length && !stations.length) return null;
  return {
    inventoryId: String(scopeVersion.inventoryId ?? scopeVersion.sourceInventoryId ?? metadata.inventoryId ?? scopeVersion.scopeVersionId),
    graphId: String(scopeVersion.graphId ?? metadata.graphId ?? scopeVersion.scopeVersionId),
    scopeVersionId: scopeVersion.scopeVersionId,
    metadata: {
      inventoryId: String(scopeVersion.inventoryId ?? metadata.inventoryId ?? scopeVersion.scopeVersionId),
      graphId: String(scopeVersion.graphId ?? metadata.graphId ?? scopeVersion.scopeVersionId),
      scopeVersionId: scopeVersion.scopeVersionId,
      name: String(metadata.name ?? scopeVersion.scopeVersionId),
      createdDate: scopeVersion.createdAt,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      stationCount: stations.length,
      routeCount: routes.length,
      routeMiles: Number((truth as { routeMiles?: number }).routeMiles ?? 0),
    },
    nodes,
    edges,
    stations,
    routes,
    validation: { status: "PASS", issues: [] },
    createdAt: scopeVersion.createdAt,
    updatedAt: scopeVersion.updatedAt,
  };
}

export function inventoryScopeVersionFromGraph(graph: InventoryGraph, existingScopeVersion?: ScopeVersion | null): ScopeVersion {
  const base = existingScopeVersion ?? createScopeVersionFromInventoryGraph(graph);
  return {
    ...base,
    scopeVersionId: base.scopeVersionId ?? graph.scopeVersionId ?? graph.metadata.scopeVersionId ?? `SV-INV-${graph.inventoryId}`,
    source: "InventoryGraph",
    type: "INVENTORY",
    inventoryId: graph.inventoryId,
    sourceInventoryId: graph.inventoryId,
    graphId: graph.graphId,
    graphVersion: graph.graphId,
    graphSummary: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      stationCount: graph.stations.length,
      routeCount: graph.routes.length,
    },
    canonicalTruth: {
      ...base.canonicalTruth,
      inventoryGraphReference: {
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        name: graph.metadata.name,
      },
      graphSummary: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        stationCount: graph.stations.length,
        routeCount: graph.routes.length,
      },
      routes: graph.routes,
      nodes: graph.nodes,
      edges: graph.edges,
      stations: graph.stations,
    },
  };
}

function findRoute(graph: InventoryGraph, routeId?: string) {
  return routeId ? graph.routes.find((route) => route.routeId === routeId) : undefined;
}

function findNode(graph: InventoryGraph, nodeId?: string) {
  return nodeId ? graph.nodes.find((node) => node.nodeId === nodeId) : undefined;
}

function findStation(graph: InventoryGraph, stationId?: string) {
  return stationId ? graph.stations.find((station) => station.stationId === stationId) : undefined;
}

function findEdge(graph: InventoryGraph, edgeId?: string) {
  return edgeId ? graph.edges.find((edge) => edge.edgeId === edgeId) : undefined;
}

function geocodeIsCertified(site: CandidateSite) {
  return site.geocodeStatus === "CERTIFIED" || site.geocodeMethod === "HUMAN_APPROVED";
}

function geocodeStatusFor(site: CandidateSite): ServiceabilityAnalysisResult["geocodeStatus"] {
  return {
    status: site.geocodeStatus ?? "UNCERTIFIED",
    method: site.geocodeMethod,
    provider: site.geocodeProvider,
    confidence: site.geocodeConfidence,
    certifiedBy: site.certifiedBy,
    certifiedAt: site.certifiedAt,
  };
}

function economicsForPath(path: StreetPathResult) {
  const cost = estimateBuriedConstructionCost({ buildFeet: path.constructionFeet });
  const nrc = Math.round(cost.totalCost * 1.18 + 15000);
  const mrc = Math.round(850 + path.constructionFeet * 0.58);
  const tcv = nrc + mrc * 60;
  const margin = Math.round(((tcv - cost.totalCost) / Math.max(tcv, 1)) * 100);
  const payback = Math.round((nrc / Math.max(mrc, 1)) * 10) / 10;
  const roi = Math.round(((tcv - cost.totalCost) / Math.max(cost.totalCost, 1)) * 100);
  return {
    buildFeet: path.constructionFeet,
    constructionCost: cost.totalCost,
    NRC: nrc,
    MRC: mrc,
    TCV: tcv,
    margin,
    payback,
    ROI: roi,
  };
}

function withConstruction(path: StreetPathResult): StreetPathResult & { constructionType: "BURIED"; feet: number } {
  return {
    ...path,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    feet: path.constructionFeet,
  };
}

function snapAuthorityFromConstructability(base: SnapAuthorityResult, constructabilitySnap: ConstructabilityAwareSnapResult | null): SnapAuthorityResult {
  if (!constructabilitySnap) return base;
  const selected = constructabilitySnap.selectedCandidate;
  const snapAuthority =
    selected.candidateType === "NEAREST_STATION"
      ? "INVENTORY_STATION"
      : selected.candidateType === "NEAREST_NODE"
        ? "INVENTORY_NODE"
        : selected.candidateType === "NEAREST_EDGE"
          ? "INVENTORY_EDGE"
          : "INVENTORY_ROUTE";
  return {
    ...base,
    snapId: constructabilitySnap.snapId,
    snapAuthority,
    snapMethod: constructabilitySnap.snapMethod,
    snapConfidence: constructabilitySnap.snapConfidence,
    attachmentCoordinate: constructabilitySnap.attachmentCoordinate,
    distanceToAttachmentFeet: Math.round(haversineFeet(base.snappedCoordinate, constructabilitySnap.attachmentCoordinate)),
    constructabilityScore: constructabilitySnap.constructabilityScore,
    selectedAlternative: constructabilitySnap.selectedAlternative,
    selectedCandidateType: selected.candidateType,
    selectedCandidateId: selected.candidateId,
    stationId: selected.stationId,
    nodeId: selected.nodeId,
    edgeId: selected.edgeId,
    routeId: selected.routeId,
    routeSegmentId: selected.routeSegmentId,
    snapEvidence: constructabilitySnap.snapEvidence,
    attachmentCandidates: constructabilitySnap.candidates,
    attachmentCorridorEvidence: constructabilitySnap.attachmentCorridorEvidence,
  };
}

export function updateServiceabilityLateralGeometry(result: ServiceabilityAnalysisResult, geometry: DALCoordinate[]): ServiceabilityAnalysisResult {
  if (!result.lateralPath || geometry.length < 2) return result;
  const lateralPath = withConstruction(createEditedStreetPath(result.lateralPath, geometry));
  const registryContext = getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry(geometry) });
  const constraintAnalysis =
    result.attachmentAuthority && result.candidateCoordinate
      ? analyzeRouteConstraints({
          parentScopeVersionId: result.sourceScopeVersionId,
          candidateSiteId: result.siteId,
          attachmentAuthority: result.attachmentAuthority,
          candidateCoordinate: { lon: result.candidateCoordinate[0], lat: result.candidateCoordinate[1] },
          proposedGeometry: geometry,
          referenceLayers: { streets: result.streetCenterlines ?? [], ...registryContext },
          routeGeometrySource: "ENGINEER_EDITED",
          analysisMode: "ENGINEER_EDITED",
          supersedesEvidenceId: result.constraintAnalysis?.evidenceId,
        })
      : result.constraintAnalysis;
  return {
    ...result,
    lateralPath,
    constraintAnalysis,
    economics: economicsForPath(lateralPath),
    certificationReadiness: {
      ...result.certificationReadiness,
      hasLateral: true,
    },
  };
}

export function analyzeSiteAgainstInventory(site: CandidateSite, inventoryScopeVersion: ScopeVersion): ServiceabilityAnalysisResult {
  const graph = inventoryGraphFromScopeVersion(inventoryScopeVersion);
  const summary = graphSummary(inventoryScopeVersion, graph ?? undefined);
  const coordinate = validSiteCoordinate(site);
  const base = {
    sourceScopeVersionId: inventoryScopeVersion.scopeVersionId,
    siteId: site.candidateId,
    siteName: site.companyName,
    candidateCoordinate: coordinate ?? undefined,
    geocodeStatus: geocodeStatusFor(site),
    diagnostics: {
      ...summary,
      parentScopeVersionId: inventoryScopeVersion.scopeVersionId,
    },
  };
  if (!coordinate) {
    return {
      ...base,
      status: "FAILED_GEOCODE",
      reason: "Site has no valid latitude/longitude.",
      certificationReadiness: emptyReadiness(),
    };
  }
  if (!graph || !graph.edges.length || !graph.stations.length || !graph.nodes.length) {
    return {
      ...base,
      status: "NON_SERVICEABLE",
      reason: "Inventory ScopeVersion does not expose graph collections for serviceability analysis.",
      certificationReadiness: emptyReadiness(),
    };
  }

  const nearestRouteResult = findNearestRoute(graph, coordinate);
  const nearestNodeResult = findNearestNode(graph, coordinate);
  const nearestStationResult = findNearestStation(graph, coordinate);
  const attachmentCandidate = certifySiteDecision({
    site,
    graph,
    routeId: nearestRouteResult.routeId,
    nodeId: nearestNodeResult.nodeId,
    stationId: nearestStationResult.stationId,
  });
  const attachmentCoordinate: DALCoordinate | undefined =
    Number.isFinite(attachmentCandidate.attachmentPoint.longitude) && Number.isFinite(attachmentCandidate.attachmentPoint.latitude)
      ? [attachmentCandidate.attachmentPoint.longitude, attachmentCandidate.attachmentPoint.latitude]
      : nearestRouteResult.coordinate;
  const buildPath = buildPathForAttachment({
    graph,
    site,
    attachmentCoordinate,
    routeId: attachmentCandidate.attachmentPoint.routeId || nearestRouteResult.routeId,
    nodeId: attachmentCandidate.attachmentPoint.nodeId || nearestNodeResult.nodeId,
    stationId: attachmentCandidate.attachmentPoint.stationId || nearestStationResult.stationId,
    attachmentType: "LATERAL",
  });
  const certification = certifySiteDecision({
    site,
    graph,
    buildPath,
    routeId: buildPath.routeId ?? nearestRouteResult.routeId,
    nodeId: buildPath.nodeId ?? nearestNodeResult.nodeId,
    stationId: buildPath.stationId ?? nearestStationResult.stationId,
    buildRisk: buildPath.riskScore,
    permitCount: buildPath.constructabilityAssessment?.permitting.authorities.length,
  });
  const route = findRoute(graph, certification.attachmentPoint.routeId || nearestRouteResult.routeId);
  const node = findNode(graph, certification.attachmentPoint.nodeId || nearestNodeResult.nodeId);
  const station = findStation(graph, certification.attachmentPoint.stationId || nearestStationResult.stationId);
  const edge = findEdge(graph, certification.attachmentPoint.routeSegmentId);
  const streetSnap = snapSiteToStreet({ siteLat: coordinate[1], siteLon: coordinate[0] });
  const nearestEdge = certification.attachmentPoint.routeSegmentId
    ? {
        edgeId: certification.attachmentPoint.routeSegmentId,
        routeId: certification.attachmentPoint.routeId || nearestRouteResult.routeId,
        distanceFeet: certification.attachmentPoint.distanceFeet,
        projectedLat: certification.attachmentPoint.latitude,
        projectedLon: certification.attachmentPoint.longitude,
      }
    : undefined;
  const attachmentPoint = {
    attachmentId: certification.attachmentPoint.attachmentId,
    routeId: certification.attachmentPoint.routeId || nearestRouteResult.routeId || "",
    routeSegmentId: certification.attachmentPoint.routeSegmentId || "",
    nodeId: certification.attachmentPoint.nodeId || nearestNodeResult.nodeId || "",
    stationId: certification.attachmentPoint.stationId || nearestStationResult.stationId || "",
    lat: certification.attachmentPoint.latitude,
    lon: certification.attachmentPoint.longitude,
    distanceFeet: Math.round(certification.attachmentPoint.distanceFeet),
    confidenceScore: certification.attachmentPoint.confidenceScore,
    certificationStatus: certification.attachmentPoint.certificationStatus,
  };
  const attachmentCoord: DALCoordinate = [attachmentPoint.lon, attachmentPoint.lat];
  const initialRegistryContext = getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry([coordinate, attachmentCoord]) });
  const registryStreetCenterlines = streetCenterlinesFromConstraintFeatures(initialRegistryContext.constraintRegistryFeatures);
  const deterministicStreetCenterlines =
    streetSnap
      ? buildDeterministicStreetCenterlines({
          candidateId: site.candidateId,
          candidateCoordinate: coordinate,
          snappedCoordinate: [streetSnap.snapPoint.lon, streetSnap.snapPoint.lat],
          streetName: streetSnap.roadName,
          streetClass: streetSnap.roadClass,
        })
      : [];
  const streetCenterlines = registryStreetCenterlines.length ? [...registryStreetCenterlines, ...deterministicStreetCenterlines] : deterministicStreetCenterlines;
  const attachmentAuthority = resolveAttachmentAuthority({
    candidate: site,
    candidateCoordinate: coordinate,
    inventoryScopeVersion,
    station: station
      ? { stationId: station.stationId, lon: station.lon, lat: station.lat, distanceFeet: nearestStationResult.distanceFeet }
      : { stationId: nearestStationResult.stationId, lon: nearestStationResult.coordinate?.[0], lat: nearestStationResult.coordinate?.[1], distanceFeet: nearestStationResult.distanceFeet },
    node: node
      ? { nodeId: node.nodeId, lon: node.lon, lat: node.lat, distanceFeet: nearestNodeResult.distanceFeet }
      : { nodeId: nearestNodeResult.nodeId, lon: nearestNodeResult.coordinate?.[0], lat: nearestNodeResult.coordinate?.[1], distanceFeet: nearestNodeResult.distanceFeet },
    edge: nearestEdge,
    route: route ? { routeId: route.routeId, coordinates: route.coordinates } : { routeId: nearestRouteResult.routeId, coordinates: nearestRouteResult.coordinate ? [nearestRouteResult.coordinate] : undefined },
    certifiedAttachment: {
      attachmentId: attachmentPoint.attachmentId,
      routeId: attachmentPoint.routeId,
      stationId: attachmentPoint.stationId,
      nodeId: attachmentPoint.nodeId,
      edgeId: attachmentPoint.routeSegmentId,
      lon: attachmentPoint.lon,
      lat: attachmentPoint.lat,
    },
    attachmentCoordinate: attachmentCoord,
  });
  const baseSnapAuthority = resolveSnapAuthority({
    candidateCoordinate: coordinate,
    attachmentCoordinate: attachmentCoord,
    streetCenterlines,
    stationCoordinate: station ? [station.lon, station.lat] : nearestStationResult.coordinate,
    nodeCoordinate: node ? [node.lon, node.lat] : nearestNodeResult.coordinate,
    edgeCoordinate: edge?.coordinates?.[0] ?? nearestRouteResult.coordinate,
    routeCoordinate: nearestRouteResult.coordinate,
  });
  const snapRegistryContext = initialRegistryContext;
  const constructabilitySnap =
    attachmentAuthority
      ? resolveConstructabilityAwareSnap({
          candidateCoordinate: coordinate,
          candidateSnapCoordinate: baseSnapAuthority.snappedCoordinate,
          inventoryScopeVersion,
          attachmentAuthority,
          constraintRegistrySnapshot: snapRegistryContext.constraintRegistrySnapshot,
          constraintRegistryFeatures: snapRegistryContext.constraintRegistryFeatures,
        })
      : null;
  const snapAuthority = snapAuthorityFromConstructability(baseSnapAuthority, constructabilitySnap);
  const selectedAttachmentPoint = {
    ...attachmentPoint,
    routeId: snapAuthority.routeId ?? attachmentPoint.routeId,
    routeSegmentId: snapAuthority.routeSegmentId ?? snapAuthority.edgeId ?? attachmentPoint.routeSegmentId,
    nodeId: snapAuthority.nodeId ?? attachmentPoint.nodeId,
    stationId: snapAuthority.stationId ?? attachmentPoint.stationId,
    lon: snapAuthority.attachmentCoordinate[0],
    lat: snapAuthority.attachmentCoordinate[1],
    distanceFeet: Math.round(snapAuthority.distanceToAttachmentFeet),
    confidenceScore: snapAuthority.snapConfidence,
  };
  const selectedNearestEdge =
    snapAuthority.edgeId || snapAuthority.routeSegmentId
      ? {
          edgeId: snapAuthority.edgeId ?? snapAuthority.routeSegmentId ?? nearestEdge?.edgeId ?? "",
          routeId: snapAuthority.routeId ?? nearestEdge?.routeId,
          distanceFeet: snapAuthority.distanceToAttachmentFeet,
          projectedLat: selectedAttachmentPoint.lat,
          projectedLon: selectedAttachmentPoint.lon,
        }
      : nearestEdge;
  const snapCoordinate = snapAuthority.snappedCoordinate;
  const primaryPath =
    Number.isFinite(snapCoordinate[0]) && Number.isFinite(snapCoordinate[1]) && Number.isFinite(selectedAttachmentPoint.lat) && Number.isFinite(selectedAttachmentPoint.lon)
      ? buildStreetConstrainedPath({
          siteSnapPoint: { lon: snapCoordinate[0], lat: snapCoordinate[1] },
          attachmentPoint: { lat: selectedAttachmentPoint.lat, lon: selectedAttachmentPoint.lon },
          candidatePoint: { lon: coordinate[0], lat: coordinate[1] },
          stationPoint: station ? { lon: station.lon, lat: station.lat } : nearestStationResult.coordinate ? { lon: nearestStationResult.coordinate[0], lat: nearestStationResult.coordinate[1] } : undefined,
          streetCenterlines,
          constraints: { constructionType: DEFAULT_CONSTRUCTION_TYPE },
        })
      : null;
  const diversePath =
    primaryPath
      ? buildDiverseStreetPath({
          siteSnapPoint: { lon: snapCoordinate[0], lat: snapCoordinate[1] },
          attachmentPoint: { lat: selectedAttachmentPoint.lat, lon: selectedAttachmentPoint.lon },
          primaryPath,
        })
      : null;
  const lateralGeometry = primaryPath?.geometry ?? (certification.lateralPath.geometry.length ? certification.lateralPath.geometry : buildPath.geometry);
  const registryContext = getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry(lateralGeometry) });
  const constraintAnalysis =
    attachmentAuthority && lateralGeometry.length >= 2
      ? analyzeRouteConstraints({
          parentScopeVersionId: inventoryScopeVersion.scopeVersionId,
          candidateSiteId: site.candidateId,
          attachmentAuthority,
          candidateCoordinate: { lon: coordinate[0], lat: coordinate[1] },
          proposedGeometry: lateralGeometry,
          referenceLayers: { streets: streetCenterlines, ...registryContext },
          routeGeometrySource: "SERVICEABILITY_PROPOSED",
          analysisMode: "REFERENCE_LAYER_ASSISTED",
        })
      : undefined;
  const hasCertifiedGeocode = geocodeIsCertified(site);
  const hasStreetSnap = Boolean(snapAuthority);
  const readiness = {
    hasCertifiedGeocode,
    hasStreetSnap,
    hasCertifiedStreetSnap: false,
    hasAttachment: certification.attachmentPoint.certificationStatus !== "FAILED" && Boolean(selectedNearestEdge ?? selectedAttachmentPoint),
    hasLateral: Boolean(primaryPath) && certification.lateralPath.certificationStatus !== "FAILED" && lateralGeometry.length >= 2,
    hasStationReference: Boolean(station?.stationId || nearestStationResult.stationId),
    hasParentScopeVersion: Boolean(inventoryScopeVersion.scopeVersionId),
    canCreateCandidateScopeVersion:
      hasCertifiedGeocode &&
      hasStreetSnap &&
      Boolean(primaryPath) &&
      Boolean(inventoryScopeVersion.scopeVersionId) &&
      certification.serviceabilityAssessment.status !== "NOT_SERVICEABLE" &&
      certification.attachmentPoint.certificationStatus !== "FAILED" &&
      certification.lateralPath.certificationStatus !== "FAILED" &&
      lateralGeometry.length >= 2,
  };
  const certificationStages = {
    GEOCODE_CERTIFIED: hasCertifiedGeocode,
    STREET_SNAP_CERTIFIED: false,
    ATTACHMENT_CERTIFIED: readiness.hasAttachment,
  };

  return {
    ...base,
    status: readiness.canCreateCandidateScopeVersion ? "READY" : "NON_SERVICEABLE",
    reason: readiness.canCreateCandidateScopeVersion ? undefined : "Attachment, lateral, or station reference is incomplete.",
    nearestRoute: nearestRouteResult.routeId
      ? {
          routeId: nearestRouteResult.routeId,
          routeName: nearestRouteResult.routeName ?? nearestRouteResult.routeId,
          lat: nearestRouteResult.coordinate?.[1] ?? coordinate[1],
          lon: nearestRouteResult.coordinate?.[0] ?? coordinate[0],
          distanceFeet: Math.round(nearestRouteResult.distanceFeet),
        }
      : undefined,
    nearestStation: (station ?? nearestStationResult.stationId)
      ? {
          stationId: station?.stationId ?? nearestStationResult.stationId ?? "",
          station: station?.label ?? nearestStationResult.stationId ?? "",
          lat: station?.lat ?? nearestStationResult.coordinate?.[1] ?? coordinate[1],
          lon: station?.lon ?? nearestStationResult.coordinate?.[0] ?? coordinate[0],
          distanceFeet: Math.round(nearestStationResult.distanceFeet),
        }
      : undefined,
    nearestNode: (node ?? nearestNodeResult.nodeId)
      ? {
          nodeId: node?.nodeId ?? nearestNodeResult.nodeId ?? "",
          lat: node?.lat ?? nearestNodeResult.coordinate?.[1] ?? coordinate[1],
          lon: node?.lon ?? nearestNodeResult.coordinate?.[0] ?? coordinate[0],
          distanceFeet: Math.round(nearestNodeResult.distanceFeet),
        }
      : undefined,
    nearestEdge: selectedNearestEdge,
    streetSnap: streetSnap ?? undefined,
    streetCenterlines,
    snapAuthority,
    attachmentAuthority: attachmentAuthority ?? undefined,
    constraintAnalysis,
    attachmentPoint: selectedAttachmentPoint,
    lateralPath: primaryPath && lateralGeometry.length >= 2 ? withConstruction(primaryPath) : undefined,
    diverseLateralPath: diversePath && diversePath.diversityStatus !== "DIVERSITY_NOT_AVAILABLE" ? withConstruction(diversePath) : undefined,
    economics: primaryPath ? economicsForPath(primaryPath) : undefined,
    certificationReadiness: readiness,
    certificationStages,
    diagnostics: {
      ...base.diagnostics,
      attachmentId: certification.attachmentPoint.attachmentId,
      attachmentAuthority: attachmentAuthority?.attachmentAuthority,
      attachmentMethod: attachmentAuthority?.attachmentMethod,
      serviceabilityStatus: certification.serviceabilityAssessment.status,
    },
  };
}

function addPoint(
  primitives: MapKernelPrimitive[],
  args: {
    id: string;
    layerId: MapKernelPrimitive["layerId"];
    kind: MapKernelPrimitive["ref"]["kind"];
    coordinate?: DALCoordinate;
    label?: string;
    payload?: unknown;
    style?: MapKernelPrimitive["style"];
    scopeVersionId?: string;
    metadata?: MapKernelPrimitive["metadata"];
  }
) {
  if (!args.coordinate) return;
  primitives.push({
    id: args.id,
    layerId: args.layerId,
    kind: "point",
    coordinate: args.coordinate,
    label: args.label,
    payload: args.payload,
    style: args.style,
    metadata: args.metadata,
    ref: { kind: args.kind, id: args.id, scopeVersionId: args.scopeVersionId },
  });
}

export function renderServiceabilityAnalysis(result: ServiceabilityAnalysisResult, inventoryScopeVersion: ScopeVersion): MapKernelRenderSpec {
  const graph = inventoryGraphFromScopeVersion(inventoryScopeVersion);
  const primitives: MapKernelPrimitive[] = [];
  const route = graph && result.nearestRoute ? findRoute(graph, result.nearestRoute.routeId) : undefined;
  const edge = graph && result.nearestEdge ? findEdge(graph, result.nearestEdge.edgeId) : undefined;
  const siteCoordinate: DALCoordinate | undefined = result.status === "FAILED_GEOCODE" ? undefined : result.candidateCoordinate ?? result.lateralPath?.geometry[0];
  const streetSnapCoordinate: DALCoordinate | undefined = result.snapAuthority?.snappedCoordinate ?? (result.streetSnap ? [result.streetSnap.snapPoint.lon, result.streetSnap.snapPoint.lat] : undefined);
  const attachmentCoordinate: DALCoordinate | undefined = result.attachmentPoint
    ? [result.attachmentPoint.lon, result.attachmentPoint.lat]
    : result.nearestEdge
      ? [result.nearestEdge.projectedLon, result.nearestEdge.projectedLat]
      : result.lateralPath?.geometry[result.lateralPath.geometry.length - 1];

  result.streetCenterlines?.forEach((street) => {
    if (street.geometry.length < 2) return;
    primitives.push({
      id: street.streetId,
      layerId: "streetReference",
      kind: "line",
      coordinates: street.geometry,
      label: street.streetName,
      payload: street,
      metadata: {
        referenceLayer: true,
        minZoom: 13,
        source: street.source ?? "serviceability-street-centerline",
        sourceLayer: "streetReference",
        rootScopeVersionId: result.sourceScopeVersionId,
        renderAuthority: "Geographic Reference",
      },
      ref: { kind: "StreetReference", id: street.streetId, scopeVersionId: result.sourceScopeVersionId },
    });
  });

  if (route?.coordinates?.length) {
    primitives.push({
      id: `${result.sourceScopeVersionId}:nearest-route:${route.routeId}`,
      layerId: "inventory",
      kind: "line",
      coordinates: route.coordinates,
      label: route.name,
      payload: route,
      metadata: { sourceLayer: "inventory", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Inventory Geometry" },
      ref: { kind: "Route", id: route.routeId, scopeVersionId: result.sourceScopeVersionId, routeId: route.routeId },
    });
  }
  if (edge?.coordinates?.length) {
    primitives.push({
      id: `${result.sourceScopeVersionId}:nearest-edge:${edge.edgeId}`,
      layerId: "edge",
      kind: "line",
      coordinates: edge.coordinates,
      label: edge.edgeId,
      payload: edge,
      style: { stroke: "#334155", strokeWidth: 4, opacity: 0.9 },
      metadata: { sourceLayer: "edge", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Inventory Geometry" },
      ref: { kind: "Edge", id: edge.edgeId, scopeVersionId: result.sourceScopeVersionId, edgeId: edge.edgeId, routeId: edge.routeId },
    });
  }
  if (result.lateralPath?.geometry.length) {
    primitives.push({
      id: `${result.siteId}:lateral`,
      layerId: "lateral",
      kind: "line",
      coordinates: result.lateralPath.geometry,
      label: `Street ${result.lateralPath.roadFeet.toLocaleString()} ft / Construction ${result.lateralPath.constructionFeet.toLocaleString()} ft`,
      payload: result.lateralPath,
      metadata: { sourceLayer: "lateral", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Editable Geometry" },
      ref: { kind: "Lateral", id: `${result.siteId}:lateral`, scopeVersionId: result.sourceScopeVersionId },
    });
  }
  if (result.diverseLateralPath?.geometry.length) {
    primitives.push({
      id: `${result.siteId}:diverse-lateral`,
      layerId: "lateral",
      kind: "line",
      coordinates: result.diverseLateralPath.geometry,
      label: `Diverse ${result.diverseLateralPath.separationScore ?? 0}`,
      payload: result.diverseLateralPath,
      style: { stroke: "#8b5cf6", strokeWidth: 3, opacity: 0.75 },
      metadata: { sourceLayer: "lateral", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Editable Geometry" },
      ref: { kind: "Lateral", id: `${result.siteId}:diverse-lateral`, scopeVersionId: result.sourceScopeVersionId },
    });
  }
  const constraintSpec = renderConstraintAnalysis({
    result: result.constraintAnalysis,
    sourceId: result.siteId,
    scopeVersionId: result.sourceScopeVersionId,
  });
  constraintSpec?.primitives.forEach((primitive) => primitives.push(primitive));
  asArray<Record<string, unknown>>(result.snapAuthority?.attachmentCandidates).slice(0, 8).forEach((candidate, index) => {
    const coordinate = candidate.attachmentCoordinate;
    if (!isCoordinate(coordinate)) return;
    primitives.push({
      id: `${result.siteId}:snap-candidate:${String(candidate.candidateId ?? index)}`,
      layerId: "attachment",
      kind: "point",
      coordinate,
      label: `${String(candidate.candidateType ?? "Attachment")} ${Math.round(Number(asRecord(candidate.scores).constructabilityScore ?? 0))}`,
      payload: candidate,
      style: { fill: "#22c55e", stroke: "#14532d", radius: 4, opacity: 0.72 },
      metadata: { sourceLayer: "attachment", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Constructability Evidence" },
      ref: { kind: "Attachment", id: `${result.siteId}:snap-candidate:${String(candidate.candidateId ?? index)}`, scopeVersionId: result.sourceScopeVersionId },
    });
  });
  const corridorGeometry = asArray<DALCoordinate>(asRecord(result.snapAuthority?.attachmentCorridorEvidence).geometry).filter(isCoordinate);
  if (corridorGeometry.length >= 2) {
    primitives.push({
      id: `${result.siteId}:constructability-snap-corridor`,
      layerId: "lateral",
      kind: "line",
      coordinates: corridorGeometry,
      label: `Selected snap corridor ${Math.round(Number(result.snapAuthority?.constructabilityScore ?? 0))}/100`,
      payload: result.snapAuthority?.attachmentCorridorEvidence,
      style: { stroke: "#16a34a", strokeWidth: 3, opacity: 0.82, dasharray: "7 4" },
      metadata: { sourceLayer: "lateral", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Constructability Evidence" },
      ref: { kind: "Lateral", id: `${result.siteId}:constructability-snap-corridor`, scopeVersionId: result.sourceScopeVersionId },
    });
  }
  addPoint(primitives, {
    id: result.siteId,
    layerId: "site",
    kind: "Site",
    coordinate: siteCoordinate,
    label: result.siteName,
    payload: result,
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "site", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Editable Geometry" },
  });
  addPoint(primitives, {
    id: `${result.siteId}:certified-geocode`,
    layerId: "site",
    kind: "Site",
    coordinate: siteCoordinate,
    label: `Raw geocode ${Math.round(Number(result.geocodeStatus.confidence ?? 0) * 100)}%`,
    payload: result.geocodeStatus,
    style: { fill: "#16a34a", stroke: "#ffffff", radius: 4, opacity: 0.9 },
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "site", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Certified Geometry" },
  });
  addPoint(primitives, {
    id: `${result.siteId}:street-snap`,
    layerId: "object",
    kind: "StreetSnap",
    coordinate: streetSnapCoordinate,
    label: `Street snap ${Math.round(Number(result.snapAuthority?.snapConfidence ?? result.streetSnap?.confidence ?? 0) * 100)}%`,
    payload: result.snapAuthority ?? result.streetSnap,
    style: { fill: "#f59e0b", stroke: "#ffffff", radius: 4, opacity: 0.95 },
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "object", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Geographic Reference" },
  });
  addPoint(primitives, {
    id: `${result.siteId}:attachment`,
    layerId: "attachment",
    kind: "Attachment",
    coordinate: attachmentCoordinate,
    label: result.attachmentAuthority?.attachmentMethod ?? "Attachment",
    payload: result.attachmentAuthority ?? result.nearestEdge,
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "attachment", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Inventory Geometry" },
  });
  addPoint(primitives, {
    id: result.nearestStation?.stationId ?? `${result.siteId}:station`,
    layerId: "station",
    kind: "Station",
    coordinate: result.nearestStation ? [result.nearestStation.lon, result.nearestStation.lat] : undefined,
    label: result.nearestStation?.station,
    payload: result.nearestStation,
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "station", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Inventory Geometry" },
  });
  addPoint(primitives, {
    id: result.nearestNode?.nodeId ?? `${result.siteId}:node`,
    layerId: "node",
    kind: "Node",
    coordinate: result.nearestNode ? [result.nearestNode.lon, result.nearestNode.lat] : undefined,
    label: result.nearestNode?.nodeId,
    payload: result.nearestNode,
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "node", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Inventory Geometry" },
  });
  addPoint(primitives, {
    id: result.nearestEdge?.edgeId ?? `${result.siteId}:edge-point`,
    layerId: "edge",
    kind: "Edge",
    coordinate: attachmentCoordinate,
    label: result.nearestEdge?.edgeId,
    payload: result.nearestEdge,
    style: { fill: "#0f172a", stroke: "#ffffff", radius: 5, opacity: 1 },
    scopeVersionId: result.sourceScopeVersionId,
    metadata: { sourceLayer: "edge", rootScopeVersionId: result.sourceScopeVersionId, renderAuthority: "Inventory Geometry" },
  });

  return {
    specId: `serviceability:${result.siteId}`,
    sourceType: "Manual",
    sourceId: result.siteId,
    name: `Serviceability ${result.siteName}`,
    primitives,
    metadata: {
      sourceScopeVersionId: result.sourceScopeVersionId,
      status: result.status,
      certificationReadiness: result.certificationReadiness,
    },
  };
}

export function createCandidateScopeVersionFromServiceability(args: {
  site: CandidateSite;
  inventoryScopeVersion: ScopeVersion;
  result: ServiceabilityAnalysisResult;
  snapCertification: SnapCertificationSnapshot;
  routeCertification: RouteCertificationSnapshot;
  user?: string;
}): ScopeVersion {
  if (!args.result.certificationReadiness.canCreateCandidateScopeVersion || !args.result.lateralPath || !args.result.nearestEdge) {
    throw new Error("Candidate ScopeVersion creation requires attachment, nearest edge, lateral path, and serviceability readiness.");
  }
  const routeCertificationAuthority =
    args.routeCertification.certificationAuthority ??
    deriveRouteCertificationState({
      routeGeometryHash: args.routeCertification.certifiedGeometryHash,
      constraintEvidencePackage: args.routeCertification.constraintEvidencePackage,
      engineerApproval: {
        approved: args.routeCertification.status === "CERTIFIED_ROUTE" || args.routeCertification.status === "PROVISIONALLY_CERTIFIED",
        rejected: args.routeCertification.status === "REJECTED_ROUTE",
        notes: args.routeCertification.certificationNotes,
        certifiedBy: args.routeCertification.engineerName,
        certifiedAt: args.routeCertification.certifiedAt,
      },
    });
  if (!routeCertificationAuthority.canCreateChildScopeVersion || args.routeCertification.certifiedGeometrySnapshot.length < 2) {
    throw new Error(`Child ScopeVersion creation blocked by certification authority: ${routeCertificationAuthority.state}.`);
  }
  if (!args.routeCertification.constraintEvidencePackage || args.routeCertification.constraintEvidencePackage.routeGeometryHash !== args.routeCertification.certifiedGeometryHash) {
    throw new Error("Child ScopeVersion creation requires current ConstraintEvidencePackage matching certified route geometry.");
  }
  if (args.snapCertification.status !== "CERTIFIED_SNAP") {
    throw new Error("Child ScopeVersion creation requires certified street snap reference evidence.");
  }
  const timestamp = nowIso();
  const parentScopeVersionId = args.inventoryScopeVersion.scopeVersionId;
  const scopeVersionId = createId("SV-CAND");
  const certifiedGeometry = args.routeCertification.certifiedGeometrySnapshot;
  const siteCoordinate = validSiteCoordinate(args.site);
  const attachmentCoordinate: DALCoordinate = args.result.attachmentPoint
    ? [args.result.attachmentPoint.lon, args.result.attachmentPoint.lat]
    : [args.result.nearestEdge.projectedLon, args.result.nearestEdge.projectedLat];
  const streetSnapCoordinate: DALCoordinate = args.snapCertification.snappedCoordinate;
  const economics = args.routeCertification.financialModel ?? args.result.economics ?? economicsForPath(args.result.lateralPath);
  const buildFeet = args.routeCertification.lengthFeet || args.result.lateralPath.constructionFeet;
  const constraintEvidencePackage = args.routeCertification.constraintEvidencePackage;
  return {
    scopeVersionId,
    type: "CANDIDATE",
    parentScopeVersionId,
    rootScopeVersionId: args.inventoryScopeVersion.rootScopeVersionId ?? parentScopeVersionId,
    relationshipType: "LATERAL_EXTENSION",
    inventoryId: args.inventoryScopeVersion.inventoryId,
    sourceInventoryId: args.inventoryScopeVersion.sourceInventoryId ?? args.inventoryScopeVersion.inventoryId,
    graphId: args.inventoryScopeVersion.graphId,
    graphVersion: args.inventoryScopeVersion.graphVersion ?? args.inventoryScopeVersion.graphId,
    candidateSiteId: args.site.candidateId,
    createdBy: args.user ?? "DAL Operator",
    source: "GraphExtension",
    status: "DRAFT",
    certificationState: "DRAFT",
    isImmutable: false,
    geometry: certifiedGeometry,
    attachmentPoint: attachmentCoordinate,
    attachmentCoordinates: attachmentCoordinate,
    latitude: args.site.latitude,
    longitude: args.site.longitude,
    buildFeet,
    buildMiles: args.routeCertification.buildMiles || buildFeet / 5280,
    candidateSite: args.site,
    graphSummary: args.inventoryScopeVersion.graphSummary,
    decisionTimestamp: timestamp,
    user: args.user ?? "DAL Operator",
    canonicalTruth: {
      decisionType: "ServiceabilityCandidate",
      parentScopeVersionId,
      graphReference: {
        inventoryId: args.inventoryScopeVersion.inventoryId,
        graphId: args.inventoryScopeVersion.graphId ?? "",
        graphVersion: args.inventoryScopeVersion.graphVersion ?? args.inventoryScopeVersion.graphId ?? "",
      },
      sourceCandidate: {
        candidateSiteId: args.site.candidateId,
        name: args.site.companyName,
        address: [args.site.address, args.site.city, args.site.state, args.site.zipCode].filter(Boolean).join(", "),
      },
      sourceSiteId: args.site.candidateId,
      geocodeCertification: {
        status: args.result.geocodeStatus.status,
        method: args.result.geocodeStatus.method,
        provider: args.result.geocodeStatus.provider,
        confidence: args.result.geocodeStatus.confidence,
        certifiedBy: args.site.certifiedBy ?? args.result.geocodeStatus.certifiedBy ?? args.routeCertification.certifiedBy,
        certifiedAt: args.site.certifiedAt ?? args.result.geocodeStatus.certifiedAt ?? args.routeCertification.certifiedAt,
      },
      snapAuthority: args.snapCertification.snapAuthority,
      snapId: args.snapCertification.snapId,
      snapMethod: args.snapCertification.snapMethod,
      snapConfidence: args.snapCertification.snapConfidence,
      selectedSnapAlternative: args.snapCertification.selectedAlternative,
      selectedSnapCandidateType: args.snapCertification.selectedCandidateType,
      selectedSnapCandidateId: args.snapCertification.selectedCandidateId,
      snappedStreetId: args.snapCertification.streetId,
      snappedStreetName: args.snapCertification.streetName,
      snappedStreetClass: args.snapCertification.streetClass,
      snappedCoordinate: args.snapCertification.snappedCoordinate,
      attachmentCoordinate,
      constructabilityAwareSnap: {
        snapId: args.snapCertification.snapId,
        snapMethod: args.snapCertification.snapMethod,
        snapConfidence: args.snapCertification.snapConfidence,
        constructabilityScore: args.snapCertification.constructabilityScore,
        selectedAlternative: args.snapCertification.selectedAlternative,
        selectedCandidateType: args.snapCertification.selectedCandidateType,
        selectedCandidateId: args.snapCertification.selectedCandidateId,
        snapEvidence: args.snapCertification.snapEvidence,
        attachmentCandidates: args.snapCertification.attachmentCandidates,
        attachmentCorridorEvidence: args.snapCertification.attachmentCorridorEvidence,
      },
      attachmentAuthority: args.result.attachmentAuthority?.attachmentAuthority,
      attachmentMethod: args.result.attachmentAuthority?.attachmentMethod,
      attachmentConfidence: args.result.attachmentAuthority?.attachmentConfidence,
      attachmentAuthorityEvidence: args.result.attachmentAuthority,
      routingMode: args.routeCertification.routingMode,
      routeCertificationState: routeCertificationAuthority.state,
      evidenceGrade: routeCertificationAuthority.evidenceGrade,
      missingConstraintLayers: routeCertificationAuthority.missingConstraintLayers,
      provisional: routeCertificationAuthority.provisional,
      engineerNotes: args.routeCertification.certificationNotes,
      certificationAuthority: routeCertificationAuthority,
      certifiedGeometryHash: args.routeCertification.certifiedGeometryHash,
      constraintEvidenceId: args.routeCertification.constraintEvidenceId,
      constraintEvidencePackage,
      constraintSummary: args.routeCertification.constraintSummary,
      constraints: args.routeCertification.constraints,
      unresolvedConstraints: args.routeCertification.unresolvedConstraints,
      constructabilityScore: constraintEvidencePackage.constructabilityScore,
      certificationReadiness: args.routeCertification.certificationReadiness,
      snapCertification: args.snapCertification,
      snapCertificationId: args.snapCertification.snapCertificationId,
      snapCertificationStatus: args.snapCertification.status,
      streetCenterlines: args.result.streetCenterlines ?? [],
      lateralRole: args.result.lateralPath.lateralRole,
      routeCertificationId: args.routeCertification.routeCertificationId,
      routeCertificationStatus: routeCertificationAuthority.state,
      certifiedGeometrySnapshot: certifiedGeometry,
      routeGeometry: certifiedGeometry,
      streetSnapPoint: streetSnapCoordinate,
      directFeet: args.result.lateralPath.directFeet,
      roadFeet: args.result.lateralPath.roadFeet,
      constructionFeet: buildFeet,
      economics,
      certifiedBy: args.routeCertification.certifiedBy,
      certifiedAt: args.routeCertification.certifiedAt,
      engineerName: args.routeCertification.engineerName,
      certificationNotes: args.routeCertification.certificationNotes,
      routeCertification: args.routeCertification,
      networkBasis: {
        routeId: args.result.nearestRoute?.routeId ?? "",
        nodeId: args.result.nearestNode?.nodeId ?? "",
        stationId: args.result.nearestStation?.stationId ?? "",
        attachmentPoint: attachmentCoordinate,
        attachmentCoordinates: attachmentCoordinate,
        attachmentStrategy: "STREET_CONSTRAINED_LATERAL",
        attachmentAuthority: args.result.attachmentAuthority,
        attachmentMethod: args.result.attachmentAuthority?.attachmentMethod,
        networkAffinityScore: Math.round((args.result.attachmentPoint?.confidenceScore ?? 0) * 100),
        certificationStatus: "CERTIFIED",
        snapAuthority: args.snapCertification,
        constructabilityAwareSnap: args.snapCertification.snapEvidence,
      } as any,
      geographicBasis: {
        candidateLatitude: siteCoordinate?.[1] ?? Number(args.site.latitude),
        candidateLongitude: siteCoordinate?.[0] ?? Number(args.site.longitude),
        geocodeProvider: args.site.geocodeProvider,
        geocodeConfidence: args.site.geocodeConfidence,
        geometry: certifiedGeometry,
        routeGeometry: certifiedGeometry,
        lateralGeometry: certifiedGeometry,
        attachmentGeometry: attachmentCoordinate,
        snappedGeometry: args.snapCertification.snappedCoordinate,
        selectedSnapGeometry: args.snapCertification.attachmentCoordinate,
        attachmentCorridorEvidence: args.snapCertification.attachmentCorridorEvidence,
        streetCenterlines: args.result.streetCenterlines ?? [],
        buildPath: args.result.lateralPath,
        stationGeometry: args.result.nearestStation ? [args.result.nearestStation.lon, args.result.nearestStation.lat] : undefined,
        nodeGeometry: args.result.nearestNode ? [args.result.nearestNode.lon, args.result.nearestNode.lat] : undefined,
      } as any,
      engineeringBasis: {
        buildFeet,
        buildMiles: args.routeCertification.buildMiles || buildFeet / 5280,
        routeCertificationId: args.routeCertification.routeCertificationId,
        routeCertification: args.routeCertification,
        certifiedGeometrySnapshot: certifiedGeometry,
        certifiedGeometryHash: args.routeCertification.certifiedGeometryHash,
        routingMode: args.routeCertification.routingMode,
        routeCertificationState: routeCertificationAuthority.state,
        evidenceGrade: routeCertificationAuthority.evidenceGrade,
        missingConstraintLayers: routeCertificationAuthority.missingConstraintLayers,
        provisional: routeCertificationAuthority.provisional,
        engineerNotes: args.routeCertification.certificationNotes,
        certificationAuthority: routeCertificationAuthority,
        constraintEvidenceId: args.routeCertification.constraintEvidenceId,
        constraintEvidencePackage,
        constraintSummary: args.routeCertification.constraintSummary,
        constraints: args.routeCertification.constraints,
        unresolvedConstraints: args.routeCertification.unresolvedConstraints,
        constructabilityScore: constraintEvidencePackage.constructabilityScore,
        constructabilityAwareSnapScore: args.snapCertification.constructabilityScore,
        constructabilityAwareSnapEvidence: args.snapCertification.snapEvidence,
        attachmentCandidates: args.snapCertification.attachmentCandidates,
        attachmentCorridorEvidence: args.snapCertification.attachmentCorridorEvidence,
        certificationReadiness: args.routeCertification.certificationReadiness,
        constructionType: args.result.lateralPath.constructionType,
        attachmentCertification: args.result.attachmentPoint
          ? {
              attachmentId: args.result.attachmentPoint.attachmentId,
              routeId: args.result.attachmentPoint.routeId,
              routeSegmentId: args.result.attachmentPoint.routeSegmentId,
              nodeId: args.result.attachmentPoint.nodeId,
              stationId: args.result.attachmentPoint.stationId,
              latitude: args.result.attachmentPoint.lat,
              longitude: args.result.attachmentPoint.lon,
              distanceFeet: args.result.attachmentPoint.distanceFeet,
              confidenceScore: args.result.attachmentPoint.confidenceScore,
              certificationStatus: "CERTIFIED",
          }
          : undefined,
      } as any,
      financialBasis: {
        estimatedConstructionCost: economics.constructionCost,
        estimatedEngineeringCost: Math.round(economics.NRC * 0.08),
        estimatedPermitCost: Math.round(args.result.lateralPath.constructionFeet * 3.5),
        estimatedCrossingCost: 0,
        estimatedEnvironmentalCost: Math.round(args.result.lateralPath.constructionFeet * 1.2),
        NRC: economics.NRC,
        MRC: economics.MRC,
        TCV: economics.TCV,
        margin: economics.margin,
        payback: economics.payback,
        ROI: economics.ROI,
      },
      graphSummaryDelta: {
        addedNodeCount: 1,
        addedEdgeCount: 1,
        addedRouteCount: 1,
        addedStationCount: 0,
      },
      nearestStation: args.result.nearestStation,
      nearestNode: args.result.nearestNode,
      nearestEdge: args.result.nearestEdge,
      serviceabilityAnalysis: args.result,
      constitutionalAuthority: "NON_AUTHORITATIVE",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [
      {
        eventId: createId("event"),
        type: "scopeversion.candidate.serviceability.created",
        entityId: scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          parentScopeVersionId,
          siteId: args.site.candidateId,
          relationshipType: "LATERAL_EXTENSION",
          nearestEdgeId: args.result.nearestEdge.edgeId,
          buildFeet: args.result.lateralPath.constructionFeet,
          routeCertificationState: routeCertificationAuthority.state,
          evidenceGrade: routeCertificationAuthority.evidenceGrade,
          provisional: routeCertificationAuthority.provisional,
        },
        createdAt: timestamp,
      },
    ],
  };
}
