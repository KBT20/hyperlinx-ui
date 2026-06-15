import { createId, now } from "../api/dalClient";
import type { GraphDiffSummary } from "../graph/graphDiff";
import type { CandidateSite } from "../types/candidateSite";
import type { FieldClosure, InventoryGraph, MarketplaceQuote, OperationalEvent, PrismOpportunity, ScopeVersion, ScopeVersionCandidate } from "../types/dal";
import type { GraphExtension } from "../types/graphExtension";
import type { OpportunitySeed } from "../types/portfolio";

function event(type: string, entityId: string, entityType: string, payload: Record<string, unknown>): OperationalEvent {
  return {
    eventId: createId("event"),
    type,
    entityId,
    entityType,
    payload,
    createdAt: now(),
  };
}

function nextFormalScopeVersionId() {
  const fallback = `SV-FBL-${Math.floor(Date.now() % 1000000)
    .toString()
    .padStart(6, "0")}`;
  if (typeof localStorage === "undefined") return fallback;
  const key = "hyperlinx-dal-dev.scopeVersionSequence";
  const next = Number(localStorage.getItem(key) || "0") + 1;
  localStorage.setItem(key, String(next));
  return `SV-FBL-${next.toString().padStart(6, "0")}`;
}

export function createScopeVersionCandidateFromOpportunity(opportunity: PrismOpportunity, graph?: InventoryGraph): ScopeVersionCandidate {
  const nearestStationId = opportunity.nearestStation?.stationId;
  const nearestRouteId = opportunity.nearestStation?.routeId;
  return {
    candidateId: createId("candidate"),
    inventoryId: opportunity.inventoryId,
    graphId: opportunity.graphId,
    opportunityId: opportunity.opportunityId,
    name: `Opportunity ${opportunity.opportunityId}`,
    routeIds: nearestRouteId ? [nearestRouteId] : [],
    stationIds: nearestStationId ? [nearestStationId] : [],
    estimatedFeet: opportunity.distanceFeet,
    createdAt: now(),
  };
}

export function createScopeVersionFromInventoryGraph(graph: InventoryGraph): ScopeVersion {
  const timestamp = now();
  return {
    scopeVersionId: createId("scope"),
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    source: "InventoryGraph",
    status: "DRAFT",
    canonicalTruth: {
      inventoryId: graph.inventoryId,
      graphId: graph.graphId,
      routeCount: graph.routes.length,
      stationCount: graph.stations.length,
      edgeCount: graph.edges.length,
      nodeCount: graph.nodes.length,
      validation: graph.validation,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [event("scopeversion.created", graph.inventoryId, "InventoryGraph", { source: "InventoryGraph" })],
  };
}

export function createScopeVersionFromOpportunity(opportunity: PrismOpportunity, candidate: ScopeVersionCandidate): ScopeVersion {
  const timestamp = now();
  return {
    scopeVersionId: candidate.candidateId.replace(/^candidate-/, "scope-"),
    inventoryId: opportunity.inventoryId,
    graphId: opportunity.graphId,
    source: "PrismOpportunity",
    status: "CANDIDATE",
    canonicalTruth: {
      opportunity,
      candidate,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [event("scopeversion.candidate.created", opportunity.opportunityId, "PrismOpportunity", { candidate })],
  };
}

export function createScopeVersionFromGraphExtensions(graph: InventoryGraph, extensions: GraphExtension[], diff: GraphDiffSummary): ScopeVersion {
  const timestamp = now();
  return {
    scopeVersionId: createId("scope"),
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    source: "GraphExtension",
    status: "CANDIDATE",
    canonicalTruth: {
      inventoryGraphReference: {
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        name: graph.metadata.name,
      },
      extensionIds: extensions.map((extension) => extension.extensionId),
      extensions,
      extensionSummary: diff,
      proposedState: {
        nodeCount: graph.nodes.length + diff.addedNodeCount,
        edgeCount: graph.edges.length + diff.addedEdgeCount,
        routeCount: graph.routes.length + diff.addedRouteCount,
        stationCount: graph.stations.length + diff.addedStationCount,
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [
      event("scopeversion.graph_extension.created", graph.inventoryId, "InventoryGraph", {
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        extensionIds: extensions.map((extension) => extension.extensionId),
        extensionSummary: diff,
      }),
    ],
  };
}

export function createScopeVersionFromOpportunitySeed(seed: OpportunitySeed): ScopeVersion {
  const timestamp = now();
  return {
    scopeVersionId: createId("scope"),
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
    source: "OpportunitySeed",
    status: "CANDIDATE",
    canonicalTruth: {
      inventoryGraphReference: {
        inventoryId: seed.inventoryId,
        graphId: seed.graphId,
      },
      opportunitySeedId: seed.id,
      opportunitySeed: seed,
      proposedState: {
        candidateType: seed.candidateType,
        latitude: seed.latitude,
        longitude: seed.longitude,
        nearestRouteId: seed.nearestRouteId,
        nearestNodeId: seed.nearestNodeId,
        nearestStationId: seed.nearestStationId,
        buildLengthFeet: seed.distanceFeet,
        buildCost: seed.buildCost,
      },
      constructabilityAssessment: seed.constructabilityAssessment,
      permitRequirements: seed.constructabilityAssessment?.permitting,
      crossingInventory: {
        rail: seed.constructabilityAssessment?.rail,
        water: seed.constructabilityAssessment?.water,
        estimatedCrossings: seed.buildPath?.estimatedCrossings,
      },
      portfolioMetrics: {
        estimatedNRC: seed.estimatedNRC,
        estimatedMRC: seed.estimatedMRC,
        estimatedTCV: seed.estimatedTCV,
        paybackMonths: seed.paybackMonths,
        overallScore: seed.overallScore,
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [
      event("scopeversion.opportunity_seed.created", seed.id, "OpportunitySeed", {
        opportunitySeedId: seed.id,
        inventoryId: seed.inventoryId,
        graphId: seed.graphId,
        overallScore: seed.overallScore,
      }),
    ],
  };
}

export function createScopeVersionFromSiteDecision(args: {
  site?: CandidateSite;
  seed: OpportunitySeed;
  quoteBasis?: MarketplaceQuote | null;
  user?: string;
}): ScopeVersion {
  const timestamp = now();
  const { site, seed, quoteBasis, user = "DAL Operator" } = args;
  const affinity = seed.networkAffinity;
  const buildPath = seed.buildPath ?? affinity?.buildPath;
  const constructability = seed.constructabilityAssessment ?? affinity?.constructabilityAssessment ?? buildPath?.constructabilityAssessment;
  const attachmentPoint = affinity?.preferredAttachmentPoint ?? (buildPath?.geometry?.length ? buildPath.geometry[buildPath.geometry.length - 1] : undefined);
  const routeSnapshot = { routeId: buildPath?.routeId ?? seed.nearestRouteId, nearestRoute: affinity?.nearestRoute };
  const nodeSnapshot = { nodeId: buildPath?.nodeId ?? seed.nearestNodeId, nearestNode: affinity?.nearestNode };
  const stationSnapshot = { stationId: buildPath?.stationId ?? seed.nearestStationId, nearestStation: affinity?.nearestStation };
  const crossingInventory = {
    rail: constructability?.rail,
    water: constructability?.water,
    estimatedCrossings: buildPath?.estimatedCrossings,
    roadCrossings: buildPath?.highwayCrossingCount,
    railCrossings: buildPath?.railCrossingCount ?? constructability?.rail.railCrossingCount,
    waterCrossings: buildPath?.waterCrossingCount ?? constructability?.water.waterCrossingCount,
  };
  const financialInputs = {
    estimatedNRC: seed.estimatedNRC,
    estimatedMRC: seed.estimatedMRC,
    estimatedRevenueMonthly: seed.estimatedRevenueMonthly,
    estimatedRevenueAnnual: seed.estimatedRevenueAnnual,
    estimatedTCV: seed.estimatedTCV,
    paybackMonths: seed.paybackMonths,
    roi: seed.roi,
    margin: seed.margin,
    buildCost: seed.buildCost,
    estimatedPermitCost: seed.estimatedPermitCost ?? constructability?.estimatedPermitCost,
    estimatedCrossingCost: seed.estimatedCrossingCost ?? constructability?.estimatedCrossingCost,
    estimatedEnvironmentalCost: seed.estimatedEnvironmentalCost ?? constructability?.estimatedEnvironmentalCost,
    estimatedEngineeringCost: seed.estimatedEngineeringCost ?? constructability?.estimatedEngineeringCost,
  };
  const recommendation = {
    phase: seed.rank && seed.rank <= 10 ? "Phase 1" : seed.rank && seed.rank <= 25 ? "Phase 2" : "Phase 3",
    priority: seed.overallScore >= 75 ? "HIGH" : seed.overallScore >= 55 ? "MEDIUM" : "LOW",
    strategicScore: seed.strategicScore,
    engineeringScore: seed.engineeringScore,
    financialScore: seed.financialScore,
    compositeScore: seed.overallScore,
  };
  const graphReference = {
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
  };
  return {
    scopeVersionId: nextFormalScopeVersionId(),
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
    source: "OpportunitySeed",
    status: "ANALYZED",
    candidateSite: site,
    latitude: site?.latitude ?? seed.latitude,
    longitude: site?.longitude ?? seed.longitude,
    geometry: buildPath?.geometry,
    attachmentPoint,
    attachmentCoordinates: attachmentPoint,
    nearestRoute: routeSnapshot,
    nearestNode: nodeSnapshot,
    nearestStation: stationSnapshot,
    buildPath,
    buildFeet: buildPath?.buildFeet ?? seed.distanceFeet,
    buildMiles: buildPath?.buildMiles ?? seed.buildMiles,
    crossings: crossingInventory,
    permits: constructability?.permitting,
    constructability,
    financialInputs,
    decisionRecommendation: recommendation,
    graphReference,
    graphVersion: seed.graphId,
    decisionTimestamp: timestamp,
    user,
    station: stationSnapshot,
    route: routeSnapshot,
    canonicalTruth: {
      decisionType: "PrismSiteDecision",
      graphReference,
      graphVersion: seed.graphId,
      decisionTimestamp: timestamp,
      user,
      inventoryGraphReference: graphReference,
      site,
      candidateSite: site,
      latitude: site?.latitude ?? seed.latitude,
      longitude: site?.longitude ?? seed.longitude,
      opportunitySeedId: seed.id,
      opportunitySeed: seed,
      route: routeSnapshot,
      node: nodeSnapshot,
      station: stationSnapshot,
      buildPath,
      buildFeet: buildPath?.buildFeet ?? seed.distanceFeet,
      buildMiles: buildPath?.buildMiles ?? seed.buildMiles,
      geometry: buildPath?.geometry,
      attachmentPoint,
      attachmentCoordinates: attachmentPoint,
      constructabilityAssessment: constructability,
      permitRequirements: constructability?.permitting,
      crossings: crossingInventory,
      crossingInventory,
      riskBasis: {
        permitRisk: constructability ? 100 - constructability.permitScore : undefined,
        crossingRisk: constructability ? 100 - constructability.crossingScore : undefined,
        constructionRisk: constructability?.constructionDifficulty,
        environmentalRisk: constructability?.environmentalRisk,
        compositeRisk: seed.riskScore ?? affinity?.riskScore ?? buildPath?.riskScore,
      },
      costBasis: {
        buildCost: seed.buildCost,
        estimatedPermitCost: seed.estimatedPermitCost ?? constructability?.estimatedPermitCost,
        estimatedCrossingCost: seed.estimatedCrossingCost ?? constructability?.estimatedCrossingCost,
        estimatedEnvironmentalCost: seed.estimatedEnvironmentalCost ?? constructability?.estimatedEnvironmentalCost,
        estimatedEngineeringCost: seed.estimatedEngineeringCost ?? constructability?.estimatedEngineeringCost,
      },
      financialInputs,
      revenueBasis: {
        estimatedNRC: seed.estimatedNRC,
        estimatedMRC: seed.estimatedMRC,
        estimatedRevenueMonthly: seed.estimatedRevenueMonthly,
        estimatedRevenueAnnual: seed.estimatedRevenueAnnual,
        estimatedTCV: seed.estimatedTCV,
        paybackMonths: seed.paybackMonths,
        roi: seed.roi,
        margin: seed.margin,
      },
      quoteBasis,
      recommendation,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [
      event("scopeversion.site_decision.created", seed.id, "OpportunitySeed", {
        siteId: site?.candidateId ?? seed.candidateSiteId,
        opportunitySeedId: seed.id,
        inventoryId: seed.inventoryId,
        graphId: seed.graphId,
        routeId: buildPath?.routeId ?? seed.nearestRouteId,
        nodeId: buildPath?.nodeId ?? seed.nearestNodeId,
        stationId: buildPath?.stationId ?? seed.nearestStationId,
        constructabilityScore: seed.constructabilityScore,
        overallScore: seed.overallScore,
      }),
    ],
  };
}

export function createScopeVersionFromFieldClosure(closure: FieldClosure, prior?: ScopeVersion): ScopeVersion {
  const timestamp = now();
  return {
    scopeVersionId: prior?.scopeVersionId ?? createId("scope"),
    inventoryId: closure.inventoryId ?? prior?.inventoryId,
    graphId: closure.graphId ?? prior?.graphId,
    source: "FieldClosure",
    status: "FIELD_CLOSED",
    canonicalTruth: {
      ...(prior?.canonicalTruth ?? {}),
      latestClosure: closure,
    },
    createdAt: prior?.createdAt ?? timestamp,
    updatedAt: timestamp,
    events: [...(prior?.events ?? []), event("field.closure.applied", closure.closureId, "FieldClosure", { closure })],
  };
}
