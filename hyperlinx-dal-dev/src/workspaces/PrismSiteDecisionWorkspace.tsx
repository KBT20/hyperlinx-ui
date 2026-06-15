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
import { applyQuoteToScopeVersion, generatePreliminaryQuote } from "../commercial/quoteEngine";
import { useDALState } from "../dal/DALState";
import { geocodeCandidateSite, isValidGeocodeCoordinate, realGeocoderConfigured } from "../geocoding/geocodeEngine";
import { LeafletMap, type GISBuildPath, type GISCrossing, type GISPoint, type GISRoute } from "../gis";
import { generateOpportunitySeedForCandidate } from "../prism/opportunityGenerator";
import { createScopeVersionFromSiteDecision } from "../scopeversion/scopeVersionUtils";
import { validateScopeVersion } from "../scopeversion/scopeVersionValidation";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph, InventoryGraphMetadata, InventoryNode, InventoryRoute, InventoryStation, MarketplaceQuote } from "../types/dal";
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
  buildPath?: NonNullable<OpportunitySeed["buildPath"]>;
  crossings: GISCrossing[];
  evidence: DecisionEvidence;
  routeTrace: RouteTraceStep[];
  quoteBasis: MarketplaceQuote | null;
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
    candidates: number;
    attachments: number;
    backboneRouteCoordinates: number;
    renderedBackboneSegmentCoordinates: number;
    lateralCoordinates: number;
    stations: number;
    nodes: number;
    crossings: number;
  };
};

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
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

function routeSegmentForAttachment(route: InventoryRoute | undefined, attachmentPoint?: DALCoordinate, radius = 28) {
  const coordinates = route?.coordinates ?? [];
  if (!coordinates.length) return [];
  if (!attachmentPoint || coordinates.length <= radius * 2 + 1) return coordinates;
  let bestIndex = 0;
  let bestScore = Infinity;
  coordinates.forEach((coord, index) => {
    const dx = coord[0] - attachmentPoint[0];
    const dy = coord[1] - attachmentPoint[1];
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return coordinates.slice(Math.max(0, bestIndex - radius), Math.min(coordinates.length, bestIndex + radius + 1));
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

function crossingPointsFor(seed: OpportunitySeed | null): GISCrossing[] {
  const geometry = seed?.buildPath?.geometry ?? [];
  const constructability = seed?.constructabilityAssessment;
  const roadCount = Number(seed?.buildPath?.highwayCrossingCount ?? 0);
  const railCount = Number(constructability?.rail.railCrossingCount ?? seed?.buildPath?.railCrossingCount ?? 0);
  const waterCount = Number(constructability?.water.waterCrossingCount ?? seed?.buildPath?.waterCrossingCount ?? 0);
  const typedCrossings: Array<GISCrossing["crossingType"]> = [
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
        ? `${attachmentCertification.certificationStatus} / ${lateralCertification.certificationStatus}`
        : "n/a",
    attachmentConfidence: attachmentCertification ? `${Math.round(attachmentCertification.confidenceScore)}%` : "n/a",
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
    const savedSeed = seeds.some((item) => item.id === seed?.id) ? seed : await saveOpportunitySeed(seed);
    const scopeBuildPath = savedSeed.buildPath ?? savedSeed.networkAffinity?.buildPath;
    const scopeRoute = graph.routes.find((item) => item.routeId === (scopeBuildPath?.routeId ?? savedSeed.nearestRouteId));
    const scopeNode = graph.nodes.find((item) => item.nodeId === (scopeBuildPath?.nodeId ?? savedSeed.nearestNodeId));
    const scopeStation = graph.stations.find((item) => item.stationId === (scopeBuildPath?.stationId ?? savedSeed.nearestStationId));
    let draftScope;
    try {
      draftScope = createScopeVersionFromSiteDecision({ site, seed: savedSeed, route: scopeRoute, node: scopeNode, station: scopeStation, quoteBasis: null });
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
    setStatus(`Generated preliminary quote ${savedQuote.quoteId} for ${quotedScope.scopeVersionId}.`);
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
  const certifiedLateralGeometry = certifiedLateral?.geometry ?? buildPath?.geometry ?? [];
  const route = decisionGraph?.routes.find((item) => item.routeId === (buildPath?.routeId ?? activeSeed?.nearestRouteId));
  const node = decisionGraph?.nodes.find((item) => item.nodeId === (buildPath?.nodeId ?? activeSeed?.nearestNodeId));
  const station = decisionGraph?.stations.find((item) => item.stationId === (buildPath?.stationId ?? activeSeed?.nearestStationId));
  const crossings = useMemo(() => crossingPointsFor(activeSeed), [activeSeed]);

  const decisionContext = useMemo<DecisionContext | null>(() => {
    if (!activeSite || !activeSeed || !decisionGraph) return null;
    const certifiedAttachment = attachmentCertificationForSeed(activeSeed);
    const attachmentPoint = certifiedAttachment
      ? ([certifiedAttachment.longitude, certifiedAttachment.latitude] as DALCoordinate)
      : activeSeed.networkAffinity?.preferredAttachmentPoint ?? (buildPath?.geometry?.length ? buildPath.geometry[buildPath.geometry.length - 1] : undefined);
    const evidence = evidenceFor({ site: activeSite, seed: activeSeed, quoteBasis, route, node, station });
    const routeTrace: RouteTraceStep[] = [
      {
        label: "Candidate",
        entityId: activeSite.candidateId,
        coordinate:
          Number.isFinite(activeSite.longitude) && Number.isFinite(activeSite.latitude)
            ? ([Number(activeSite.longitude), Number(activeSite.latitude)] as DALCoordinate)
            : undefined,
      },
      { label: "Certified Attachment", entityId: certifiedAttachment?.attachmentId ?? activeSeed.attachmentStrategy?.attachmentType ?? "attachment", coordinate: attachmentPoint },
      { label: "Route", entityId: route?.routeId ?? buildPath?.routeId ?? activeSeed.nearestRouteId ?? "route" },
      { label: "Station", entityId: station?.stationId ?? buildPath?.stationId ?? activeSeed.nearestStationId ?? "station", coordinate: station ? [station.lon, station.lat] : undefined },
      { label: "Core", entityId: node?.nodeId ?? buildPath?.nodeId ?? activeSeed.nearestNodeId ?? "core", coordinate: node ? [node.lon, node.lat] : undefined },
    ];
    return {
      site: activeSite,
      seed: activeSeed,
      graph: decisionGraph,
      route,
      node,
      station,
      attachmentPoint,
      buildPath,
      crossings,
      evidence,
      routeTrace,
      quoteBasis,
    };
  }, [activeSite, activeSeed, buildPath, crossings, decisionGraph, node, quoteBasis, route, station]);

  const candidatePoints = useMemo<GISPoint[]>(
    () =>
      activeSite && Number.isFinite(activeSite.longitude) && Number.isFinite(activeSite.latitude)
        ? [
            {
              id: activeSite.candidateId,
              label: activeSite.companyName,
              coordinate: [Number(activeSite.longitude), Number(activeSite.latitude)] as DALCoordinate,
              kind: "candidate",
              payload: activeSite,
            },
          ]
        : [],
    [activeSite]
  );
  const attachmentPoints = useMemo<GISPoint[]>(
    () =>
      decisionContext?.attachmentPoint
        ? [
            {
              id: `${decisionContext.seed.id}-attachment`,
              label: decisionContext.seed.attachmentStrategy?.attachmentType?.replaceAll("_", " "),
              coordinate: decisionContext.attachmentPoint,
              kind: "attachment",
              payload: decisionContext.seed.attachmentStrategy,
            },
          ]
        : [],
    [decisionContext]
  );
  const stationPoints = useMemo<GISPoint[]>(
    () =>
      station
        ? [
            {
              id: station.stationId,
              label: station.label,
              coordinate: [station.lon, station.lat],
              kind: "station",
              payload: station,
            },
          ]
        : [],
    [station]
  );
  const nodePoints = useMemo<GISPoint[]>(
    () =>
      node
        ? [
            {
              id: node.nodeId,
              label: node.nodeId,
              coordinate: [node.lon, node.lat],
              kind: "node",
              payload: node,
            },
          ]
        : [],
    [node]
  );
  const backboneRouteSegment = useMemo(() => routeSegmentForAttachment(route, decisionContext?.attachmentPoint), [decisionContext?.attachmentPoint, route]);
  const mapRoutes = useMemo<GISRoute[]>(
    () =>
      route?.coordinates?.length && backboneRouteSegment.length
        ? [
            {
              id: route.routeId,
              label: route.name,
              coordinates: backboneRouteSegment,
              color: "#27c26a",
              width: 4,
              payload: route,
            },
          ]
        : [],
    [backboneRouteSegment, route]
  );
  const mapBuildPaths = useMemo<GISBuildPath[]>(
    () =>
      certifiedLateralGeometry.length
        ? [
            {
              id: `${activeSeed?.id ?? "decision"}-lateral`,
              label: "Certified Lateral",
              coordinates: certifiedLateralGeometry,
              payload: certifiedLateral ?? buildPath,
            },
          ]
        : [],
    [activeSeed?.id, buildPath, certifiedLateral, certifiedLateralGeometry]
  );
  const focusCoordinates = useMemo(() => {
    const coords: DALCoordinate[] = [];
    candidatePoints.forEach((point) => coords.push(point.coordinate));
    attachmentPoints.forEach((point) => coords.push(point.coordinate));
    stationPoints.forEach((point) => coords.push(point.coordinate));
    nodePoints.forEach((point) => coords.push(point.coordinate));
    mapBuildPaths.forEach((path) => path.coordinates.forEach((coord) => coords.push(coord)));
    mapRoutes.forEach((routeItem) => routeItem.coordinates.forEach((coord) => coords.push(coord)));
    crossings.forEach((point) => coords.push(point.coordinate));
    return coords;
  }, [attachmentPoints, candidatePoints, crossings, mapBuildPaths, mapRoutes, nodePoints, stationPoints]);
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
        renderedCount: backboneRouteSegment.length,
        first: route?.coordinates[0],
        last: route?.coordinates[route.coordinates.length - 1],
      },
      stationCoordinates: coordinateLabel(station ? [station.lon, station.lat] : undefined),
      nodeCoordinates: coordinateLabel(node ? [node.lon, node.lat] : undefined),
      geometryCounts: {
        candidates: candidatePoints.length,
        attachments: attachmentPoints.length,
        backboneRouteCoordinates: route?.coordinates.length ?? 0,
        renderedBackboneSegmentCoordinates: backboneRouteSegment.length,
        lateralCoordinates: certifiedLateralGeometry.length,
        stations: stationPoints.length,
        nodes: nodePoints.length,
        crossings: crossings.length,
      },
    }),
    [activeSeed, activeSite, attachmentPoints.length, backboneRouteSegment, certifiedLateralGeometry.length, candidatePoints.length, crossings.length, decisionContext, node, nodePoints.length, route, station, stationPoints.length]
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
              capacityStatus: decisionContext.seed.capacityStatus ?? decisionContext.seed.networkAffinity?.capacity.projectedUtilization,
              attachmentStrategy: decisionContext.seed.attachmentStrategy?.attachmentType,
              networkAffinityScore: decisionContext.seed.networkAffinityScore ?? decisionContext.seed.networkAffinity?.affinityScore,
              certificationStatus: attachmentCertificationForSeed(decisionContext.seed)?.certificationStatus,
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
              crossings: decisionContext.crossings.map((crossing) => ({ id: crossing.id, type: crossing.crossingType, coordinate: crossing.coordinate })),
              roadCrossings: decisionContext.evidence.roadCrossings,
              railCrossings: decisionContext.evidence.railCrossings,
              waterCrossings: decisionContext.evidence.waterCrossings,
              permits: constructability?.permitting,
              permitAuthorities: constructability?.permitting.authorities,
              constructabilityScore: activeSeed?.constructabilityScore ?? constructability?.constructabilityScore,
              engineeringScore: activeSeed?.engineeringScore,
              constructionAssumptions: decisionContext.seed.constructionAssumptions ?? decisionContext.seed.networkAffinity?.constructionAssumptions,
              attachmentCertification: attachmentCertificationForSeed(decisionContext.seed),
              lateralCertification: lateralCertificationForSeed(decisionContext.seed),
              serviceabilityAssessment: serviceabilityForSeed(decisionContext.seed),
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
    [activeScopeQuote, constructability, decisionContext, quoteWorksheet, selectedScopeVersion?.scopeVersionId, selectedScopeVersion?.status]
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
            <button type="button" onClick={() => void createDecisionScopeVersion()}>
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
            <span>Certification: {attachmentCertificationForSeed(activeSeed)?.certificationStatus ?? "PENDING"} / {lateralCertificationForSeed(activeSeed)?.certificationStatus ?? "PENDING"}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void createDecisionScopeVersion()}>
              Create Certified ScopeVersion
            </button>
          </div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Decision Map</h3>
          <LeafletMap
            autoFocusKey={`${decisionContext?.site.candidateId ?? "no-site"}-${decisionContext?.seed.id ?? "no-seed"}`}
            focusCoordinates={focusCoordinates}
            candidates={candidatePoints}
            attachments={attachmentPoints}
            routes={mapRoutes}
            buildPaths={mapBuildPaths}
            crossings={crossings}
            stations={stationPoints}
            nodes={nodePoints}
          />
          <div className="dal-status">Blue candidate, green attachment/backbone, yellow lateral, red crossings, purple station, cyan node.</div>
        </div>

        <div className="dal-panel">
          <h3>Decision Evidence</h3>
          {decisionContext ? (
            <div className="dal-metrics">
              {Object.entries(decisionContext.evidence).map(([key, value]) => (
                <span key={key}>
                  {key.replace(/([A-Z])/g, " $1")}: {value}
                </span>
              ))}
            </div>
          ) : (
            <div className="dal-status">Select a geocoded candidate and inventory graph.</div>
          )}
        </div>
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
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Construction</h3>
          <div className="dal-metrics">
            <span>Build Feet: {fmt(Math.round(buildPath?.buildFeet ?? activeSeed?.distanceFeet ?? 0))}</span>
            <span>Build Miles: {Number(activeSeed?.buildMiles ?? buildPath?.buildMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span>Crossings: {fmt(buildPath?.estimatedCrossings)}</span>
            <span>Permits: {constructability?.permitting.authorities.join(", ") ?? "n/a"}</span>
            <span>Constructability: {fmt(Math.round(activeSeed?.constructabilityScore ?? constructability?.constructabilityScore ?? 0))}</span>
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
            <div className="dal-metrics">
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
