import { useEffect, useMemo, useState } from "react";
import {
  createId,
  listCandidateSites,
  listInventoryGraphs,
  listMarketplaceQuotes,
  listOpportunitySeeds,
  loadInventoryGraph,
  now,
  saveCandidateSite,
  saveMarketplaceQuote,
  saveOpportunitySeed,
  saveScopeVersion,
} from "../api/dalClient";
import { haversineFeet } from "../affinity/geo";
import { resolveConstructabilityAwareSnap, type ConstructabilityAwareSnapResult } from "../attachment/ConstructabilityAwareSnapEngine";
import { resolveAttachmentAuthority, type AttachmentAuthorityResult } from "../attachment/AttachmentAuthorityEngine";
import { applyQuoteToScopeVersion, generatePreliminaryQuote } from "../commercial/quoteEngine";
import { deriveRouteCertificationState } from "../certification/CertificationAuthority";
import CertificationAuthorityStrip from "../components/CertificationAuthorityStrip";
import ConstraintEvidenceStrip from "../components/ConstraintEvidenceStrip";
import RouteEngineeringPanel from "../components/RouteEngineeringPanel";
import SnapAuthorityPanel from "../components/SnapAuthorityPanel";
import { useDALState } from "../dal/DALState";
import { geocodeCandidateSite, isValidGeocodeCoordinate, realGeocoderConfigured } from "../geocoding/geocodeEngine";
import { MapKernel, buildMapKernelDiagnostics, renderScopeVersion, type MapKernelRenderSpec, type MapSelection } from "../mapkernel";
import { generateOpportunitySeedForCandidate } from "../prism/opportunityGenerator";
import { boundsForRouteGeometry, constraintFeaturesToReferenceLayers, getConstraintRegistryAnalysisContext } from "../reference/ConstraintGeometryRegistry";
import { renderReferenceLayers } from "../reference/ReferenceLayerManager";
import { generateAttachmentAwareRouteAlternatives, type AttachmentAwareRouteResult } from "../routing/AttachmentAwareRouteEngine";
import { analyzeRouteConstraints, renderConstraintAnalysis } from "../routing/ConstraintAnalysisEngine";
import { canCreateScopeVersionFromRoute, type RouteCertificationSnapshot, type RouteCertificationState } from "../serviceability/routeCertification";
import { buildDeterministicStreetCenterlines, renderStreetCenterlineLayer } from "../street/StreetCenterlineLayer";
import { canUseSnapForRoute, resolveSnapAuthority } from "../street/SnapAuthorityEngine";
import type { SnapAuthorityResult, SnapCertificationSnapshot, SnapCertificationState, StreetCenterline } from "../street/streetTypes";
import { createScopeVersionFromSiteDecision } from "../scopeversion/scopeVersionUtils";
import { validateScopeVersion } from "../scopeversion/scopeVersionValidation";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph, InventoryGraphMetadata, InventoryNode, InventoryRoute, InventoryStation, MarketplaceQuote, ScopeVersion } from "../types/dal";
import type { OpportunitySeed } from "../types/portfolio";

type DecisionEvidence = {
  candidateAddress: string;
  latLon: string;
  geocodeConfidence: string;
  routeId: string;
  stationId: string;
  nodeId: string;
  nearestRoute: string;
  nearestNode: string;
  nearestStation: string;
  distanceToRoute: string;
  buildFeet: string;
  buildMiles: string;
  crossings: string;
  roadCrossings: string;
  railCrossings: string;
  waterCrossings: string;
  permits: string;
  constructionType: string;
  estimatedCost: string;
  nrc: string;
  mrc: string;
  tcv: string;
  roi: string;
  payback: string;
  serviceabilityStatus: string;
  certificationStatus: string;
  attachmentConfidence: string;
  routingMode: string;
  pathConfidence: string;
  roadSegmentCount: string;
  roadNamesTraversed: string;
  roadClassesTraversed: string;
  attachmentMethod: string;
  missingRoutingDependencies: string;
};

type RouteTraceStep = {
  label: string;
  entityId: string;
  coordinate?: DALCoordinate;
};

type DecisionContext = {
  site: CandidateSite;
  seed: OpportunitySeed;
  graph: InventoryGraph;
  route?: InventoryRoute;
  node?: InventoryNode;
  station?: InventoryStation;
  attachmentPoint?: DALCoordinate;
  attachmentAuthority?: AttachmentAuthorityResult;
  buildPath?: NonNullable<OpportunitySeed["buildPath"]>;
  crossings: DecisionCrossing[];
  evidence: DecisionEvidence;
  routeTrace: RouteTraceStep[];
  quoteBasis: MarketplaceQuote | null;
};

type DecisionCrossing = {
  id: string;
  label: string;
  coordinate: DALCoordinate;
  crossingType: "road" | "rail" | "water" | "unknown";
  kind: "crossing";
  payload?: unknown;
};

type DecisionDiagnostics = {
  serviceability: "SERVICEABLE" | "CONDITIONALLY_SERVICEABLE" | "NOT_SERVICEABLE" | "NON_SERVICEABLE" | "PENDING";
  attachmentCertification: string;
  lateralCertification: string;
  siteCoordinates: string;
  attachmentCoordinates: string;
  routeCoordinates: {
    routeId?: string;
    totalCount: number;
    renderedCount: number;
    first?: DALCoordinate;
    last?: DALCoordinate;
  };
  stationCoordinates: string;
  nodeCoordinates: string;
  geometryCounts: {
    candidateScopeVersions: number;
    sites: number;
    attachments: number;
    backboneRouteCoordinates: number;
    kernelRoutePrimitives: number;
    lateralCoordinates: number;
    stations: number;
    nodes: number;
    edges: number;
    crossings: number;
    kernelPrimitives: number;
  };
};

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function constraintCountDisplay(
  analysis: ReturnType<typeof analyzeRouteConstraints> | null | undefined,
  key: keyof ReturnType<typeof analyzeRouteConstraints>["summary"],
  fallback: string
) {
  if (!analysis) return fallback;
  if (analysis.unknownCounts?.[key]) return "UNKNOWN";
  return fmt(analysis.summary[key]);
}

function totalKnownCrossingsDisplay(analysis: ReturnType<typeof analyzeRouteConstraints> | null | undefined, fallback: string) {
  if (!analysis) return fallback;
  if (analysis.unknownCounts?.roadCrossings || analysis.unknownCounts?.railroadCrossings || analysis.unknownCounts?.waterCrossings) return "UNKNOWN";
  return fmt(analysis.summary.roadCrossings + analysis.summary.railroadCrossings + analysis.summary.waterCrossings);
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number | undefined) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

function feetLabel(n: number | undefined) {
  return `${fmt(Math.round(Number(n || 0)))} ft`;
}

function milesLabel(n: number | undefined) {
  return `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi`;
}

function coordinateLabel(coordinate?: DALCoordinate | null) {
  return coordinate ? `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}` : "n/a";
}

function candidateCoordinate(site: CandidateSite | null | undefined): DALCoordinate | null {
  return isValidGeocodeCoordinate(site?.latitude, site?.longitude) ? ([Number(site?.longitude), Number(site?.latitude)] as DALCoordinate) : null;
}

function hasSyntheticCoordinateUnderRealGeocoder(site: CandidateSite) {
  const provider = String(site.geocodeProvider ?? "").toLowerCase();
  return realGeocoderConfigured() && (site.geocodeStatus === "FALLBACK" || provider.includes("deterministic"));
}

function siteFromSeed(seed: OpportunitySeed | null | undefined): CandidateSite | null {
  if (!seed || !Number.isFinite(seed.latitude) || !Number.isFinite(seed.longitude)) return null;
  return {
    candidateId: seed.candidateSiteId ?? seed.id,
    companyName: seed.siteName ?? `Opportunity ${seed.id}`,
    address: "",
    city: "",
    state: "TX",
    zipCode: "",
    latitude: seed.latitude,
    longitude: seed.longitude,
    geocodeProvider: "seed-coordinate",
    geocodeConfidence: seed.confidence,
    geocodeStatus: "GEOCODED",
    facilityType: seed.facilityType,
    marketSegment: seed.marketSegment,
    status: "ANALYZED",
    createdAt: seed.createdAt,
  };
}

function serviceabilityForSeed(seed: OpportunitySeed | null | undefined) {
  return seed?.serviceabilityAssessment ?? seed?.networkAffinity?.serviceabilityAssessment ?? seed?.certificationSnapshot?.serviceabilityAssessment;
}

function attachmentCertificationForSeed(seed: OpportunitySeed | null | undefined) {
  return seed?.attachmentCertification ?? seed?.networkAffinity?.attachmentCertification ?? seed?.certificationSnapshot?.attachmentPoint;
}

function lateralCertificationForSeed(seed: OpportunitySeed | null | undefined) {
  return seed?.lateralCertification ?? seed?.networkAffinity?.lateralCertification ?? seed?.certificationSnapshot?.lateralPath;
}

function hasScopeVersionCertification(seed: OpportunitySeed | null | undefined) {
  const serviceability = serviceabilityForSeed(seed);
  const attachment = attachmentCertificationForSeed(seed);
  const lateral = lateralCertificationForSeed(seed);
  return Boolean(
    serviceability &&
      attachment &&
      lateral &&
      serviceability.status !== "NOT_SERVICEABLE" &&
      serviceability.serviceable &&
      attachment.certificationStatus !== "FAILED" &&
      lateral.certificationStatus !== "FAILED"
  );
}

function inventoryAuthorityScopeVersion(graph: InventoryGraph): ScopeVersion {
  const graphRecord = graph as unknown as Record<string, any>;
  const scopeVersionId = String(graphRecord.scopeVersionId ?? graph.metadata.scopeVersionId ?? `SV-INV-${graph.inventoryId}`);
  const createdAt = String(graphRecord.createdAt ?? graph.metadata.createdAt ?? graph.metadata.createdDate ?? graph.createdAt ?? new Date().toISOString());
  const updatedAt = String(graphRecord.updatedAt ?? graph.metadata.updatedAt ?? graph.updatedAt ?? createdAt);
  return {
    scopeVersionId,
    type: "INVENTORY",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    inventoryId: graph.inventoryId,
    sourceInventoryId: graph.inventoryId,
    graphId: graph.graphId,
    graphVersion: graph.graphId,
    source: "InventoryGraph",
    status: "ANALYZED",
    certificationState: "CERTIFIED",
    isImmutable: true,
    canonicalTruth: {
      decisionType: "InventoryAuthorityReference",
      graphReference: {
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        graphVersion: graph.graphId,
      },
      inventoryGraphReference: {
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        name: graph.metadata.name,
      },
      routes: graph.routes,
      nodes: graph.nodes,
      edges: graph.edges,
      stations: graph.stations,
      graphSummary: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        stationCount: graph.stations.length,
        routeCount: graph.routes.length,
      },
    },
    createdAt,
    updatedAt,
    events: [],
  } as ScopeVersion;
}

function isServiceableSeed(seed: OpportunitySeed | null, route?: InventoryRoute, node?: InventoryNode, station?: InventoryStation) {
  const buildPath = seed?.buildPath ?? seed?.networkAffinity?.buildPath;
  if (!hasScopeVersionCertification(seed)) return false;
  return Boolean(
    seed &&
      route &&
      node &&
      station &&
      buildPath?.geometry?.length &&
      buildPath.geometry.length >= 2 &&
      (seed.networkAffinity?.preferredAttachmentPoint || buildPath.corridorPath?.attachmentCoordinate || buildPath.geometry[buildPath.geometry.length - 1])
  );
}

function phaseFor(seed: OpportunitySeed | null) {
  if (!seed?.rank) return seed?.overallScore && seed.overallScore >= 70 ? "Phase 1" : "Phase 2";
  if (seed.rank <= 10) return "Phase 1";
  if (seed.rank <= 25) return "Phase 2";
  return "Phase 3";
}

function priorityFor(seed: OpportunitySeed | null) {
  const score = Number(seed?.overallScore ?? 0);
  if (score >= 75) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

function quoteBasisFor(seed: OpportunitySeed | null, existingQuote?: MarketplaceQuote): MarketplaceQuote | null {
  if (!seed) return existingQuote ?? null;
  if (existingQuote) return existingQuote;
  const buildFeet = Number(seed.buildPath?.buildFeet ?? seed.distanceFeet ?? 0);
  const riskScore = Number(seed.riskScore ?? seed.buildPath?.riskScore ?? 45);
  const buildCost = Number(seed.buildCost ?? seed.buildPath?.estimatedCost ?? 15000 + buildFeet * 22);
  const termMonths = 36;
  const nrc = Math.round(Math.max(seed.estimatedNRC ?? 0, buildCost * (1.18 + riskScore / 250)));
  const mrc = seed.estimatedMRC ?? Math.round(850 + buildFeet * 0.65);
  const totalContractValue = nrc + mrc * termMonths;
  const grossCost = buildCost + mrc * termMonths * 0.28;
  const margin = (totalContractValue - grossCost) / Math.max(totalContractValue, 1);
  return {
    quoteId: createId("quote-basis"),
    opportunitySeedId: seed.id,
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
    nrc,
    mrc,
    termMonths,
    totalContractValue,
    margin,
    paybackMonths: seed.paybackMonths,
    constructionType: seed.constructionType ?? seed.buildPath?.constructionType,
    riskScore,
    estimatedCost: buildCost,
    routeId: seed.buildPath?.routeId ?? seed.nearestRouteId,
    nodeId: seed.buildPath?.nodeId ?? seed.nearestNodeId,
    stationId: seed.buildPath?.stationId ?? seed.nearestStationId,
    attachmentType: seed.attachmentStrategy?.attachmentType,
    buildFeet: Math.round(buildFeet),
    buildPath: seed.buildPath,
    estimatedPermitCost: seed.estimatedPermitCost,
    estimatedCrossingCost: seed.estimatedCrossingCost,
    estimatedEnvironmentalCost: seed.estimatedEnvironmentalCost,
    estimatedEngineeringCost: seed.estimatedEngineeringCost,
    constructabilityAssessment: seed.constructabilityAssessment,
    notes: "Generated by Prism Site Decision as quote basis. Marketplace may refine.",
    createdAt: now(),
  };
}

function crossingPointsFor(seed: OpportunitySeed | null): DecisionCrossing[] {
  const geometry = seed?.buildPath?.geometry ?? [];
  const constructability = seed?.constructabilityAssessment;
  const roadCount = Number(seed?.buildPath?.highwayCrossingCount ?? 0);
  const railCount = Number(constructability?.rail.railCrossingCount ?? seed?.buildPath?.railCrossingCount ?? 0);
  const waterCount = Number(constructability?.water.waterCrossingCount ?? seed?.buildPath?.waterCrossingCount ?? 0);
  const typedCrossings: Array<DecisionCrossing["crossingType"]> = [
    ...Array.from({ length: roadCount }, () => "road" as const),
    ...Array.from({ length: railCount }, () => "rail" as const),
    ...Array.from({ length: waterCount }, () => "water" as const),
  ];
  const count = typedCrossings.length || Number(seed?.buildPath?.estimatedCrossings ?? 0);
  if (geometry.length < 2 || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const coord = geometry[Math.min(geometry.length - 1, Math.max(0, Math.round(((index + 1) / (count + 1)) * (geometry.length - 1))))];
    const crossingType = typedCrossings[index] ?? "unknown";
    return {
      id: `${seed?.id ?? "site"}-crossing-${index + 1}`,
      label: `${crossingType} crossing`,
      coordinate: coord,
      crossingType,
      kind: "crossing",
      payload: { index: index + 1, seed },
    };
  });
}

function evidenceFor(args: {
  site: CandidateSite;
  seed: OpportunitySeed;
  quoteBasis: MarketplaceQuote | null;
  route?: InventoryRoute;
  node?: InventoryNode;
  station?: InventoryStation;
}) {
  const { site, seed, quoteBasis, route, node, station } = args;
  const constructability = seed.constructabilityAssessment ?? seed.networkAffinity?.constructabilityAssessment ?? seed.buildPath?.constructabilityAssessment;
  const buildPath = seed.buildPath ?? seed.networkAffinity?.buildPath;
  const roadCrossings = Number(buildPath?.highwayCrossingCount ?? buildPath?.estimatedCrossings ?? 0);
  const railCrossings = Number(constructability?.rail.railCrossingCount ?? buildPath?.railCrossingCount ?? 0);
  const waterCrossings = Number(constructability?.water.waterCrossingCount ?? buildPath?.waterCrossingCount ?? 0);
  const totalCrossings = roadCrossings + railCrossings + waterCrossings;
  const buildFeet = Number(buildPath?.buildFeet ?? seed.distanceFeet ?? 0);
  const serviceability = serviceabilityForSeed(seed);
  const attachmentCertification = attachmentCertificationForSeed(seed);
  const lateralCertification = lateralCertificationForSeed(seed);
  const routeDiagnostics = lateralCertification ?? buildPath;
  return {
    candidateAddress: [site.address, site.city, site.state, site.zipCode].filter(Boolean).join(", "),
    latLon: Number.isFinite(site.latitude) && Number.isFinite(site.longitude) ? `${Number(site.latitude).toFixed(6)}, ${Number(site.longitude).toFixed(6)}` : "n/a",
    geocodeConfidence: site.geocodeConfidence ? pct(site.geocodeConfidence) : "n/a",
    routeId: buildPath?.routeId ?? seed.nearestRouteId ?? "n/a",
    stationId: buildPath?.stationId ?? seed.nearestStationId ?? "n/a",
    nodeId: buildPath?.nodeId ?? seed.nearestNodeId ?? "n/a",
    nearestRoute: route?.name ?? seed.networkAffinity?.nearestRoute.routeName ?? buildPath?.routeId ?? seed.nearestRouteId ?? "n/a",
    nearestNode: node?.nodeId ?? buildPath?.nodeId ?? seed.nearestNodeId ?? "n/a",
    nearestStation: station?.label ?? buildPath?.stationId ?? seed.nearestStationId ?? "n/a",
    distanceToRoute: feetLabel(seed.networkAffinity?.nearestRoute.distanceFeet ?? seed.distanceFeet),
    buildFeet: feetLabel(buildFeet),
    buildMiles: milesLabel(seed.buildMiles ?? buildPath?.buildMiles ?? buildFeet / 5280),
    crossings: fmt(totalCrossings || buildPath?.estimatedCrossings),
    roadCrossings: fmt(roadCrossings),
    railCrossings: fmt(railCrossings),
    waterCrossings: fmt(waterCrossings),
    permits: constructability?.permitting.authorities.join(", ") || "n/a",
    constructionType: seed.constructionType ?? buildPath?.constructionType ?? "n/a",
    estimatedCost: money(seed.buildCost ?? buildPath?.estimatedCost),
    nrc: money(quoteBasis?.nrc ?? seed.estimatedNRC),
    mrc: money(quoteBasis?.mrc ?? seed.estimatedMRC),
    tcv: money(quoteBasis?.totalContractValue ?? seed.estimatedTCV),
    roi: `${Number(seed.roi ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}x`,
    payback: `${fmt(Math.round(quoteBasis?.paybackMonths ?? seed.paybackMonths ?? 0))} mo`,
    serviceabilityStatus: serviceability?.status ?? "n/a",
    certificationStatus:
      attachmentCertification?.certificationStatus && lateralCertification?.certificationStatus
        ? `Attachment ${attachmentCertification.certificationStatus} / Lateral ${lateralCertification.certificationStatus}`
        : "n/a",
    attachmentConfidence: attachmentCertification ? `${Math.round(attachmentCertification.confidenceScore)}%` : "n/a",
    routingMode: routeDiagnostics?.routingMode ?? "n/a",
    pathConfidence: routeDiagnostics?.pathConfidence ?? "n/a",
    roadSegmentCount: fmt(routeDiagnostics?.roadSegmentCount),
    roadNamesTraversed: routeDiagnostics?.roadNamesTraversed?.join(" -> ") || "n/a",
    roadClassesTraversed: routeDiagnostics?.roadClassesTraversed?.join(" -> ") || "n/a",
    attachmentMethod: routeDiagnostics?.attachmentMethod ?? "n/a",
    missingRoutingDependencies: routeDiagnostics?.missingRoutingDependencies?.join(", ") || "none",
  };
}

function createDecisionMapScopeVersion(decision: DecisionContext): ScopeVersion {
  const attachmentCertification = attachmentCertificationForSeed(decision.seed);
  const lateralCertification = lateralCertificationForSeed(decision.seed);
  const serviceabilityAssessment = serviceabilityForSeed(decision.seed);
  const routeId = decision.buildPath?.routeId ?? decision.seed.nearestRouteId ?? decision.route?.routeId ?? "";
  const nodeId = decision.buildPath?.nodeId ?? decision.seed.nearestNodeId ?? decision.node?.nodeId ?? "";
  const stationId = decision.buildPath?.stationId ?? decision.seed.nearestStationId ?? decision.station?.stationId ?? "";
  const lateralGeometry = lateralCertification?.geometry ?? decision.buildPath?.geometry ?? [];
  const attachmentPoint = decision.attachmentPoint ?? ([Number.NaN, Number.NaN] as DALCoordinate);
  const siteLatitude = Number(decision.site.latitude ?? decision.seed.latitude ?? 0);
  const siteLongitude = Number(decision.site.longitude ?? decision.seed.longitude ?? 0);
  const timestamp = (decision.seed as { updatedAt?: string }).updatedAt ?? decision.seed.createdAt ?? now();
  const scopeVersionId = `decision-map-${decision.seed.id}`;
  return {
    scopeVersionId,
    type: "CANDIDATE",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    inventoryId: decision.seed.inventoryId,
    graphId: decision.seed.graphId,
    graphVersion: decision.seed.graphId,
    candidateSiteId: decision.site.candidateId,
    sourceOpportunityId: decision.seed.id,
    source: "OpportunitySeed",
    status: "ANALYZED",
    certificationState: "DRAFT",
    isImmutable: false,
    candidateSite: decision.site,
    latitude: siteLatitude,
    longitude: siteLongitude,
    geometry: lateralGeometry,
    attachmentPoint,
    attachmentCoordinates: attachmentPoint,
    nearestRoute: decision.route,
    nearestNode: decision.node,
    nearestStation: decision.station,
    buildPath: decision.buildPath,
    buildFeet: Number(lateralCertification?.buildFeet ?? decision.buildPath?.buildFeet ?? decision.seed.distanceFeet ?? 0),
    buildMiles: Number(lateralCertification?.buildMiles ?? decision.buildPath?.buildMiles ?? decision.seed.buildMiles ?? 0),
    crossings: decision.crossings,
    constructability: decision.seed.constructabilityAssessment ?? decision.seed.networkAffinity?.constructabilityAssessment,
    financialInputs: decision.quoteBasis,
    certificationSnapshot: decision.seed.certificationSnapshot ?? decision.seed.networkAffinity?.certificationSnapshot,
    serviceabilityAssessment,
    decisionTimestamp: timestamp,
    user: "DAL Operator",
    station: decision.station,
    route: decision.route,
    canonicalTruth: {
      decisionType: "PrismSiteDecisionMapPreview",
      graphReference: {
        inventoryId: decision.seed.inventoryId,
        graphId: decision.seed.graphId,
        graphVersion: decision.seed.graphId,
      },
      networkBasis: {
        routeId,
        routeName: decision.route?.name ?? routeId,
        nodeId,
        nodeName: decision.node?.nodeId ?? nodeId,
        stationId,
        stationName: decision.station?.label ?? stationId,
        attachmentPoint,
        attachmentCoordinates: attachmentPoint,
        attachmentAuthority: decision.attachmentAuthority,
        attachmentMethod: decision.attachmentAuthority?.attachmentMethod,
        attachmentConfidence: decision.attachmentAuthority?.attachmentConfidence,
        capacityStatus: decision.seed.capacityStatus ?? decision.seed.networkAffinity?.capacity.projectedUtilization,
        attachmentStrategy: decision.seed.attachmentStrategy?.attachmentType ?? decision.seed.networkAffinity?.preferredStrategy.attachmentType,
        networkAffinityScore: decision.seed.networkAffinityScore ?? decision.seed.networkAffinity?.affinityScore,
        certificationStatus: attachmentCertification?.certificationStatus,
      },
      geographicBasis: {
        candidateLatitude: siteLatitude,
        candidateLongitude: siteLongitude,
        geocodeProvider: decision.site.geocodeProvider,
        geocodeConfidence: decision.site.geocodeConfidence,
        geometry: lateralGeometry,
        routeGeometry: decision.route?.coordinates ?? [],
        stationGeometry: decision.station ? ([decision.station.lon, decision.station.lat] as DALCoordinate) : undefined,
        nodeGeometry: decision.node ? ([decision.node.lon, decision.node.lat] as DALCoordinate) : undefined,
        attachmentGeometry: decision.attachmentPoint,
        lateralGeometry,
        buildPath: decision.buildPath,
      },
      engineeringBasis: {
        buildFeet: Number(lateralCertification?.buildFeet ?? decision.buildPath?.buildFeet ?? decision.seed.distanceFeet ?? 0),
        buildMiles: Number(lateralCertification?.buildMiles ?? decision.buildPath?.buildMiles ?? decision.seed.buildMiles ?? 0),
        routingMode: lateralCertification?.routingMode ?? decision.buildPath?.routingMode,
        routingClassification: lateralCertification?.routingClassification ?? decision.buildPath?.routingClassification,
        pathConfidence: lateralCertification?.pathConfidence ?? decision.buildPath?.pathConfidence,
        roadSegmentCount: lateralCertification?.roadSegmentCount ?? decision.buildPath?.roadSegmentCount,
        roadNamesTraversed: lateralCertification?.roadNamesTraversed ?? decision.buildPath?.roadNamesTraversed,
        roadClassesTraversed: lateralCertification?.roadClassesTraversed ?? decision.buildPath?.roadClassesTraversed,
        attachmentMethod: lateralCertification?.attachmentMethod ?? decision.buildPath?.attachmentMethod,
        missingRoutingDependencies: lateralCertification?.missingRoutingDependencies ?? decision.buildPath?.missingRoutingDependencies,
        routeAccessPoints: lateralCertification?.routeAccessPoints ?? decision.buildPath?.routeAccessPoints,
        attachmentAuthority: decision.attachmentAuthority,
        attachmentCertification,
        lateralCertification,
        serviceabilityAssessment,
      },
      quoteBasis: decision.quoteBasis,
      certificationSnapshot: decision.seed.certificationSnapshot ?? decision.seed.networkAffinity?.certificationSnapshot,
      serviceabilityAssessment,
      sourceCandidate: {
        candidateSiteId: decision.site.candidateId,
        name: decision.site.companyName,
        address: decision.evidence.candidateAddress,
      },
      sourceOpportunity: {
        opportunitySeedId: decision.seed.id,
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [],
  };
}

function applyCertifiedRouteToScopeVersion(
  scope: ScopeVersion,
  certification: RouteCertificationSnapshot,
  snapCertification: SnapCertificationSnapshot,
  streetCenterlines: StreetCenterline[],
  parentScopeVersionId?: string
): ScopeVersion {
  const geometry = certification.certifiedGeometrySnapshot;
  if (!certification.constraintEvidencePackage || certification.constraintEvidencePackage.routeGeometryHash !== certification.certifiedGeometryHash) {
    throw new Error("Certified ScopeVersion requires current ConstraintEvidencePackage matching certified route geometry.");
  }
  const constraintEvidencePackage = certification.constraintEvidencePackage;
  const canonicalTruth = (scope.canonicalTruth ?? {}) as Record<string, any>;
  const networkBasis = (canonicalTruth.networkBasis ?? {}) as Record<string, any>;
  const geographicBasis = (canonicalTruth.geographicBasis ?? {}) as Record<string, any>;
  const engineeringBasis = (canonicalTruth.engineeringBasis ?? {}) as Record<string, any>;
  const financialBasis = (canonicalTruth.financialBasis ?? {}) as Record<string, any>;
  const attachmentAuthority = networkBasis.attachmentAuthority;
  const attachmentMethod = networkBasis.attachmentMethod;
  const attachmentConfidence = networkBasis.attachmentConfidence;
  const attachmentCoordinate = networkBasis.attachmentCoordinates ?? snapCertification.attachmentCoordinate;
  const routeCertificationAuthority =
    certification.certificationAuthority ??
    deriveRouteCertificationState({
      routeGeometryHash: certification.certifiedGeometryHash,
      constraintEvidencePackage,
      engineerApproval: {
        approved: certification.status === "CERTIFIED_ROUTE" || certification.status === "PROVISIONALLY_CERTIFIED",
        rejected: certification.status === "REJECTED_ROUTE",
        notes: certification.certificationNotes,
        certifiedBy: certification.engineerName,
        certifiedAt: certification.certifiedAt,
      },
    });
  return {
    ...scope,
    parentScopeVersionId: parentScopeVersionId ?? scope.parentScopeVersionId,
    rootScopeVersionId: scope.rootScopeVersionId ?? parentScopeVersionId ?? scope.scopeVersionId,
    relationshipType: "LATERAL_EXTENSION",
    geometry,
    buildFeet: certification.lengthFeet,
    buildMiles: certification.buildMiles,
    canonicalTruth: {
      ...canonicalTruth,
      parentScopeVersionId: parentScopeVersionId ?? canonicalTruth.parentScopeVersionId,
      relationshipType: "LATERAL_EXTENSION",
      routeCertificationId: certification.routeCertificationId,
      routeCertificationStatus: routeCertificationAuthority.state,
      routeCertificationState: routeCertificationAuthority.state,
      evidenceGrade: routeCertificationAuthority.evidenceGrade,
      missingConstraintLayers: routeCertificationAuthority.missingConstraintLayers,
      provisional: routeCertificationAuthority.provisional,
      engineerNotes: certification.certificationNotes,
      certificationAuthority: routeCertificationAuthority,
      routeCertification: certification,
      certifiedGeometrySnapshot: geometry,
      certifiedGeometryHash: certification.certifiedGeometryHash,
      constraintEvidenceId: certification.constraintEvidenceId,
      constraintEvidencePackage,
      constraintSummary: constraintEvidencePackage.summary,
      constraints: constraintEvidencePackage.constraints,
      constructabilityScore: constraintEvidencePackage.constructabilityScore,
      certificationReadiness: constraintEvidencePackage.certificationReadiness,
      attachmentAuthority,
      attachmentMethod,
      attachmentConfidence,
      attachmentAuthorityEvidence: networkBasis.attachmentAuthorityEvidence ?? attachmentAuthority,
      snapAuthority: snapCertification.snapAuthority,
      snapId: snapCertification.snapId,
      snapMethod: snapCertification.snapMethod,
      snapConfidence: snapCertification.snapConfidence,
      selectedSnapAlternative: snapCertification.selectedAlternative,
      selectedSnapCandidateType: snapCertification.selectedCandidateType,
      selectedSnapCandidateId: snapCertification.selectedCandidateId,
      snappedStreetId: snapCertification.streetId,
      snappedStreetName: snapCertification.streetName,
      snappedStreetClass: snapCertification.streetClass,
      snappedCoordinate: snapCertification.snappedCoordinate,
      attachmentCoordinate,
      constructabilityAwareSnap: {
        snapId: snapCertification.snapId,
        snapMethod: snapCertification.snapMethod,
        snapConfidence: snapCertification.snapConfidence,
        constructabilityScore: snapCertification.constructabilityScore,
        selectedAlternative: snapCertification.selectedAlternative,
        selectedCandidateType: snapCertification.selectedCandidateType,
        selectedCandidateId: snapCertification.selectedCandidateId,
        snapEvidence: snapCertification.snapEvidence,
        attachmentCandidates: snapCertification.attachmentCandidates,
        attachmentCorridorEvidence: snapCertification.attachmentCorridorEvidence,
      },
      snapCertification,
      snapCertificationId: snapCertification.snapCertificationId,
      snapCertificationStatus: snapCertification.status,
      certifiedBy: certification.certifiedBy,
      certifiedAt: certification.certifiedAt,
      certificationNotes: certification.certificationNotes,
      geographicBasis: {
        ...geographicBasis,
        geometry,
        routeGeometry: geometry,
        lateralGeometry: geometry,
        snappedGeometry: snapCertification.snappedCoordinate,
        attachmentGeometry: attachmentCoordinate,
        selectedSnapGeometry: snapCertification.attachmentCoordinate,
        attachmentCorridorEvidence: snapCertification.attachmentCorridorEvidence,
        streetCenterlines,
      } as any,
      engineeringBasis: {
        ...engineeringBasis,
        buildFeet: certification.lengthFeet,
        buildMiles: certification.buildMiles,
        routeCertificationId: certification.routeCertificationId,
        routeCertification: certification,
        routeCertificationState: routeCertificationAuthority.state,
        evidenceGrade: routeCertificationAuthority.evidenceGrade,
        missingConstraintLayers: routeCertificationAuthority.missingConstraintLayers,
        provisional: routeCertificationAuthority.provisional,
        engineerNotes: certification.certificationNotes,
        certificationAuthority: routeCertificationAuthority,
        certifiedGeometrySnapshot: geometry,
        certifiedGeometryHash: certification.certifiedGeometryHash,
        constraintEvidenceId: certification.constraintEvidenceId,
        constraintEvidencePackage,
        constraintSummary: constraintEvidencePackage.summary,
        constraints: constraintEvidencePackage.constraints,
        unresolvedConstraints: certification.unresolvedConstraints,
        constructabilityScore: constraintEvidencePackage.constructabilityScore,
        certificationReadiness: constraintEvidencePackage.certificationReadiness,
        attachmentAuthority,
        attachmentMethod,
        attachmentConfidence,
        snapCertification,
        constructabilityAwareSnapScore: snapCertification.constructabilityScore,
        constructabilityAwareSnapEvidence: snapCertification.snapEvidence,
        attachmentCandidates: snapCertification.attachmentCandidates,
        attachmentCorridorEvidence: snapCertification.attachmentCorridorEvidence,
        constructability: certification.constructabilityEstimate,
      } as any,
      financialBasis: {
        ...financialBasis,
        estimatedConstructionCost: certification.costEstimate.constructionCost,
        NRC: certification.costEstimate.NRC,
        MRC: certification.costEstimate.MRC,
        TCV: certification.costEstimate.TCV,
        margin: certification.costEstimate.margin,
        payback: certification.costEstimate.payback,
        ROI: certification.costEstimate.ROI,
      } as any,
      costBasis: {
        ...((canonicalTruth.costBasis ?? {}) as Record<string, any>),
        buildCost: certification.costEstimate.constructionCost,
      },
    },
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

function renderSnapAuthoritySpec(snapAuthority: SnapAuthorityResult | null, sourceId: string): MapKernelRenderSpec | null {
  if (!snapAuthority) return null;
  const candidates = Array.isArray(snapAuthority.attachmentCandidates) ? (snapAuthority.attachmentCandidates as Array<Record<string, any>>) : [];
  const corridorGeometry = Array.isArray((snapAuthority.attachmentCorridorEvidence as Record<string, any> | undefined)?.geometry)
    ? (((snapAuthority.attachmentCorridorEvidence as Record<string, any>).geometry as unknown[]).filter((coordinate): coordinate is DALCoordinate =>
        Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]))
      ))
    : [];
  return {
    specId: `snap-authority:${sourceId}`,
    sourceType: "Manual",
    sourceId,
    name: "Constructability-Aware Snap Evidence",
    primitives: [
      {
        id: `${sourceId}:street-snap`,
        layerId: "object",
        kind: "point",
        coordinate: snapAuthority.snappedCoordinate,
        label: `Candidate snap ${Math.round(snapAuthority.snapConfidence * 100)}%`,
        payload: snapAuthority,
        style: { fill: "#f59e0b", stroke: "#ffffff", radius: 5, opacity: 0.95 },
        metadata: { sourceLayer: "object", rootScopeVersionId: sourceId, renderAuthority: "Geographic Reference" },
        ref: { kind: "StreetSnap", id: `${sourceId}:street-snap`, scopeVersionId: sourceId },
      },
      {
        id: `${sourceId}:selected-attachment`,
        layerId: "attachment",
        kind: "point",
        coordinate: snapAuthority.attachmentCoordinate,
        label: `Selected attachment ${snapAuthority.constructabilityScore ?? Math.round(snapAuthority.snapConfidence * 100)}/100`,
        payload: snapAuthority,
        style: { fill: "#16a34a", stroke: "#052e16", radius: 7, opacity: 0.98 },
        metadata: { sourceLayer: "attachment", rootScopeVersionId: sourceId, renderAuthority: "Constructability Evidence" },
        ref: { kind: "Attachment", id: `${sourceId}:selected-attachment`, scopeVersionId: sourceId },
      },
      ...(corridorGeometry.length >= 2
        ? [
            {
              id: `${sourceId}:snap-corridor`,
              layerId: "lateral" as const,
              kind: "line" as const,
              coordinates: corridorGeometry,
              label: `Snap corridor ${snapAuthority.selectedAlternative ?? "ENGINEER_PREFERRED"}`,
              payload: snapAuthority.attachmentCorridorEvidence,
              style: { stroke: "#16a34a", strokeWidth: 3, opacity: 0.84, dasharray: "7 4" },
              metadata: { sourceLayer: "lateral", rootScopeVersionId: sourceId, renderAuthority: "Constructability Evidence" },
              ref: { kind: "Lateral" as const, id: `${sourceId}:snap-corridor`, scopeVersionId: sourceId },
            },
          ]
        : []),
      ...candidates.slice(0, 8).flatMap((candidate, index) => {
        const coordinate = candidate.attachmentCoordinate;
        if (!Array.isArray(coordinate) || !Number.isFinite(Number(coordinate[0])) || !Number.isFinite(Number(coordinate[1]))) return [];
        const selected = candidate.candidateId === snapAuthority.selectedCandidateId;
        return [
          {
            id: `${sourceId}:attachment-candidate:${String(candidate.candidateId ?? index)}`,
            layerId: "attachment" as const,
            kind: "point" as const,
            coordinate: coordinate as DALCoordinate,
            label: `${String(candidate.candidateType ?? "Candidate")} ${Math.round(Number(candidate.scores?.constructabilityScore ?? 0))}/100`,
            payload: candidate,
            style: {
              fill: selected ? "#15803d" : "#bbf7d0",
              stroke: selected ? "#052e16" : "#166534",
              radius: selected ? 6 : 4,
              opacity: selected ? 1 : 0.72,
            },
            metadata: { sourceLayer: "attachment", rootScopeVersionId: sourceId, renderAuthority: "Constructability Evidence" },
            ref: { kind: "Attachment" as const, id: `${sourceId}:attachment-candidate:${String(candidate.candidateId ?? index)}`, scopeVersionId: sourceId },
          },
        ];
      }),
    ],
    metadata: {
      snapId: snapAuthority.snapId,
      snapMethod: snapAuthority.snapMethod,
      snapAuthority: snapAuthority.snapAuthority,
      constructabilityScore: snapAuthority.constructabilityScore,
      selectedAlternative: snapAuthority.selectedAlternative,
      selectedCandidateType: snapAuthority.selectedCandidateType,
      streetId: snapAuthority.streetId,
      streetName: snapAuthority.streetName,
    },
  };
}

export default function PrismSiteDecisionWorkspace() {
  const {
    selectedCandidateSite,
    selectedCandidateSiteId,
    selectedGraph,
    selectedInventoryId,
    selectedOpportunitySeed,
    selectedScopeVersion,
    setSelectedCandidateSite,
    setSelectedCandidateSiteId,
    setSelectedGraph,
    setSelectedInventoryId,
    setSelectedOpportunitySeed,
    setSelectedOpportunitySeedId,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
    setWorkspace,
  } = useDALState();
  const [graphs, setGraphs] = useState<InventoryGraphMetadata[]>([]);
  const [sites, setSites] = useState<CandidateSite[]>([]);
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([]);
  const [inventoryId, setInventoryId] = useState(selectedInventoryId);
  const [candidateId, setCandidateId] = useState(selectedCandidateSiteId);
  const [seedId, setSeedId] = useState(selectedOpportunitySeed?.id ?? "");
  const [decisionGraph, setDecisionGraph] = useState<InventoryGraph | null>(selectedGraph);
  const [draftSeed, setDraftSeed] = useState<OpportunitySeed | null>(selectedOpportunitySeed);
  const [quoteWorksheet, setQuoteWorksheet] = useState<MarketplaceQuote | null>(null);
  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<DALCoordinate[]>([]);
  const [selectedRouteVertexIndex, setSelectedRouteVertexIndex] = useState<number | null>(null);
  const [routeCertificationState, setRouteCertificationState] = useState<RouteCertificationState>("DRAFT_ROUTE");
  const [routeCertification, setRouteCertification] = useState<RouteCertificationSnapshot | null>(null);
  const [routeEngineerName, setRouteEngineerName] = useState("");
  const [routeCertificationNotes, setRouteCertificationNotes] = useState("");
  const [selectedRouteAlternativeId, setSelectedRouteAlternativeId] = useState("");
  const [snapAuthority, setSnapAuthority] = useState<SnapAuthorityResult | null>(null);
  const [snapStreetCenterlines, setSnapStreetCenterlines] = useState<StreetCenterline[]>([]);
  const [snapCertificationState, setSnapCertificationState] = useState<SnapCertificationState>("DRAFT_SNAP");
  const [snapCertification, setSnapCertification] = useState<SnapCertificationSnapshot | null>(null);
  const [snapEngineerName, setSnapEngineerName] = useState("");
  const [snapCertificationNotes, setSnapCertificationNotes] = useState("");
  const [status, setStatus] = useState("Prism Site Decision ready.");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [nextGraphs, nextSites, nextSeeds, nextQuotes] = await Promise.all([
        listInventoryGraphs(),
        listCandidateSites(),
        listOpportunitySeeds(),
        listMarketplaceQuotes(),
      ]);
      setGraphs(nextGraphs);
      setSites(nextSites);
      setSeeds(nextSeeds);
      setQuotes(nextQuotes);
      const nextSeed = selectedOpportunitySeed ?? nextSeeds[0] ?? null;
      const nextSite = selectedCandidateSite ?? nextSites.find((site) => site.candidateId === nextSeed?.candidateSiteId) ?? nextSites[0] ?? null;
      setSeedId(nextSeed?.id ?? "");
      setCandidateId(nextSite?.candidateId ?? "");
      setInventoryId(selectedInventoryId || selectedGraph?.inventoryId || nextSeed?.inventoryId || nextGraphs[0]?.inventoryId || "");
      setDraftSeed(nextSeed);
      if (nextSite) {
        setSelectedCandidateSite(nextSite);
        setSelectedCandidateSiteId(nextSite.candidateId);
      }
      setStatus("Decision data loaded.");
    } catch (err: any) {
      setStatus(`Decision data load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function ensureGraph(nextInventoryId = inventoryId) {
    if (decisionGraph?.inventoryId === nextInventoryId) return decisionGraph;
    if (selectedGraph?.inventoryId === nextInventoryId) {
      setDecisionGraph(selectedGraph);
      return selectedGraph;
    }
    if (!nextInventoryId) return null;
    const graph = await loadInventoryGraph(nextInventoryId);
    setDecisionGraph(graph);
    setSelectedGraph(graph);
    setSelectedInventoryId(graph.inventoryId);
    return graph;
  }

  async function persistSite(nextSite: CandidateSite) {
    const saved = await saveCandidateSite(nextSite);
    setSites((prev) => [saved, ...prev.filter((site) => site.candidateId !== saved.candidateId)]);
    if (candidateId === saved.candidateId || selectedCandidateSite?.candidateId === saved.candidateId) {
      setSelectedCandidateSite(saved);
      setSelectedCandidateSiteId(saved.candidateId);
    }
    return saved;
  }

  async function resolveGeocodedSite(site: CandidateSite) {
    const validExisting = isValidGeocodeCoordinate(site.latitude, site.longitude) && !hasSyntheticCoordinateUnderRealGeocoder(site);
    if (validExisting) return site;
    const geocodingSite = { ...site, status: "GEOCODING", geocodeStatus: "GEOCODING" } as CandidateSite;
    setSites((prev) => prev.map((item) => (item.candidateId === site.candidateId ? geocodingSite : item)));
    setStatus(`Geocoding ${site.companyName}...`);
    const geocoded = await geocodeCandidateSite(geocodingSite, undefined, { force: true });
    const saved = await persistSite(geocoded);
    if (!isValidGeocodeCoordinate(saved.latitude, saved.longitude)) {
      setStatus(`FAILED_GEOCODE: ${saved.companyName} could not be placed on the map.`);
      return null;
    }
    return saved;
  }

  async function markNonServiceable(site: CandidateSite, reason: string) {
    const saved = await persistSite({
      ...site,
      status: "NON_SERVICEABLE",
    });
    setStatus(`NON_SERVICEABLE: ${saved.companyName}. ${reason}`);
    return saved;
  }

  async function buildDecisionForSite(site: CandidateSite, graphId = inventoryId) {
    const graph = await ensureGraph(graphId);
    if (!graph) {
      setStatus("Select an inventory graph before analyzing a site.");
      return null;
    }
    const originalCoordinate = candidateCoordinate(site);
    const geocodedSite = await resolveGeocodedSite(site);
    if (!geocodedSite) {
      return null;
    }
    const nextCoordinate = candidateCoordinate(geocodedSite);
    const coordinateChanged =
      !originalCoordinate ||
      !nextCoordinate ||
      Math.abs(originalCoordinate[0] - nextCoordinate[0]) > 0.000001 ||
      Math.abs(originalCoordinate[1] - nextCoordinate[1]) > 0.000001;
    const existingSeed = coordinateChanged ? undefined : seeds.find((item) => item.candidateSiteId === geocodedSite.candidateId && item.inventoryId === graph.inventoryId && hasScopeVersionCertification(item));
    const seed = existingSeed ?? generateOpportunitySeedForCandidate(graph, geocodedSite);
    if (!seed) {
      await markNonServiceable(geocodedSite, "No route, node, station, or lateral path could be generated.");
      setDraftSeed(null);
      return null;
    }
    const nextBuildPath = seed.buildPath ?? seed.networkAffinity?.buildPath;
    const nextRoute = graph.routes.find((item) => item.routeId === (nextBuildPath?.routeId ?? seed.nearestRouteId));
    const nextNode = graph.nodes.find((item) => item.nodeId === (nextBuildPath?.nodeId ?? seed.nearestNodeId));
    const nextStation = graph.stations.find((item) => item.stationId === (nextBuildPath?.stationId ?? seed.nearestStationId));
    if (!isServiceableSeed(seed, nextRoute, nextNode, nextStation)) {
      await markNonServiceable(geocodedSite, "Attachment evidence is incomplete.");
      setDraftSeed(seed);
      return null;
    }
    setDraftSeed(seed);
    setSeedId(seed.id);
    setInventoryId(seed.inventoryId);
    setSelectedOpportunitySeed(seed);
    setSelectedOpportunitySeedId(seed.id);
    setSelectedCandidateSite(geocodedSite);
    setSelectedCandidateSiteId(geocodedSite.candidateId);
    setStatus(`Decision ready for ${geocodedSite.companyName}: ${Math.round(seed.distanceFeet)} ft lateral / ${Math.round(seed.overallScore)} composite.`);
    return seed;
  }

  async function selectCandidate(nextCandidateId: string) {
    const site = sites.find((item) => item.candidateId === nextCandidateId) ?? null;
    setCandidateId(nextCandidateId);
    setSelectedCandidateSite(site);
    setSelectedCandidateSiteId(site?.candidateId ?? "");
    const seed = seeds.find((item) => item.candidateSiteId === nextCandidateId) ?? null;
    setSeedId(seed?.id ?? "");
    setDraftSeed(seed);
    if (seed) {
      setSelectedOpportunitySeed(seed);
      setSelectedOpportunitySeedId(seed.id);
      setInventoryId(seed.inventoryId);
    }
    if (site) await buildDecisionForSite(site, seed?.inventoryId ?? inventoryId);
  }

  async function selectSeed(nextSeedId: string) {
    const seed = seeds.find((item) => item.id === nextSeedId) ?? null;
    setSeedId(nextSeedId);
    setDraftSeed(seed);
    if (seed) {
      setSelectedOpportunitySeed(seed);
      setSelectedOpportunitySeedId(seed.id);
      setInventoryId(seed.inventoryId);
      const site = sites.find((item) => item.candidateId === seed.candidateSiteId) ?? selectedCandidateSite ?? siteFromSeed(seed);
      if (site) {
        setCandidateId(site.candidateId);
        setSelectedCandidateSite(site);
        setSelectedCandidateSiteId(site.candidateId);
      }
      await ensureGraph(seed.inventoryId);
      if (site) await buildDecisionForSite(site, seed.inventoryId);
    }
  }

  async function analyzeDecision() {
    const site = sites.find((item) => item.candidateId === candidateId) ?? selectedCandidateSite;
    if (!site) {
      setStatus("Select a candidate site before analyzing.");
      return;
    }
    await buildDecisionForSite(site);
  }

  function updateDecisionRouteGeometry(geometry: DALCoordinate[]) {
    setRouteGeometry(geometry);
    setSelectedRouteAlternativeId("");
    setRouteCertification(null);
    setRouteCertificationState("ENGINEER_REVIEW_REQUIRED");
    setQuoteWorksheet(null);
    setStatus("Decision route geometry updated in MapKernel. Human certification is required before creating a child ScopeVersion.");
  }

  function promoteDecisionRouteAlternative(route: AttachmentAwareRouteResult) {
    updateDecisionRouteGeometry(route.geometry);
    setSelectedRouteAlternativeId(route.routeId);
    setStatus(`${route.routingPreference.replaceAll("_", " ")} route promoted. Mode ${route.routingMode}; certify after constraint review.`);
  }

  function updateDecisionSnapAuthority(nextSnapAuthority: SnapAuthorityResult) {
    setSnapAuthority(nextSnapAuthority);
    setSnapCertification(null);
    setSnapCertificationState("REVIEW_SNAP");
    setRouteCertification(null);
    setRouteCertificationState("DRAFT_ROUTE");
    setQuoteWorksheet(null);
    setStatus("Street snap reference updated. Certify snap evidence before route certification.");
  }

  function certifyDecisionSnap(snapshot: SnapCertificationSnapshot) {
    setSnapCertification(snapshot);
    setSnapAuthority(snapshot);
    setSnapCertificationState("CERTIFIED_SNAP");
    setStatus("Street snap certified. Route geometry may now enter engineering certification.");
  }

  function rejectDecisionSnap(snapshot: SnapCertificationSnapshot) {
    setSnapCertification(snapshot);
    setSnapAuthority(snapshot);
    setSnapCertificationState("REJECTED_SNAP");
    setRouteCertification(null);
    setRouteCertificationState("REJECTED_ROUTE");
    setStatus("Street snap rejected. Route certification and child ScopeVersion creation are blocked.");
  }

  function certifyDecisionRoute(certification: RouteCertificationSnapshot) {
    if (!canUseSnapForRoute(snapCertification)) {
      setStatus("Street snap certification is required before route certification.");
      return;
    }
    const authority =
      certification.certificationAuthority ??
      deriveRouteCertificationState({
        routeGeometryHash: certification.certifiedGeometryHash,
        constraintEvidencePackage: certification.constraintEvidencePackage ?? decisionRouteConstraintAnalysis,
        engineerApproval: {
          approved: certification.status === "CERTIFIED_ROUTE" || certification.status === "PROVISIONALLY_CERTIFIED",
          rejected: certification.status === "REJECTED_ROUTE",
          notes: certification.certificationNotes,
          certifiedBy: certification.engineerName,
          certifiedAt: certification.certifiedAt,
        },
        snapCertificationState: snapCertification.status,
      });
    if (authority.state !== "CERTIFIED_ROUTE" && authority.state !== "PROVISIONALLY_CERTIFIED") {
      setStatus(`Route certification blocked by Certification Authority: ${authority.state}. ${authority.requiredActions.join(" ") || authority.reasons.join(" ")}`);
      return;
    }
    setRouteCertification(certification);
    setRouteGeometry(certification.certifiedGeometrySnapshot);
    setRouteCertificationState(authority.state);
    setStatus(
      authority.state === "PROVISIONALLY_CERTIFIED"
        ? `Route provisionally certified by ${certification.engineerName}. ${authority.reasons.join(" ")}`
        : `Route certified by ${certification.engineerName}. Child ScopeVersion creation and package progression are enabled.`
    );
  }

  function rejectDecisionRoute(certification: RouteCertificationSnapshot) {
    setRouteCertification(certification);
    setRouteCertificationState("REJECTED_ROUTE");
    setStatus("Route rejected. Create ScopeVersion remains blocked until an engineer certifies route geometry.");
  }

  async function createDecisionScopeVersion() {
    const graph = await ensureGraph();
    const site = sites.find((item) => item.candidateId === candidateId) ?? selectedCandidateSite ?? siteFromSeed(draftSeed) ?? undefined;
    if (!graph) {
      setStatus("Load an inventory graph before creating a ScopeVersion.");
      return;
    }
    let seed = draftSeed;
    if (!seed && site) seed = generateOpportunitySeedForCandidate(graph, site);
    if (seed && site && !hasScopeVersionCertification(seed)) {
      const regenerated = generateOpportunitySeedForCandidate(graph, site);
      if (regenerated) seed = regenerated;
    }
    if (!seed) {
      setStatus("Analyze a geocoded site or select an Opportunity Seed before creating a ScopeVersion.");
      return;
    }
    if (!hasScopeVersionCertification(seed)) {
      setStatus("ScopeVersion blocked: certified attachment, lateral, and serviceability assessment are required.");
      return;
    }
    if (!snapCertification || !canUseSnapForRoute(snapCertification)) {
      setStatus("ScopeVersion blocked: certified street snap evidence is required before route geometry can be used.");
      return;
    }
    if (!routeCertification || !canCreateScopeVersionFromRoute(routeCertification)) {
      setStatus(`ScopeVersion blocked by Certification Authority: ${routeAuthority?.state ?? "ENGINEER_REVIEW_REQUIRED"}.`);
      return;
    }
    const savedSeed = seeds.some((item) => item.id === seed?.id) ? seed : await saveOpportunitySeed(seed);
    const scopeBuildPath = savedSeed.buildPath ?? savedSeed.networkAffinity?.buildPath;
    const scopeRoute = graph.routes.find((item) => item.routeId === (scopeBuildPath?.routeId ?? savedSeed.nearestRouteId));
    const scopeNode = graph.nodes.find((item) => item.nodeId === (scopeBuildPath?.nodeId ?? savedSeed.nearestNodeId));
    const scopeStation = graph.stations.find((item) => item.stationId === (scopeBuildPath?.stationId ?? savedSeed.nearestStationId));
    let draftScope;
    try {
      draftScope = createScopeVersionFromSiteDecision({ site, seed: savedSeed, route: scopeRoute, node: scopeNode, station: scopeStation, quoteBasis: null });
      const parentScopeVersionId = graph.scopeVersionId ?? graph.metadata.scopeVersionId ?? `SV-INV-${graph.inventoryId}`;
      draftScope = applyCertifiedRouteToScopeVersion(draftScope, routeCertification, snapCertification, snapStreetCenterlines, parentScopeVersionId);
    } catch (err: any) {
      setStatus(`ScopeVersion blocked: ${err?.message ?? String(err)}`);
      return;
    }
    const validation = validateScopeVersion(draftScope);
    if (!validation.valid) {
      setStatus(`ScopeVersion validation failed: ${validation.errors.map((item) => item.message).join(" ")}`);
      return;
    }
    const scope = await saveScopeVersion(draftScope);
    setDraftSeed(savedSeed);
    setSelectedOpportunitySeed(savedSeed);
    setSelectedOpportunitySeedId(savedSeed.id);
    setSelectedScopeVersion(scope);
    setSelectedScopeVersionId(scope.scopeVersionId);
    setQuoteWorksheet(null);
    setStatus(`Created ScopeVersion ${scope.scopeVersionId} from ${site?.companyName ?? savedSeed.siteName ?? savedSeed.id}.`);
  }

  async function generateQuoteFromScopeVersion() {
    const scope = selectedScopeVersion;
    if (!scope) {
      setStatus("Create a ScopeVersion before generating a preliminary quote.");
      return;
    }
    const quote = generatePreliminaryQuote(scope);
    const savedQuote = await saveMarketplaceQuote(quote);
    const quotedScope = await saveScopeVersion(applyQuoteToScopeVersion(scope, savedQuote));
    setQuoteWorksheet(savedQuote);
    setQuotes((prev) => [savedQuote, ...prev.filter((quote) => quote.quoteId !== savedQuote.quoteId)]);
    setSelectedScopeVersion(quotedScope);
    setSelectedScopeVersionId(quotedScope.scopeVersionId);
    setStatus(`Generated ${savedQuote.quoteStatus ?? "PRELIMINARY_QUOTE"} ${savedQuote.quoteId} for ${quotedScope.scopeVersionId}.`);
  }

  const activeSite = useMemo(
    () =>
      sites.find((site) => site.candidateId === candidateId) ??
      selectedCandidateSite ??
      sites.find((site) => site.candidateId === draftSeed?.candidateSiteId) ??
      siteFromSeed(draftSeed ?? selectedOpportunitySeed) ??
      null,
    [candidateId, draftSeed, selectedCandidateSite, selectedOpportunitySeed, sites]
  );
  const activeSeed = draftSeed ?? selectedOpportunitySeed ?? seeds.find((seed) => seed.candidateSiteId === activeSite?.candidateId) ?? seeds[0] ?? null;
  const activeScopeQuote = (selectedScopeVersion?.canonicalTruth as any)?.quoteBasis as MarketplaceQuote | undefined;
  const quoteBasis = useMemo(() => quoteWorksheet ?? activeScopeQuote ?? quoteBasisFor(activeSeed, quotes.find((quote) => quote.opportunitySeedId === activeSeed?.id)), [activeScopeQuote, activeSeed, quoteWorksheet, quotes]);
  const constructability = activeSeed?.constructabilityAssessment ?? activeSeed?.networkAffinity?.constructabilityAssessment ?? activeSeed?.buildPath?.constructabilityAssessment;
  const buildPath = activeSeed?.buildPath ?? activeSeed?.networkAffinity?.buildPath;
  const certifiedLateral = lateralCertificationForSeed(activeSeed);
  const certifiedLateralGeometry = useMemo(() => certifiedLateral?.geometry ?? buildPath?.geometry ?? [], [buildPath?.geometry, certifiedLateral?.geometry]);
  const route = decisionGraph?.routes.find((item) => item.routeId === (buildPath?.routeId ?? activeSeed?.nearestRouteId));
  const node = decisionGraph?.nodes.find((item) => item.nodeId === (buildPath?.nodeId ?? activeSeed?.nearestNodeId));
  const station = decisionGraph?.stations.find((item) => item.stationId === (buildPath?.stationId ?? activeSeed?.nearestStationId));
  const crossings = useMemo(() => crossingPointsFor(activeSeed), [activeSeed]);

  useEffect(() => {
    setRouteGeometry(certifiedLateralGeometry);
    setSelectedRouteAlternativeId("");
    setSelectedRouteVertexIndex(null);
    setRouteCertification(null);
    setRouteCertificationState(certifiedLateralGeometry.length >= 2 ? "DRAFT_ROUTE" : "REJECTED_ROUTE");
  }, [activeSeed?.id, activeSite?.candidateId, certifiedLateralGeometry]);

  const decisionContext = useMemo<DecisionContext | null>(() => {
    if (!activeSite || !activeSeed || !decisionGraph) return null;
    const certifiedAttachment = attachmentCertificationForSeed(activeSeed);
    const attachmentPoint = certifiedAttachment
      ? ([certifiedAttachment.longitude, certifiedAttachment.latitude] as DALCoordinate)
      : activeSeed.networkAffinity?.preferredAttachmentPoint ?? (buildPath?.geometry?.length ? buildPath.geometry[buildPath.geometry.length - 1] : undefined);
    const candidatePoint =
      Number.isFinite(activeSite.longitude) && Number.isFinite(activeSite.latitude)
        ? ([Number(activeSite.longitude), Number(activeSite.latitude)] as DALCoordinate)
        : undefined;
    const buildPathRecord = buildPath as unknown as Record<string, any> | undefined;
    const attachmentAuthority = attachmentPoint
      ? resolveAttachmentAuthority({
          candidate: activeSite,
          candidateCoordinate: candidatePoint,
          inventoryScopeVersion: inventoryAuthorityScopeVersion(decisionGraph),
          station: station ? { stationId: station.stationId, lon: station.lon, lat: station.lat } : { stationId: buildPath?.stationId ?? activeSeed.nearestStationId },
          node: node ? { nodeId: node.nodeId, lon: node.lon, lat: node.lat } : { nodeId: buildPath?.nodeId ?? activeSeed.nearestNodeId },
          edge: {
            edgeId: String(buildPathRecord?.edgeId ?? buildPathRecord?.routeSegmentId ?? certifiedAttachment?.routeSegmentId ?? ""),
            routeId: buildPath?.routeId ?? activeSeed.nearestRouteId,
            projectedLon: attachmentPoint[0],
            projectedLat: attachmentPoint[1],
            distanceFeet: Number(activeSeed.distanceFeet ?? 0),
          },
          route: route ? { routeId: route.routeId, coordinates: route.coordinates } : { routeId: buildPath?.routeId ?? activeSeed.nearestRouteId },
          certifiedAttachment: certifiedAttachment
            ? {
                attachmentId: certifiedAttachment.attachmentId,
                routeId: certifiedAttachment.routeId,
                stationId: certifiedAttachment.stationId,
                nodeId: certifiedAttachment.nodeId,
                edgeId: certifiedAttachment.routeSegmentId,
                lon: certifiedAttachment.longitude,
                lat: certifiedAttachment.latitude,
              }
            : undefined,
          attachmentCoordinate: attachmentPoint,
        })
      : null;
    const evidence = evidenceFor({ site: activeSite, seed: activeSeed, quoteBasis, route, node, station });
    const lateralDiagnostics = lateralCertificationForSeed(activeSeed);
    const accessPoints = lateralDiagnostics?.routeAccessPoints ?? buildPath?.routeAccessPoints;
    const routeTrace: RouteTraceStep[] = [
      { label: "Existing Inventory Route", entityId: route?.routeId ?? buildPath?.routeId ?? activeSeed.nearestRouteId ?? "route" },
      { label: "Nearest Station", entityId: station?.stationId ?? buildPath?.stationId ?? activeSeed.nearestStationId ?? "station", coordinate: station ? [station.lon, station.lat] : undefined },
      { label: "Certified Attachment", entityId: certifiedAttachment?.attachmentId ?? activeSeed.attachmentStrategy?.attachmentType ?? "attachment", coordinate: attachmentPoint },
      { label: "Road Access", entityId: "road-access", coordinate: accessPoints?.roadAccess ?? accessPoints?.streetSnap },
      { label: "Parking Access Lane", entityId: "parking-access", coordinate: accessPoints?.parkingAccess },
      { label: "Driveway", entityId: "driveway-access", coordinate: accessPoints?.drivewayAccess },
      { label: "Building Entrance", entityId: "building-entrance", coordinate: accessPoints?.buildingEntrance },
      {
        label: "Candidate",
        entityId: activeSite.candidateId,
        coordinate:
          Number.isFinite(activeSite.longitude) && Number.isFinite(activeSite.latitude)
            ? ([Number(activeSite.longitude), Number(activeSite.latitude)] as DALCoordinate)
            : undefined,
      },
    ];
    return {
      site: activeSite,
      seed: activeSeed,
      graph: decisionGraph,
      route,
      node,
      station,
      attachmentPoint,
      attachmentAuthority: attachmentAuthority ?? undefined,
      buildPath,
      crossings,
      evidence,
      routeTrace,
      quoteBasis,
    };
  }, [activeSite, activeSeed, buildPath, crossings, decisionGraph, node, quoteBasis, route, station]);

  useEffect(() => {
    if (!decisionContext) {
      setSnapAuthority(null);
      setSnapStreetCenterlines([]);
      setSnapCertification(null);
      setSnapCertificationState("REJECTED_SNAP");
      return;
    }
    const candidate = candidateCoordinate(decisionContext.site);
    const lateralDiagnostics = lateralCertificationForSeed(decisionContext.seed);
    const accessPoints = lateralDiagnostics?.routeAccessPoints ?? decisionContext.buildPath?.routeAccessPoints;
    const snapped = accessPoints?.streetSnap ?? accessPoints?.roadAccess ?? certifiedLateralGeometry[1] ?? certifiedLateralGeometry[0] ?? candidate;
    const attachment = decisionContext.attachmentPoint ?? certifiedLateralGeometry[certifiedLateralGeometry.length - 1] ?? snapped;
    if (!candidate || !snapped || !attachment) {
      setSnapAuthority(null);
      setSnapStreetCenterlines([]);
      setSnapCertification(null);
      setSnapCertificationState("REJECTED_SNAP");
      return;
    }
    const streets = buildDeterministicStreetCenterlines({
      candidateId: decisionContext.site.candidateId,
      candidateCoordinate: candidate,
      snappedCoordinate: snapped,
      streetName: "Candidate access centerline",
      streetClass: "Local",
    });
    const resolved = resolveSnapAuthority({
      candidateCoordinate: candidate,
      attachmentCoordinate: attachment,
      streetCenterlines: streets,
      stationCoordinate: decisionContext.station ? [decisionContext.station.lon, decisionContext.station.lat] : undefined,
      nodeCoordinate: decisionContext.node ? [decisionContext.node.lon, decisionContext.node.lat] : undefined,
      edgeCoordinate: attachment,
      routeCoordinate: decisionContext.route?.coordinates[0],
    });
    const registryContext = getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry([candidate, attachment]) });
    const constructabilitySnap =
      decisionContext.attachmentAuthority
        ? resolveConstructabilityAwareSnap({
            candidateCoordinate: candidate,
            candidateSnapCoordinate: resolved.snappedCoordinate,
            inventoryScopeVersion: inventoryAuthorityScopeVersion(decisionContext.graph),
            attachmentAuthority: decisionContext.attachmentAuthority,
            constraintRegistrySnapshot: registryContext.constraintRegistrySnapshot,
            constraintRegistryFeatures: registryContext.constraintRegistryFeatures,
          })
        : null;
    setSnapStreetCenterlines(streets);
    setSnapAuthority(snapAuthorityFromConstructability(resolved, constructabilitySnap));
    setSnapCertification(null);
    setSnapCertificationState("DRAFT_SNAP");
  }, [decisionContext?.seed.id, decisionContext?.site.candidateId, certifiedLateralGeometry]);

  const decisionRouteConstraintAnalysis = useMemo(() => {
    const candidate = decisionContext ? candidateCoordinate(decisionContext.site) : null;
    if (!decisionContext?.attachmentAuthority || !candidate || routeGeometry.length < 2) return null;
    const registryContext = getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry(routeGeometry) });
    return analyzeRouteConstraints({
      parentScopeVersionId: decisionContext.graph.scopeVersionId ?? decisionContext.graph.metadata.scopeVersionId ?? `SV-INV-${decisionContext.graph.inventoryId}`,
      candidateSiteId: decisionContext.site.candidateId,
      attachmentAuthority: decisionContext.attachmentAuthority,
      candidateCoordinate: { lon: candidate[0], lat: candidate[1] },
      proposedGeometry: routeGeometry,
      referenceLayers: { streets: snapStreetCenterlines, ...registryContext },
      routeGeometrySource: routeCertification?.status === "CERTIFIED_ROUTE" || routeCertification?.status === "PROVISIONALLY_CERTIFIED" ? "CERTIFIED_ROUTE" : "ENGINEER_EDITED",
      analysisMode: routeCertification?.status === "CERTIFIED_ROUTE" || routeCertification?.status === "PROVISIONALLY_CERTIFIED" ? "CERTIFIED_SNAPSHOT" : "ENGINEER_EDITED",
      supersedesEvidenceId: routeCertification?.constraintEvidenceId,
    });
  }, [decisionContext, routeCertification?.constraintEvidenceId, routeCertification?.status, routeGeometry, snapStreetCenterlines]);

  const routeAuthority = useMemo(() => {
    const evidence = routeCertification?.constraintEvidencePackage ?? decisionRouteConstraintAnalysis;
    const routeGeometryHash = routeCertification?.certifiedGeometryHash ?? evidence?.routeGeometryHash ?? "";
    return (
      routeCertification?.certificationAuthority ??
      deriveRouteCertificationState({
        routeGeometryHash,
        constraintEvidencePackage: evidence,
        engineerApproval: routeCertification
          ? {
              approved: routeCertification.status === "CERTIFIED_ROUTE" || routeCertification.status === "PROVISIONALLY_CERTIFIED",
              rejected: routeCertification.status === "REJECTED_ROUTE",
              notes: routeCertification.certificationNotes,
              certifiedBy: routeCertification.engineerName,
              certifiedAt: routeCertification.certifiedAt,
            }
          : {
              approved: false,
              notes: routeCertificationNotes,
              certifiedBy: routeEngineerName,
            },
        snapCertificationState: snapCertification?.status ?? snapCertificationState,
      })
    );
  }, [decisionRouteConstraintAnalysis, routeCertification, routeCertificationNotes, routeEngineerName, snapCertification?.status, snapCertificationState]);

  const decisionRouteAlternatives = useMemo<AttachmentAwareRouteResult[]>(() => {
    const candidate = decisionContext ? candidateCoordinate(decisionContext.site) : null;
    if (!decisionContext?.attachmentAuthority || !decisionContext.attachmentPoint || !candidate) return [];
    const registryContext = getConstraintRegistryAnalysisContext();
    return generateAttachmentAwareRouteAlternatives({
      parentScopeVersionId: decisionContext.graph.scopeVersionId ?? decisionContext.graph.metadata.scopeVersionId ?? `SV-INV-${decisionContext.graph.inventoryId}`,
      candidateSiteId: decisionContext.site.candidateId,
      attachmentAuthority: decisionContext.attachmentAuthority,
      attachmentCoordinate: { lon: decisionContext.attachmentPoint[0], lat: decisionContext.attachmentPoint[1] },
      candidateCoordinate: { lon: candidate[0], lat: candidate[1] },
      referenceLayers: { streets: snapStreetCenterlines, ...registryContext },
      routingPreference: "LOWEST_CONFLICT",
    });
  }, [decisionContext, snapStreetCenterlines]);

  const decisionMapScopeVersion = useMemo<ScopeVersion | null>(() => {
    const selectedMatchesDecision =
      selectedScopeVersion &&
      (!activeSeed || selectedScopeVersion.sourceOpportunityId === activeSeed.id || (selectedScopeVersion.canonicalTruth as any)?.opportunitySeedId === activeSeed.id) &&
      (!activeSite || selectedScopeVersion.candidateSiteId === activeSite.candidateId || (selectedScopeVersion.canonicalTruth as any)?.sourceCandidate?.candidateSiteId === activeSite.candidateId);
    if (selectedMatchesDecision) return selectedScopeVersion;
    if (!decisionContext || !hasScopeVersionCertification(decisionContext.seed)) return null;
    const preview = createDecisionMapScopeVersion(decisionContext);
    if (routeCertification && routeAuthority.canCreateChildScopeVersion) {
      const parentScopeVersionId = decisionContext.graph.scopeVersionId ?? decisionContext.graph.metadata.scopeVersionId ?? `SV-INV-${decisionContext.graph.inventoryId}`;
      return snapCertification ? applyCertifiedRouteToScopeVersion(preview, routeCertification, snapCertification, snapStreetCenterlines, parentScopeVersionId) : preview;
    }
    return preview;
  }, [activeSeed, activeSite, decisionContext, routeAuthority.canCreateChildScopeVersion, routeCertification, selectedScopeVersion, snapCertification, snapStreetCenterlines]);
  const decisionMapSpec = useMemo(() => (decisionMapScopeVersion ? renderScopeVersion(decisionMapScopeVersion) : null), [decisionMapScopeVersion]);
  const decisionStreetSpec = useMemo(() => (snapStreetCenterlines.length ? renderStreetCenterlineLayer(snapStreetCenterlines, activeSeed?.id ?? activeSite?.candidateId ?? "site-decision") : null), [
    activeSeed?.id,
    activeSite?.candidateId,
    snapStreetCenterlines,
  ]);
  const decisionSnapSpec = useMemo(() => renderSnapAuthoritySpec(snapAuthority, activeSeed?.id ?? activeSite?.candidateId ?? "site-decision"), [activeSeed?.id, activeSite?.candidateId, snapAuthority]);
  const decisionConstraintSpec = useMemo(
    () =>
      renderConstraintAnalysis({
        result: decisionRouteConstraintAnalysis,
        sourceId: activeSeed?.id ?? activeSite?.candidateId ?? "site-decision",
        scopeVersionId: decisionMapScopeVersion?.scopeVersionId,
      }),
    [activeSeed?.id, activeSite?.candidateId, decisionMapScopeVersion?.scopeVersionId, decisionRouteConstraintAnalysis]
  );
  const decisionRegistrySpecs = useMemo(
    () => renderReferenceLayers(constraintFeaturesToReferenceLayers(getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry(routeGeometry) }).constraintRegistryFeatures)),
    [decisionRouteConstraintAnalysis?.evidenceId, routeGeometry]
  );
  const decisionMapSpecs = useMemo(
    () => [decisionStreetSpec, ...decisionRegistrySpecs, decisionMapSpec, decisionSnapSpec, decisionConstraintSpec].filter((spec): spec is MapKernelRenderSpec => Boolean(spec)),
    [decisionConstraintSpec, decisionMapSpec, decisionRegistrySpecs, decisionSnapSpec, decisionStreetSpec]
  );
  const mapKernelDiagnostics = useMemo(() => buildMapKernelDiagnostics(decisionMapScopeVersion, decisionMapSpecs), [decisionMapScopeVersion, decisionMapSpecs]);
  const diagnostics = useMemo<DecisionDiagnostics>(
    () => ({
      serviceability: serviceabilityForSeed(activeSeed)?.status ?? (decisionContext ? "SERVICEABLE" : activeSite?.status === "NON_SERVICEABLE" ? "NON_SERVICEABLE" : "PENDING"),
      attachmentCertification: attachmentCertificationForSeed(activeSeed)?.certificationStatus ?? "PENDING",
      lateralCertification: lateralCertificationForSeed(activeSeed)?.certificationStatus ?? "PENDING",
      siteCoordinates: coordinateLabel(candidateCoordinate(activeSite)),
      attachmentCoordinates: coordinateLabel(decisionContext?.attachmentPoint),
      routeCoordinates: {
        routeId: route?.routeId,
        totalCount: route?.coordinates.length ?? 0,
        renderedCount: mapKernelDiagnostics.routeCount,
        first: route?.coordinates[0],
        last: route?.coordinates[route.coordinates.length - 1],
      },
      stationCoordinates: coordinateLabel(station ? [station.lon, station.lat] : undefined),
      nodeCoordinates: coordinateLabel(node ? [node.lon, node.lat] : undefined),
      geometryCounts: {
        candidateScopeVersions: mapKernelDiagnostics.metrics.visibleScopeVersions,
        sites: mapKernelDiagnostics.siteCount,
        attachments: mapKernelDiagnostics.attachmentCount,
        backboneRouteCoordinates: route?.coordinates.length ?? 0,
        kernelRoutePrimitives: mapKernelDiagnostics.routeCount,
        lateralCoordinates: certifiedLateralGeometry.length,
        stations: mapKernelDiagnostics.stationCount,
        nodes: mapKernelDiagnostics.nodeCount,
        edges: mapKernelDiagnostics.edgeCount,
        crossings: crossings.length,
        kernelPrimitives: mapKernelDiagnostics.primitiveCount,
      },
    }),
    [activeSeed, activeSite, certifiedLateralGeometry.length, crossings.length, decisionContext, mapKernelDiagnostics, node, route, station]
  );
  const scopePreview = useMemo(
    () =>
      decisionContext
        ? {
            networkBasis: {
              routeId: decisionContext.buildPath?.routeId ?? decisionContext.seed.nearestRouteId,
              routeName: decisionContext.route?.name,
              nodeId: decisionContext.buildPath?.nodeId ?? decisionContext.seed.nearestNodeId,
              nodeName: decisionContext.node?.nodeId,
              stationId: decisionContext.buildPath?.stationId ?? decisionContext.seed.nearestStationId,
              stationName: decisionContext.station?.label,
              attachmentPoint: decisionContext.attachmentPoint,
              attachmentCoordinates: decisionContext.attachmentPoint,
              attachmentAuthority: decisionContext.attachmentAuthority,
              attachmentMethod: decisionContext.attachmentAuthority?.attachmentMethod,
              attachmentConfidence: decisionContext.attachmentAuthority?.attachmentConfidence,
              capacityStatus: decisionContext.seed.capacityStatus ?? decisionContext.seed.networkAffinity?.capacity.projectedUtilization,
              attachmentStrategy: decisionContext.seed.attachmentStrategy?.attachmentType,
              networkAffinityScore: decisionContext.seed.networkAffinityScore ?? decisionContext.seed.networkAffinity?.affinityScore,
              certificationStatus: attachmentCertificationForSeed(decisionContext.seed)?.certificationStatus,
              routeCertificationState: routeAuthority.state,
              evidenceGrade: routeAuthority.evidenceGrade,
              missingConstraintLayers: routeAuthority.missingConstraintLayers,
            },
            geographicBasis: {
              candidateLatitude: decisionContext.site.latitude,
              candidateLongitude: decisionContext.site.longitude,
              geocodeProvider: decisionContext.site.geocodeProvider,
              geocodeConfidence: decisionContext.site.geocodeConfidence,
              geometry: decisionContext.buildPath?.geometry,
              buildPath: decisionContext.buildPath,
              routeGeometry: decisionContext.route?.coordinates,
              stationGeometry: decisionContext.station ? [decisionContext.station.lon, decisionContext.station.lat] : undefined,
              nodeGeometry: decisionContext.node ? [decisionContext.node.lon, decisionContext.node.lat] : undefined,
              attachmentGeometry: decisionContext.attachmentPoint,
              lateralGeometry: lateralCertificationForSeed(decisionContext.seed)?.geometry,
            },
            engineeringBasis: {
              constructionType: decisionContext.evidence.constructionType,
              buildFeet: decisionContext.evidence.buildFeet,
              buildMiles: decisionContext.evidence.buildMiles,
              crossings: decisionRouteConstraintAnalysis?.constraints ?? decisionContext.crossings.map((crossing) => ({ id: crossing.id, type: crossing.crossingType, coordinate: crossing.coordinate })),
              roadCrossings: decisionRouteConstraintAnalysis?.summary.roadCrossings ?? decisionContext.evidence.roadCrossings,
              railCrossings: decisionRouteConstraintAnalysis?.summary.railroadCrossings ?? decisionContext.evidence.railCrossings,
              waterCrossings: decisionRouteConstraintAnalysis?.summary.waterCrossings ?? decisionContext.evidence.waterCrossings,
              permits: constructability?.permitting,
              permitAuthorities: constructability?.permitting.authorities,
              constructabilityScore: decisionRouteConstraintAnalysis?.constructabilityScore ?? activeSeed?.constructabilityScore ?? constructability?.constructabilityScore,
              engineeringScore: activeSeed?.engineeringScore,
              constructionAssumptions: decisionContext.seed.constructionAssumptions ?? decisionContext.seed.networkAffinity?.constructionAssumptions,
              attachmentAuthority: decisionContext.attachmentAuthority,
              attachmentCertification: attachmentCertificationForSeed(decisionContext.seed),
              lateralCertification: lateralCertificationForSeed(decisionContext.seed),
              serviceabilityAssessment: serviceabilityForSeed(decisionContext.seed),
              constraintEvidenceId: decisionRouteConstraintAnalysis?.evidenceId,
              constraintEvidencePackage: decisionRouteConstraintAnalysis,
              constraintSummary: decisionRouteConstraintAnalysis?.summary,
              constraints: decisionRouteConstraintAnalysis?.constraints,
              unresolvedConstraints: decisionRouteConstraintAnalysis?.unresolvedConstraints,
              certificationReadiness: decisionRouteConstraintAnalysis?.certificationReadiness,
            },
            financialBasis: {
              estimatedConstructionCost: activeSeed?.buildCost ?? decisionContext.buildPath?.estimatedCost,
              estimatedEngineeringCost: activeSeed?.estimatedEngineeringCost ?? constructability?.estimatedEngineeringCost,
              estimatedPermitCost: activeSeed?.estimatedPermitCost ?? constructability?.estimatedPermitCost,
              estimatedCrossingCost: activeSeed?.estimatedCrossingCost ?? constructability?.estimatedCrossingCost,
              estimatedEnvironmentalCost: activeSeed?.estimatedEnvironmentalCost ?? constructability?.estimatedEnvironmentalCost,
              NRC: decisionContext.quoteBasis?.nrc ?? decisionContext.seed.estimatedNRC,
              MRC: decisionContext.quoteBasis?.mrc ?? decisionContext.seed.estimatedMRC,
              TCV: decisionContext.quoteBasis?.totalContractValue ?? decisionContext.seed.estimatedTCV,
              ROI: decisionContext.seed.roi,
              payback: decisionContext.quoteBasis?.paybackMonths ?? decisionContext.seed.paybackMonths,
              margin: decisionContext.quoteBasis?.margin ?? decisionContext.seed.margin,
              financialScore: activeSeed?.financialScore,
            },
            riskBasis: {
              permitRisk: constructability ? 100 - constructability.permitScore : undefined,
              crossingRisk: constructability ? 100 - constructability.crossingScore : undefined,
              constructionRisk: constructability?.constructionDifficulty,
              environmentalRisk: constructability?.environmentalRisk,
              compositeRisk: decisionContext.seed.riskScore,
            },
            decisionBasis: {
              recommendation: decisionContext.seed.overallScore >= 70 ? "GO" : decisionContext.seed.overallScore >= 50 ? "REVIEW" : "NO_GO",
              compositeScore: decisionContext.seed.overallScore,
              strategicScore: decisionContext.seed.strategicScore,
              engineeringScore: decisionContext.seed.engineeringScore,
              financialScore: decisionContext.seed.financialScore,
              riskScore: decisionContext.seed.riskScore,
              phase: phaseFor(decisionContext.seed),
              priority: priorityFor(decisionContext.seed),
            },
            graphReference: {
              inventoryId: decisionContext.seed.inventoryId,
              graphId: decisionContext.seed.graphId,
              graphVersion: decisionContext.seed.graphId,
            },
            certificationSnapshot: decisionContext.seed.certificationSnapshot ?? decisionContext.seed.networkAffinity?.certificationSnapshot,
            serviceabilityAssessment: serviceabilityForSeed(decisionContext.seed),
            commercial: quoteWorksheet ?? activeScopeQuote ?? decisionContext.quoteBasis,
            scopeVersionMetadata: {
              scopeVersionId: selectedScopeVersion?.scopeVersionId ?? "pending",
              status: selectedScopeVersion?.status ?? "ANALYZED",
              decisionTimestamp: new Date().toISOString(),
              user: "DAL Operator",
              site: {
                candidateId: decisionContext.site.candidateId,
                name: decisionContext.site.companyName,
                address: decisionContext.evidence.candidateAddress,
                latitude: decisionContext.site.latitude,
                longitude: decisionContext.site.longitude,
                geocodeProvider: decisionContext.site.geocodeProvider,
                geocodeConfidence: decisionContext.site.geocodeConfidence,
                geocodeTimestamp: decisionContext.site.geocodeTimestamp ?? decisionContext.site.geocodedAt,
              },
            },
            validation: selectedScopeVersion?.canonicalTruth.validation ?? "Validation runs before commit.",
          }
        : null,
    [activeScopeQuote, constructability, decisionContext, decisionRouteConstraintAnalysis, quoteWorksheet, routeAuthority, selectedScopeVersion?.scopeVersionId, selectedScopeVersion?.status]
  );

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Prism Site Decision</h2>
          <p>Single-site serviceability decision surface grounded in geocoded site location, backbone attachment, lateral path, constructability, and quote basis.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Site Selection</h3>
          <div className="dal-grid compact">
            <select
              value={inventoryId}
              onChange={(event) => {
                setInventoryId(event.target.value);
                setSelectedInventoryId(event.target.value);
                void ensureGraph(event.target.value);
              }}
            >
              <option value="">Select inventory graph</option>
              {graphs.map((graph) => (
                <option key={graph.inventoryId} value={graph.inventoryId}>
                  {graph.name} ({fmt(graph.routeCount)} routes)
                </option>
              ))}
            </select>
            <select value={candidateId} onChange={(event) => void selectCandidate(event.target.value)}>
              <option value="">Select Candidate Site</option>
              {sites.map((site) => (
                <option key={site.candidateId} value={site.candidateId}>
                  {site.companyName}
                </option>
              ))}
            </select>
            <select value={seedId} onChange={(event) => void selectSeed(event.target.value)}>
              <option value="">Select Opportunity Seed / Portfolio Entry</option>
              {seeds.map((seed) => (
                <option key={seed.id} value={seed.id}>
                  #{seed.rank ?? "-"} {seed.siteName ?? seed.id} ({Math.round(seed.overallScore)})
                </option>
              ))}
            </select>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void analyzeDecision()}>
              Analyze Decision
            </button>
            <button type="button" onClick={() => void createDecisionScopeVersion()} disabled={!canUseSnapForRoute(snapCertification) || !routeAuthority.canCreateChildScopeVersion || !canCreateScopeVersionFromRoute(routeCertification)}>
              Create ScopeVersion
            </button>
            <button type="button" onClick={() => void generateQuoteFromScopeVersion()}>
              Generate Quote
            </button>
            <button type="button" onClick={() => setWorkspace("marketplace")}>
              Marketplace
            </button>
          </div>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Recommendation</h3>
          <div className="dal-metrics">
            <span>Phase: {phaseFor(activeSeed)}</span>
            <span>Priority: {priorityFor(activeSeed)}</span>
            <span>Strategic Score: {fmt(Math.round(activeSeed?.strategicScore ?? 0))}</span>
            <span>Engineering Score: {fmt(Math.round(activeSeed?.engineeringScore ?? 0))}</span>
            <span>Financial Score: {fmt(Math.round(activeSeed?.financialScore ?? 0))}</span>
            <span>Composite Score: {fmt(Math.round(activeSeed?.overallScore ?? 0))}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Executive Review</h3>
          <div className="dal-metrics">
            <span>Candidate: {activeSite?.companyName ?? activeSeed?.siteName ?? "n/a"}</span>
            <span>Route: {buildPath?.routeId ?? activeSeed?.nearestRouteId ?? "n/a"}</span>
            <span>Station: {buildPath?.stationId ?? activeSeed?.nearestStationId ?? "n/a"}</span>
            <span>Build Feet: {feetLabel(certifiedLateral?.buildFeet ?? buildPath?.buildFeet ?? activeSeed?.distanceFeet)}</span>
            <span>Build Cost: {money(activeSeed?.buildCost ?? buildPath?.estimatedCost)}</span>
            <span>Payback: {fmt(Math.round(quoteBasis?.paybackMonths ?? activeSeed?.paybackMonths ?? 0))} mo</span>
            <span>ROI: {Number(activeSeed?.roi ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
            <span>Serviceability: {serviceabilityForSeed(activeSeed)?.status ?? "PENDING"}</span>
            <span>Attachment / Lateral: {attachmentCertificationForSeed(activeSeed)?.certificationStatus ?? "PENDING"} / {lateralCertificationForSeed(activeSeed)?.certificationStatus ?? "PENDING"}</span>
            <span>Snap Certification: {snapCertification?.status ?? snapCertificationState}</span>
            <span>Route Certification Authority: {routeAuthority.state}</span>
            <span>Evidence Grade: {routeAuthority.evidenceGrade}</span>
          </div>
          <CertificationAuthorityStrip title="Decision Certification Authority" decision={routeAuthority} />
          <div className="dal-actions">
            <button type="button" onClick={() => void createDecisionScopeVersion()} disabled={!canUseSnapForRoute(snapCertification) || !routeAuthority.canCreateChildScopeVersion || !canCreateScopeVersionFromRoute(routeCertification)}>
              Create Certified ScopeVersion
            </button>
          </div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Decision Map</h3>
          {decisionMapSpecs.length ? (
            <MapKernel
              specs={decisionMapSpecs}
              layerVisibility={{
                scopeVersion: true,
                streetReference: true,
                buildingReference: true,
                parcelReference: true,
                railroadReference: true,
                waterReference: true,
                terrainReference: false,
                site: true,
                attachment: true,
                lateral: true,
                station: true,
                node: true,
                edge: true,
                object: true,
              }}
              showStationLabels
              stationDensityFeet={300}
              height={520}
              initialMode="geographic"
              initialBaseLayer="hybrid"
              editableRoute={{
                routeId: activeSeed ? `${activeSeed.id}:decision-engineering-route` : "decision-engineering-route",
                geometry: routeGeometry,
                enabled: Boolean(decisionContext),
                selectedVertexIndex: selectedRouteVertexIndex,
                onGeometryChange: updateDecisionRouteGeometry,
                onVertexSelect: setSelectedRouteVertexIndex,
              }}
              onSelectionChange={setMapSelection}
            />
          ) : (
            <div className="dal-status">Analyze or select a certified site decision to render candidate ScopeVersion truth through the Map Kernel.</div>
          )}
          <div className="dal-status">
            Rendering path: {"ScopeVersion -> ScopeVersionRenderer -> MapKernel"}. Selection: {mapSelection ? `${mapSelection.kind} ${mapSelection.featureRef.id}` : "none"}.
          </div>
        </div>

        <div className="dal-panel">
          <h3>Decision Evidence</h3>
          {decisionContext ? (
            <>
              <ConstraintEvidenceStrip evidence={decisionRouteConstraintAnalysis} currentGeometry={routeGeometry} title="Decision Evidence Constraint Package" />
              <div className="dal-metrics">
                {Object.entries({
                  ...decisionContext.evidence,
                  crossings: totalKnownCrossingsDisplay(decisionRouteConstraintAnalysis, decisionContext.evidence.crossings),
                  roadCrossings: constraintCountDisplay(decisionRouteConstraintAnalysis, "roadCrossings", decisionContext.evidence.roadCrossings),
                  railCrossings: constraintCountDisplay(decisionRouteConstraintAnalysis, "railroadCrossings", decisionContext.evidence.railCrossings),
                  waterCrossings: constraintCountDisplay(decisionRouteConstraintAnalysis, "waterCrossings", decisionContext.evidence.waterCrossings),
                  waterLayerLoaded: decisionRouteConstraintAnalysis?.waterCrossingAudit.waterLayerLoaded ? "TRUE" : "FALSE",
                  waterFeatureCount: fmt(decisionRouteConstraintAnalysis?.waterCrossingAudit.waterFeatureCount),
                  waterIntersectionsFound: fmt(decisionRouteConstraintAnalysis?.waterCrossingAudit.waterIntersectionsFound),
                  waterAnalysisMethod: decisionRouteConstraintAnalysis?.waterCrossingAudit.analysisMethod ?? "UNKNOWN",
                }).map(([key, value]) => (
                  <span key={key}>
                    {key.replace(/([A-Z])/g, " $1")}: {value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="dal-status">Select a geocoded candidate and inventory graph.</div>
          )}
        </div>

        <SnapAuthorityPanel
          snapAuthority={snapAuthority}
          certification={snapCertification}
          certificationState={snapCertificationState}
          engineerName={snapEngineerName}
          certificationNotes={snapCertificationNotes}
          onSnapAuthorityChange={updateDecisionSnapAuthority}
          onStateChange={setSnapCertificationState}
          onEngineerNameChange={setSnapEngineerName}
          onCertificationNotesChange={setSnapCertificationNotes}
          onCertify={certifyDecisionSnap}
          onReject={rejectDecisionSnap}
        />

        <RouteEngineeringPanel
          title="Route Engineering"
          candidateLabel={activeSite?.companyName ?? activeSeed?.siteName}
          routeLabel={route?.name ?? buildPath?.routeId ?? activeSeed?.nearestRouteId}
          stationLabel={station?.label ?? buildPath?.stationId ?? activeSeed?.nearestStationId}
          nodeLabel={node?.nodeId ?? buildPath?.nodeId ?? activeSeed?.nearestNodeId}
          attachmentLabel={coordinateLabel(decisionContext?.attachmentPoint)}
          geometry={routeGeometry}
          originalGeometry={certifiedLateralGeometry}
          selectedVertexIndex={selectedRouteVertexIndex}
          certificationState={routeCertificationState}
          certification={routeCertification ?? undefined}
          engineerName={routeEngineerName}
          certificationNotes={routeCertificationNotes}
          metricHints={{
            roadCrossings: Number(buildPath?.highwayCrossingCount ?? buildPath?.estimatedCrossings ?? 0),
            railCrossings: Number(constructability?.rail.railCrossingCount ?? buildPath?.railCrossingCount ?? 0),
            waterCrossings: Number(constructability?.water.waterCrossingCount ?? buildPath?.waterCrossingCount ?? 0),
            constructabilityScore: Number(activeSeed?.constructabilityScore ?? constructability?.constructabilityScore ?? 0),
            permitRisk: constructability ? 100 - constructability.permitScore : undefined,
            environmentalRisk: Number(constructability?.environmentalRisk ?? activeSeed?.environmentalRisk ?? 0),
          }}
          routingMode={selectedRouteAlternativeId ? decisionRouteAlternatives.find((route) => route.routeId === selectedRouteAlternativeId)?.routingMode : "ENGINEER_EDITED"}
          constraintAnalysis={decisionRouteConstraintAnalysis}
          routeAlternatives={decisionRouteAlternatives}
          selectedRouteAlternativeId={selectedRouteAlternativeId}
          onPromoteRouteAlternative={promoteDecisionRouteAlternative}
          onGeometryChange={updateDecisionRouteGeometry}
          onVertexSelect={setSelectedRouteVertexIndex}
          onStateChange={setRouteCertificationState}
          onEngineerNameChange={setRouteEngineerName}
          onCertificationNotesChange={setRouteCertificationNotes}
          onCertify={certifyDecisionRoute}
          onReject={rejectDecisionRoute}
        />
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Network</h3>
          <div className="dal-metrics">
            <span>Route: {buildPath?.routeId ?? activeSeed?.nearestRouteId ?? "n/a"}</span>
            <span>Node: {buildPath?.nodeId ?? activeSeed?.nearestNodeId ?? "n/a"}</span>
            <span>Station: {buildPath?.stationId ?? activeSeed?.nearestStationId ?? "n/a"}</span>
            <span>Capacity: {activeSeed?.capacityStatus ?? activeSeed?.networkAffinity?.capacity.projectedUtilization ?? "n/a"}</span>
            <span>Affinity: {fmt(Math.round(activeSeed?.networkAffinityScore ?? activeSeed?.networkAffinity?.affinityScore ?? 0))}</span>
            <span>Attachment: {activeSeed?.attachmentStrategy?.attachmentType?.replaceAll("_", " ") ?? "n/a"}</span>
            <span>Attachment Authority: {decisionContext?.attachmentAuthority?.attachmentAuthority ?? "n/a"}</span>
            <span>Attachment Method: {decisionContext?.attachmentAuthority?.attachmentMethod ?? "n/a"}</span>
            <span>Attachment Confidence: {decisionContext?.attachmentAuthority ? `${Math.round(decisionContext.attachmentAuthority.attachmentConfidence * 100)}%` : "n/a"}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Route Trace</h3>
          {decisionContext ? (
            <div className="dal-list">
              {decisionContext.routeTrace.map((step, index) => (
                <div key={`${step.label}-${index}`} className="dal-list-row">
                  <span>{index + 1}. {step.label}</span>
                  <b>{step.entityId}</b>
                  <small>{step.coordinate ? `${step.coordinate[1].toFixed(6)}, ${step.coordinate[0].toFixed(6)}` : "coordinate n/a"}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="dal-status">Route trace appears after decision context is available.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Decision Diagnostics</h3>
          <div className="dal-metrics">
            <span>Serviceability: {diagnostics.serviceability}</span>
            <span>Attachment Certification: {diagnostics.attachmentCertification}</span>
            <span>Lateral Certification: {diagnostics.lateralCertification}</span>
            <span>Site Coordinates: {diagnostics.siteCoordinates}</span>
            <span>Attachment Coordinates: {diagnostics.attachmentCoordinates}</span>
            <span>Station Coordinates: {diagnostics.stationCoordinates}</span>
            <span>Node Coordinates: {diagnostics.nodeCoordinates}</span>
            <span>Route Coordinates: {fmt(diagnostics.routeCoordinates.totalCount)}</span>
            <span>Rendered Segment Coordinates: {fmt(diagnostics.routeCoordinates.renderedCount)}</span>
            <span>Snap Method: {snapAuthority?.snapMethod ?? "n/a"}</span>
            <span>Snap Reference: {snapAuthority?.snapAuthority ?? "n/a"}</span>
            <span>Snap Alternative: {snapAuthority?.selectedAlternative ?? "n/a"}</span>
            <span>Constructability Snap: {snapAuthority?.constructabilityScore === undefined ? "n/a" : `${snapAuthority.constructabilityScore}/100`}</span>
            <span>Snapped Street: {snapAuthority?.streetName ?? "n/a"}</span>
            <span>Snapped Street Class: {snapAuthority?.streetClass ?? "n/a"}</span>
            <span>Distance To Street: {snapAuthority?.distanceToStreetFeet === undefined ? "n/a" : feetLabel(snapAuthority.distanceToStreetFeet)}</span>
            <span>Distance To Attachment: {snapAuthority ? feetLabel(snapAuthority.distanceToAttachmentFeet) : "n/a"}</span>
          </div>
          <pre className="dal-pre">{JSON.stringify(diagnostics, null, 2)}</pre>
        </div>

        <div className="dal-panel">
          <h3>Geometry Counts</h3>
          <div className="dal-metrics">
            {Object.entries(diagnostics.geometryCounts).map(([key, value]) => (
              <span key={key}>
                {key.replace(/([A-Z])/g, " $1")}: {fmt(value)}
              </span>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Map Kernel Validation</h3>
          <div className="dal-metrics">
            <span>ScopeVersionId: {mapKernelDiagnostics.scopeVersionId}</span>
            <span>Routes: {fmt(mapKernelDiagnostics.routeCount)}</span>
            <span>Stations: {fmt(mapKernelDiagnostics.stationCount)}</span>
            <span>Nodes: {fmt(mapKernelDiagnostics.nodeCount)}</span>
            <span>Edges: {fmt(mapKernelDiagnostics.edgeCount)}</span>
            <span>Objects: {fmt(mapKernelDiagnostics.objectCount)}</span>
            <span>Sites: {fmt(mapKernelDiagnostics.siteCount)}</span>
            <span>Attachments: {fmt(mapKernelDiagnostics.attachmentCount)}</span>
            <span>Laterals: {fmt(mapKernelDiagnostics.lateralCount)}</span>
            <span>Render Authority: {mapKernelDiagnostics.renderAuthority.status}</span>
            <span>Duplicate Keys: {fmt(mapKernelDiagnostics.renderAuthority.duplicateKeyCount)}</span>
            <span>Duplicate Objects: {fmt(mapKernelDiagnostics.renderAuthority.duplicateObjectCount)}</span>
            <span>Duplicate Render Authorities: {fmt(mapKernelDiagnostics.renderAuthority.duplicateRenderAuthorityCount)}</span>
          </div>
          <pre className="dal-pre">
            {JSON.stringify(
              {
                selection: mapKernelDiagnostics.selection,
                viewport: mapKernelDiagnostics.viewport,
                stationing: mapKernelDiagnostics.stationing,
                extensionHooks: mapKernelDiagnostics.extensionHooks,
                renderAuthority: mapKernelDiagnostics.renderAuthority,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Construction</h3>
          <div className="dal-metrics">
            <span>Build Feet: {fmt(Math.round(buildPath?.buildFeet ?? activeSeed?.distanceFeet ?? 0))}</span>
            <span>Build Miles: {Number(activeSeed?.buildMiles ?? buildPath?.buildMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span>
              Crossings:{" "}
              {totalKnownCrossingsDisplay(decisionRouteConstraintAnalysis, fmt(buildPath?.estimatedCrossings))}
            </span>
            <span>Permits: {constructability?.permitting.authorities.join(", ") ?? "n/a"}</span>
            <span>Constructability: {fmt(Math.round(decisionRouteConstraintAnalysis?.constructabilityScore ?? activeSeed?.constructabilityScore ?? constructability?.constructabilityScore ?? 0))}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Financial</h3>
          <div className="dal-metrics">
            <span>NRC: {money(quoteBasis?.nrc ?? activeSeed?.estimatedNRC)}</span>
            <span>MRC: {money(quoteBasis?.mrc ?? activeSeed?.estimatedMRC)}</span>
            <span>TCV: {money(quoteBasis?.totalContractValue ?? activeSeed?.estimatedTCV)}</span>
            <span>Margin: {pct(quoteBasis?.margin ?? activeSeed?.margin)}</span>
            <span>Payback: {fmt(Math.round(quoteBasis?.paybackMonths ?? activeSeed?.paybackMonths ?? 0))} mo</span>
            <span>ROI: {Number(activeSeed?.roi ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Risk</h3>
          <div className="dal-metrics">
            <span>Permit Risk: {fmt(Math.round(constructability ? 100 - constructability.permitScore : 0))}</span>
            <span>Crossing Risk: {fmt(Math.round(constructability ? 100 - constructability.crossingScore : 0))}</span>
            <span>Construction Risk: {fmt(Math.round(constructability?.constructionDifficulty ?? 0))}</span>
            <span>Environmental Risk: {fmt(Math.round(constructability?.environmentalRisk ?? activeSeed?.environmentalRisk ?? 0))}</span>
            <span>Composite Risk: {fmt(Math.round(activeSeed?.riskScore ?? buildPath?.riskScore ?? 0))}</span>
          </div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Quote Worksheet</h3>
          {quoteBasis ? (
            <>
              <ConstraintEvidenceStrip
                evidence={routeCertification?.constraintEvidencePackage ?? ((selectedScopeVersion?.canonicalTruth as any)?.engineeringBasis?.constraintEvidencePackage as any) ?? decisionRouteConstraintAnalysis}
                currentGeometry={routeGeometry}
                title="Quote Constraint Evidence"
              />
              <CertificationAuthorityStrip title="Quote Certification Authority" decision={routeAuthority} />
              <div className="dal-metrics">
                <span>Quote Status: {quoteBasis.quoteStatus ?? "PRELIMINARY_QUOTE"}</span>
                <span>Evidence Grade: {quoteBasis.evidenceGrade ?? routeAuthority.evidenceGrade}</span>
                <span>Evidence Completeness: {Math.round(Number(quoteBasis.constraintCompletenessPercent ?? routeAuthority.constraintCompletenessPercent ?? 0))}%</span>
                <span>Construction NRC: {money(quoteBasis.constructionNrc ?? quoteBasis.estimatedCost)}</span>
                <span>Engineering NRC: {money(quoteBasis.engineeringNrc ?? quoteBasis.estimatedEngineeringCost)}</span>
                <span>Permit NRC: {money(quoteBasis.permitNrc ?? quoteBasis.estimatedPermitCost)}</span>
                <span>Crossing NRC: {money(quoteBasis.crossingNrc ?? quoteBasis.estimatedCrossingCost)}</span>
                <span>Monthly Service: {money(quoteBasis.monthlyService ?? quoteBasis.mrc)}</span>
                <span>Term: {fmt(quoteBasis.termMonths)} mo</span>
                <span>NRC: {money(quoteBasis.nrc)}</span>
                <span>MRC: {money(quoteBasis.mrc)}</span>
                <span>TCV: {money(quoteBasis.totalContractValue)}</span>
                <span>Margin: {pct(quoteBasis.margin)}</span>
                <span>Payback: {fmt(Math.round(quoteBasis.paybackMonths ?? 0))} mo</span>
                <span>ROI: {Number(quoteBasis.roi ?? activeSeed?.roi ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
              </div>
            </>
          ) : (
            <div className="dal-status">Create a ScopeVersion, then generate a quote.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Quote Explainability</h3>
          {quoteBasis?.quoteExplanation ? (
            <>
              <div className="dal-status">{quoteBasis.quoteExplanation.summary}</div>
              <div className="dal-metrics">
                <span>Build Length: {feetLabel(quoteBasis.quoteExplanation.buildLengthFeet)}</span>
                <span>Construction: {quoteBasis.quoteExplanation.constructionType ?? "n/a"}</span>
                <span>Crossings: {fmt(quoteBasis.quoteExplanation.crossings)}</span>
                <span>Permits: {quoteBasis.quoteExplanation.permits?.join(", ") || "n/a"}</span>
                <span>Engineering: {quoteBasis.quoteExplanation.engineeringFactors?.join(" | ") || "n/a"}</span>
                <span>Revenue: {quoteBasis.quoteExplanation.revenueFactors?.join(" | ") || "n/a"}</span>
              </div>
            </>
          ) : (
            <div className="dal-status">Preliminary quote explanation appears after Generate Quote.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>ScopeVersion Preview</h3>
          <ConstraintEvidenceStrip
            evidence={routeCertification?.constraintEvidencePackage ?? ((scopePreview as any)?.engineeringBasis?.constraintEvidencePackage as any) ?? decisionRouteConstraintAnalysis}
            currentGeometry={routeGeometry}
            title="ScopeVersion Preview Constraint Evidence"
          />
          <CertificationAuthorityStrip title="ScopeVersion Preview Certification Authority" decision={routeAuthority} />
          <pre className="dal-pre">{JSON.stringify(scopePreview ?? {}, null, 2)}</pre>
        </div>

        <div className="dal-panel">
          <h3>ScopeVersion Geographic Snapshot</h3>
          <pre className="dal-pre">
            {JSON.stringify(
              decisionContext
                ? {
                    geometry: decisionContext.buildPath?.geometry,
                    attachmentPoint: decisionContext.attachmentPoint,
                    buildPath: decisionContext.buildPath,
                    station: decisionContext.station,
                    route: decisionContext.route
                      ? {
                          routeId: decisionContext.route.routeId,
                          name: decisionContext.route.name,
                          coordinateCount: decisionContext.route.coordinates.length,
                        }
                      : null,
                  }
                : {},
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </section>
  );
}
