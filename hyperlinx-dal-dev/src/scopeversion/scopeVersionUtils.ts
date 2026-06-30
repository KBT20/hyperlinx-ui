import { createId, now } from "../api/dalClient";
import type { GraphDiffSummary } from "../graph/graphDiff";
import type { CandidateSite } from "../types/candidateSite";
import type { CustomerDesignImport } from "../translate/CustomerDesignImport";
import type {
  CertificationSnapshot,
  FieldClosure,
  InventoryGraph,
  InventoryNode,
  InventoryRoute,
  InventoryStation,
  MarketplaceQuote,
  OperationalEvent,
  PrismOpportunity,
  ScopeVersion,
  ScopeVersionCandidate,
  ScopeVersionDecisionRecommendation,
} from "../types/dal";
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

let runtimeScopeVersionSequence = Math.floor(Date.now() % 1000000);

function nextFormalScopeVersionId() {
  runtimeScopeVersionSequence = (runtimeScopeVersionSequence + 1) % 1000000;
  return `SV-FBL-${runtimeScopeVersionSequence.toString().padStart(6, "0")}`;
}

function asNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function recommendationFor(score: number): ScopeVersionDecisionRecommendation {
  if (score >= 70) return "GO";
  if (score >= 50) return "REVIEW";
  return "NO_GO";
}

function permitAuthoritiesFor(permits: any): string[] {
  return Array.isArray(permits?.authorities) ? permits.authorities.map((authority: unknown) => String(authority)) : [];
}

function assertCertificationAllowsScopeVersion(seed: OpportunitySeed) {
  const snapshot = seed.certificationSnapshot ?? seed.networkAffinity?.certificationSnapshot;
  const serviceability = seed.serviceabilityAssessment ?? seed.networkAffinity?.serviceabilityAssessment ?? snapshot?.serviceabilityAssessment;
  const attachment = seed.attachmentCertification ?? seed.networkAffinity?.attachmentCertification ?? snapshot?.attachmentPoint;
  const lateral = seed.lateralCertification ?? seed.networkAffinity?.lateralCertification ?? snapshot?.lateralPath;

  if (!snapshot || !serviceability || !attachment || !lateral) {
    throw new Error("ScopeVersion creation requires certified attachment, lateral, and serviceability truth.");
  }
  if (serviceability.status === "NOT_SERVICEABLE" || !serviceability.serviceable) {
    throw new Error("ScopeVersion creation blocked: site is NOT_SERVICEABLE.");
  }
  if (attachment.certificationStatus === "FAILED" || lateral.certificationStatus === "FAILED") {
    throw new Error("ScopeVersion creation blocked: attachment or lateral certification failed.");
  }
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
  const scopeVersionId = graph.scopeVersionId ?? graph.metadata.scopeVersionId ?? `SV-INV-${graph.inventoryId}`;
  return {
    scopeVersionId,
    type: "INVENTORY",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    sourceInventoryId: graph.inventoryId,
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    graphVersion: graph.graphId,
    source: "InventoryGraph",
    status: "DRAFT",
    certificationState: "DRAFT",
    isImmutable: false,
    graphSummary: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      stationCount: graph.stations.length,
      routeCount: graph.routes.length,
    },
    iofPackageIds: [],
    createdBy: "DAL Inventory Import",
    decisionTimestamp: timestamp,
    canonicalTruth: {
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
      inventoryId: graph.inventoryId,
      graphId: graph.graphId,
      routeCount: graph.routes.length,
      stationCount: graph.stations.length,
      edgeCount: graph.edges.length,
      nodeCount: graph.nodes.length,
      graphSummary: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        stationCount: graph.stations.length,
        routeCount: graph.routes.length,
      },
      validation: graph.validation,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [event("scopeversion.created", graph.inventoryId, "InventoryGraph", { source: "InventoryGraph" })],
  };
}

export function createScopeVersionFromCustomerDesignImport(record: CustomerDesignImport): ScopeVersion {
  const timestamp = now();
  const activeRouteId = record.activeRouteId ?? record.routes[0]?.routeId ?? "";
  const activeRoute = record.routes.find((route) => route.routeId === activeRouteId) ?? record.routes[0];
  const proposedGeometry = record.proposedGeometry?.length
    ? record.proposedGeometry
    : activeRoute?.dalGeometry?.length
      ? activeRoute.dalGeometry
      : record.previewGeometry ?? [];
  const anchorCoordinate = proposedGeometry[0] ?? [0, 0];
  const scopeVersionId = record.scopeVersionId ?? `SV-CDR-${record.designId}`;
  const designIntent = record.designIntent ?? "CUSTOMER_DESIGN_REQUEST";
  return {
    scopeVersionId,
    type: "CANDIDATE",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    graphId: record.graphId,
    graphVersion: record.graphId,
    source: "CustomerDesignRequest",
    status: "DRAFT",
    certificationState: "DRAFT",
    isImmutable: false,
    createdBy: record.uploadedBy,
    geometry: proposedGeometry,
    buildFeet: activeRoute?.routeFeet,
    buildMiles: activeRoute?.routeMiles,
    decisionTimestamp: timestamp,
    canonicalTruth: {
      designImportId: record.importId,
      customerId: record.accountId,
      customerName: record.customerName,
      sourceType: record.sourceType,
      sourceFilename: record.sourceFileName,
      requestedBy: record.uploadedBy,
      designIntent,
      scopeVersionId,
      proposedGeometry,
      routeCount: record.routes.length,
      objectCount: record.objects.length,
      polygonCount: record.polygons.length,
      activeRouteId,
      networkBasis: {
        routeId: activeRoute?.routeId ?? "",
        routeName: activeRoute?.name,
        nodeId: "",
        stationId: "",
        attachmentPoint: anchorCoordinate,
        attachmentCoordinates: anchorCoordinate,
        attachmentMethod: "CUSTOMER_DESIGN_REQUEST",
        attachmentConfidence: activeRoute?.confidence,
      },
      geographicBasis: {
        candidateLatitude: Number(anchorCoordinate[1] ?? 0),
        candidateLongitude: Number(anchorCoordinate[0] ?? 0),
        geometry: proposedGeometry,
        buildPath: { source: "CustomerDesignRequest", routeId: activeRoute?.routeId ?? "" },
        routeGeometry: proposedGeometry,
      },
      lifecycleState: "DRAFT",
      lifecycleTimestamp: timestamp,
      constitutionalAuthority: "NON_AUTHORITATIVE",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [
      event("scopeversion.customer_design_request.created", record.importId, "CustomerDesignImport", {
        designImportId: record.importId,
        designId: record.designId,
        customerId: record.accountId,
        sourceFilename: record.sourceFileName,
        designIntent,
      }),
    ],
  };
}

export function createScopeVersionFromOpportunity(opportunity: PrismOpportunity, candidate: ScopeVersionCandidate): ScopeVersion {
  const timestamp = now();
  const scopeVersionId = candidate.candidateId.replace(/^candidate-/, "scope-");
  return {
    scopeVersionId,
    type: "CANDIDATE",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    inventoryId: opportunity.inventoryId,
    graphId: opportunity.graphId,
    source: "PrismOpportunity",
    status: "DRAFT",
    certificationState: "DRAFT",
    isImmutable: false,
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
  const scopeVersionId = createId("scope");
  const parentScopeVersionId = graph.scopeVersionId ?? graph.metadata.scopeVersionId ?? `SV-INV-${graph.inventoryId}`;
  const failedExtensions = extensions.filter((extension) => extension.extensionCertificationStatus === "FAILED");
  if (failedExtensions.length) {
    throw new Error(`ScopeVersion creation blocked: ${failedExtensions.length} graph extension certification failed.`);
  }
  return {
    scopeVersionId,
    type: "CANDIDATE",
    parentScopeVersionId,
    rootScopeVersionId: parentScopeVersionId,
    relationshipType: "GRAPH_EXTENSION",
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    source: "GraphExtension",
    status: "DRAFT",
    certificationState: "DRAFT",
    isImmutable: false,
    canonicalTruth: {
      inventoryGraphReference: {
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        name: graph.metadata.name,
      },
      extensionIds: extensions.map((extension) => extension.extensionId),
      extensions,
      extensionCertifications: extensions.map((extension) => ({
        extensionId: extension.extensionId,
        status: extension.extensionCertificationStatus ?? extension.metadata.extensionCertificationStatus ?? "WARNING",
        certifiedAttachmentPoint: extension.metadata.certifiedAttachmentPoint,
        routeContinuityValidated: extension.metadata.routeContinuityValidated,
        graphConnectivityValidated: extension.metadata.graphConnectivityValidated,
      })),
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
  const scopeVersionId = createId("scope");
  return {
    scopeVersionId,
    type: "CANDIDATE",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
    source: "OpportunitySeed",
    status: "DRAFT",
    certificationState: "DRAFT",
    isImmutable: false,
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
  route?: InventoryRoute;
  node?: InventoryNode;
  station?: InventoryStation;
  quoteBasis?: MarketplaceQuote | null;
  user?: string;
}): ScopeVersion {
  const timestamp = now();
  const { site, seed, route, node, station, quoteBasis, user = "DAL Operator" } = args;
  const scopeVersionId = nextFormalScopeVersionId();
  assertCertificationAllowsScopeVersion(seed);
  const affinity = seed.networkAffinity;
  const buildPath = seed.buildPath ?? affinity?.buildPath;
  const constructability = seed.constructabilityAssessment ?? affinity?.constructabilityAssessment ?? buildPath?.constructabilityAssessment;
  const certificationSnapshot = (seed.certificationSnapshot ?? affinity?.certificationSnapshot) as CertificationSnapshot;
  const attachmentCertification = seed.attachmentCertification ?? affinity?.attachmentCertification ?? certificationSnapshot.attachmentPoint;
  const lateralCertification = seed.lateralCertification ?? affinity?.lateralCertification ?? certificationSnapshot.lateralPath;
  const serviceabilityAssessment = seed.serviceabilityAssessment ?? affinity?.serviceabilityAssessment ?? certificationSnapshot.serviceabilityAssessment;
  const constructionAssumptions = seed.constructionAssumptions ?? affinity?.constructionAssumptions ?? certificationSnapshot.constructionAssumptions;
  const attachmentPoint = [attachmentCertification.longitude, attachmentCertification.latitude] as [number, number];
  const routeId = attachmentCertification.routeId || buildPath?.routeId || seed.nearestRouteId || affinity?.nearestRoute.routeId || "";
  const nodeId = attachmentCertification.nodeId || buildPath?.nodeId || seed.nearestNodeId || affinity?.nearestNode.nodeId || "";
  const stationId = attachmentCertification.stationId || buildPath?.stationId || seed.nearestStationId || affinity?.nearestStation.stationId || "";
  const routeSnapshot = { routeId, routeName: route?.name ?? affinity?.nearestRoute.routeName ?? routeId, nearestRoute: affinity?.nearestRoute };
  const nodeSnapshot = { nodeId, nodeName: nodeId, nearestNode: affinity?.nearestNode };
  const stationSnapshot = { stationId, stationName: station?.label ?? stationId, nearestStation: affinity?.nearestStation };
  const buildFeet = asNumber(lateralCertification.buildFeet ?? buildPath?.buildFeet ?? seed.distanceFeet);
  const buildMiles = asNumber(lateralCertification.buildMiles ?? buildPath?.buildMiles ?? seed.buildMiles ?? buildFeet / 5280);
  const roadCrossings = asNumber(buildPath?.highwayCrossingCount ?? lateralCertification.crossings ?? buildPath?.estimatedCrossings);
  const railCrossings = asNumber(buildPath?.railCrossingCount ?? constructability?.rail.railCrossingCount);
  const waterCrossings = asNumber(buildPath?.waterCrossingCount ?? constructability?.water.waterCrossingCount);
  const permits = constructability?.permitting;
  const permitAuthorities = permitAuthoritiesFor(permits);
  const estimatedConstructionCost = asNumber(seed.buildCost ?? buildPath?.estimatedCost);
  const estimatedEngineeringCost = asNumber(seed.estimatedEngineeringCost ?? constructability?.estimatedEngineeringCost ?? buildPath?.estimatedEngineeringCost, Math.round(estimatedConstructionCost * 0.12));
  const estimatedPermitCost = asNumber(seed.estimatedPermitCost ?? constructability?.estimatedPermitCost ?? buildPath?.estimatedPermitCost, Math.max(1, permitAuthorities.length) * 3500);
  const estimatedCrossingCost = asNumber(seed.estimatedCrossingCost ?? constructability?.estimatedCrossingCost ?? buildPath?.estimatedCrossingCost, (railCrossings + waterCrossings) * 25000);
  const estimatedEnvironmentalCost = asNumber(seed.estimatedEnvironmentalCost ?? constructability?.estimatedEnvironmentalCost);
  const NRC = asNumber(quoteBasis?.nrc ?? seed.estimatedNRC, estimatedConstructionCost + estimatedEngineeringCost + estimatedPermitCost + estimatedCrossingCost + estimatedEnvironmentalCost);
  const MRC = asNumber(quoteBasis?.mrc ?? seed.estimatedMRC);
  const TCV = asNumber(quoteBasis?.totalContractValue ?? seed.estimatedTCV, NRC + MRC * 36);
  const recommendationValue = recommendationFor(asNumber(seed.overallScore));
  const crossingInventory = {
    rail: constructability?.rail,
    water: constructability?.water,
    estimatedCrossings: buildPath?.estimatedCrossings,
    roadCrossings,
    railCrossings,
    waterCrossings,
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
    buildCost: estimatedConstructionCost,
    estimatedPermitCost,
    estimatedCrossingCost,
    estimatedEnvironmentalCost,
    estimatedEngineeringCost,
  };
  const recommendation = {
    recommendation: recommendationValue,
    phase: seed.rank && seed.rank <= 10 ? "Phase 1" : seed.rank && seed.rank <= 25 ? "Phase 2" : "Phase 3",
    priority: seed.overallScore >= 75 ? "HIGH" : seed.overallScore >= 55 ? "MEDIUM" : "LOW",
    strategicScore: seed.strategicScore,
    engineeringScore: seed.engineeringScore,
    financialScore: seed.financialScore,
    compositeScore: seed.overallScore,
    riskScore: seed.riskScore ?? buildPath?.riskScore,
  };
  const graphReference = {
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
    graphVersion: seed.graphId,
  };
  const networkBasis = {
    routeId,
    routeName: routeSnapshot.routeName,
    nodeId,
    nodeName: nodeSnapshot.nodeName,
    stationId,
    stationName: stationSnapshot.stationName,
    attachmentPoint: attachmentPoint ?? ([Number.NaN, Number.NaN] as [number, number]),
    attachmentCoordinates: attachmentPoint ?? ([Number.NaN, Number.NaN] as [number, number]),
    capacityStatus: seed.capacityStatus ?? affinity?.capacity.projectedUtilization,
    attachmentStrategy: seed.attachmentStrategy?.attachmentType ?? affinity?.preferredStrategy.attachmentType,
    networkAffinityScore: seed.networkAffinityScore ?? affinity?.affinityScore,
    certificationStatus: attachmentCertification.certificationStatus,
  };
  const geographicBasis = {
    candidateLatitude: asNumber(site?.latitude ?? seed.latitude),
    candidateLongitude: asNumber(site?.longitude ?? seed.longitude),
    geocodeProvider: site?.geocodeProvider,
    geocodeConfidence: site?.geocodeConfidence,
    geometry: lateralCertification.geometry ?? buildPath?.geometry ?? [],
    buildPath,
    routeGeometry: route?.coordinates ?? [],
    stationGeometry: station ? ([station.lon, station.lat] as [number, number]) : affinity?.nearestStation.coordinate,
    nodeGeometry: node ? ([node.lon, node.lat] as [number, number]) : affinity?.nearestNode.coordinate,
    attachmentGeometry: attachmentPoint,
    lateralGeometry: lateralCertification.geometry,
  };
  const engineeringBasis = {
    buildFeet,
    buildMiles,
    constructionType: constructionAssumptions.constructionType ?? seed.constructionType ?? buildPath?.constructionType,
    crossings: crossingInventory,
    roadCrossings,
    railCrossings,
    waterCrossings,
    permits,
    permitAuthorities,
    constructabilityScore: seed.constructabilityScore ?? constructability?.constructabilityScore,
    engineeringScore: seed.engineeringScore,
    constructionAssumptions,
    attachmentCertification,
    lateralCertification,
    serviceabilityAssessment,
  };
  const financialBasis = {
    estimatedConstructionCost,
    estimatedEngineeringCost,
    estimatedPermitCost,
    estimatedCrossingCost,
    estimatedEnvironmentalCost,
    NRC,
    MRC,
    TCV,
    payback: quoteBasis?.paybackMonths ?? seed.paybackMonths,
    ROI: quoteBasis?.roi ?? seed.roi,
    margin: quoteBasis?.margin ?? seed.margin,
    financialScore: seed.financialScore,
  };
  const riskBasis = {
    permitRisk: constructability ? 100 - constructability.permitScore : undefined,
    crossingRisk: constructability ? 100 - constructability.crossingScore : undefined,
    constructionRisk: constructability?.constructionDifficulty,
    environmentalRisk: constructability?.environmentalRisk,
    compositeRisk: seed.riskScore ?? affinity?.riskScore ?? buildPath?.riskScore,
  };
  const decisionBasis = {
    ...recommendation,
    recommendation: recommendationValue,
  };
  return {
    scopeVersionId,
    type: "CANDIDATE",
    rootScopeVersionId: scopeVersionId,
    relationshipType: "ROOT",
    inventoryId: seed.inventoryId,
    graphId: seed.graphId,
    graphVersion: seed.graphId,
    candidateSiteId: site?.candidateId ?? seed.candidateSiteId,
    sourceOpportunityId: seed.id,
    createdBy: user,
    source: "OpportunitySeed",
    status: "ANALYZED",
    certificationState: "DRAFT",
    isImmutable: false,
    candidateSite: site,
    latitude: site?.latitude ?? seed.latitude,
    longitude: site?.longitude ?? seed.longitude,
    geometry: lateralCertification.geometry ?? buildPath?.geometry,
    attachmentPoint,
    attachmentCoordinates: attachmentPoint,
    nearestRoute: routeSnapshot,
    nearestNode: nodeSnapshot,
    nearestStation: stationSnapshot,
    buildPath,
    buildFeet,
    buildMiles,
    crossings: crossingInventory,
    permits: constructability?.permitting,
    constructability,
    financialInputs,
    decisionRecommendation: recommendation,
    certificationSnapshot,
    serviceabilityAssessment,
    graphReference,
    decisionTimestamp: timestamp,
    user,
    station: stationSnapshot,
    route: routeSnapshot,
    canonicalTruth: {
      decisionType: "PrismSiteDecision",
      graphReference,
      networkBasis,
      geographicBasis,
      engineeringBasis,
      financialBasis,
      riskBasis,
      decisionBasis,
      certificationSnapshot,
      serviceabilityAssessment,
      constructionAssumptions,
      sourceCandidate: {
        candidateSiteId: site?.candidateId ?? seed.candidateSiteId ?? "",
        name: site?.companyName ?? seed.siteName,
        address: [site?.address, site?.city, site?.state, site?.zipCode].filter(Boolean).join(", "),
      },
      sourceOpportunity: {
        opportunitySeedId: seed.id,
      },
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
      buildFeet,
      buildMiles,
      geometry: lateralCertification.geometry ?? buildPath?.geometry,
      attachmentPoint,
      attachmentCoordinates: attachmentPoint,
      attachmentCertification,
      lateralCertification,
      constructabilityAssessment: constructability,
      permitRequirements: constructability?.permitting,
      crossings: crossingInventory,
      crossingInventory,
      costBasis: {
        buildCost: estimatedConstructionCost,
        estimatedPermitCost,
        estimatedCrossingCost,
        estimatedEnvironmentalCost,
        estimatedEngineeringCost,
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
        routeId,
        nodeId,
        stationId,
        certificationStatus: serviceabilityAssessment.status,
        constructabilityScore: seed.constructabilityScore,
        overallScore: seed.overallScore,
      }),
    ],
  };
}

export function createScopeVersionFromFieldClosure(closure: FieldClosure, prior?: ScopeVersion): ScopeVersion {
  const timestamp = now();
  const scopeVersionId = createId("scope");
  return {
    scopeVersionId,
    type: "FIELD_CLOSED",
    parentScopeVersionId: prior?.scopeVersionId,
    rootScopeVersionId: prior?.rootScopeVersionId ?? prior?.scopeVersionId ?? scopeVersionId,
    relationshipType: prior ? "FIELD_CLOSURE" : "ROOT",
    inventoryId: closure.inventoryId ?? prior?.inventoryId,
    graphId: closure.graphId ?? prior?.graphId,
    source: "FieldClosure",
    status: "COMPLETE",
    certificationState: "DRAFT",
    isImmutable: false,
    closureEventId: closure.closureId,
    canonicalTruth: {
      ...(prior?.canonicalTruth ?? {}),
      latestClosure: closure,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [...(prior?.events ?? []), event("field.closure.applied", closure.closureId, "FieldClosure", { closure })],
  };
}
