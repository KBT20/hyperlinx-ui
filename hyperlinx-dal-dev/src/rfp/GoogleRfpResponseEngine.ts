import { estimateCivilMixFromCorridor } from "../construction/CivilMixEngine";
import { googleHeliumBudgetaryCostProfileV1 } from "../construction/fixtures/civilMixFixtures";
import { buildDesignLaunchRequestFromRouteRequest, createDesignLaunchSession } from "../design/DesignLaunchEngine";
import { generateStationedCorridor } from "../corridor/CorridorGenerationEngine";
import { createPreliminaryQuotePackageFromGraph } from "../proposal/ProposalGenerationEngine";
import { createProposedGraphFromStationedCorridor } from "../proposedGraph/ProposedGraphEngine";
import { createOsrmRouteRevision, type RouteRevisionBuildResult } from "../redline/RouteRedlineEngine";
import type { RouteAvoidanceArea } from "../redline/RouteRedlineAction";
import { OSRM_PUBLIC_ENDPOINT } from "../routeGeneration/OsrmConnectivityCheck";
import { coordinatesAreVerified, routeVerificationIsQuoteReady, type OsrmRouteVerification } from "../routeGeneration/OsrmRouteVerification";
import type { GoogleRfpBidPlan, GoogleRfpChecklistItem, GoogleRfpRouteBidPlan, GoogleRfpRouteDiversityAssessment } from "./GoogleRfpBidPlan";
import type { GoogleRfpOpportunity } from "./GoogleRfpOpportunity";
import type { GoogleRfpRouteRequirement } from "./GoogleRfpRouteRequirement";
import type { GoogleRfpVendorResponseField, GoogleRfpVendorResponsePreview } from "./GoogleRfpVendorResponse";

function routeRequestFromRequirement(opportunity: GoogleRfpOpportunity, requirement: GoogleRfpRouteRequirement) {
  return {
    routeRequestId: requirement.routeRequirementId,
    customer: {
      customerMode: "EXISTING_CUSTOMER" as const,
      existingCustomerId: opportunity.customerId,
      company: opportunity.customerName,
      primaryContact: opportunity.responseContacts[0]?.name ?? "Google RFP Contact",
      market: "Kansas / Oklahoma",
      notes: "Created from hyperscaler RFP route requirement fixture.",
    },
    opportunity: {
      opportunityName: `${opportunity.opportunityName} - ${requirement.bidSegmentName}`,
      customer: opportunity.customerName,
      market: "Kansas / Oklahoma",
      targetCompletion: opportunity.budgetaryDeadline,
      internalOwner: "Teralinx",
      salesOwner: "Ryan",
    },
    siteList: [requirement.aSite, requirement.zSite],
    intent: {
      networkType: "LONG_HAUL" as const,
      protection: requirement.protectionRequirement,
      primaryProduct: requirement.requiredProduct,
    },
    protection: requirement.protectionRequirement,
    product: requirement.requiredProduct,
  };
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function now() {
  return new Date().toISOString();
}

function routeRequestUrl(requirement: GoogleRfpRouteRequirement) {
  const a = requirement.aSite;
  const z = requirement.zSite;
  return `${OSRM_PUBLIC_ENDPOINT}/route/v1/driving/${a.longitude},${a.latitude};${z.longitude},${z.latitude}?overview=full&geometries=geojson&steps=false`;
}

function routeCoordinateBlockers(requirement: GoogleRfpRouteRequirement) {
  const blockers: string[] = [];
  if (!coordinatesAreVerified(requirement.aSite.coordinateStatus)) blockers.push(`A site coordinate is ${requirement.aSite.coordinateStatus}.`);
  if (!coordinatesAreVerified(requirement.zSite.coordinateStatus)) blockers.push(`Z site coordinate is ${requirement.zSite.coordinateStatus}.`);
  return blockers;
}

function verificationFromRevisedRoute(args: {
  requirement: GoogleRfpRouteRequirement;
  centerlineRouteId: string;
  totalFeet: number;
  totalMiles: number;
  geometryCoordinateCount: number;
  stationedCorridorId: string;
  takeoffId: string;
  civilMixEstimateId: string;
  quotePreviewId: string;
  verificationSuffix?: string;
}): OsrmRouteVerification {
  return {
    verificationId: `OSRM-VERIFY-${args.requirement.routeRequirementId}${args.verificationSuffix ? `-${args.verificationSuffix}` : ""}`,
    routeRequirementId: args.requirement.routeRequirementId,
    osrmStatus: "OSRM_READY",
    osrmEndpoint: OSRM_PUBLIC_ENDPOINT,
    lastRouteRequest: routeRequestUrl(args.requirement),
    routeSnapStatus: "ROUTE_SNAPPED",
    mileageSource: "OSRM_SNAPPED_CENTERLINE",
    source: "OSRM_EXISTING_DAL",
    aSiteCoordinateStatus: args.requirement.aSite.coordinateStatus,
    zSiteCoordinateStatus: args.requirement.zSite.coordinateStatus,
    coordinateSource: `${args.requirement.aSite.sourceArtifact}; ${args.requirement.zSite.sourceArtifact}`,
    centerlineRouteId: args.centerlineRouteId,
    totalFeet: args.totalFeet,
    totalMiles: args.totalMiles,
    geometryCoordinateCount: args.geometryCoordinateCount,
    stationedCorridorId: args.stationedCorridorId,
    takeoffId: args.takeoffId,
    civilMixEstimateId: args.civilMixEstimateId,
    quotePreviewId: args.quotePreviewId,
    takeoffSource: "STATIONED_CORRIDOR_TAKEOFF",
    quoteSource: "CORRIDOR_TAKEOFF",
    blockers: [],
    generatedAt: now(),
    salesEstimateOnly: true,
    engineeringCertified: false,
  };
}

function blockedVerification(requirement: GoogleRfpRouteRequirement, blockers: string[], osrmUnavailable = true): OsrmRouteVerification {
  const coordinateBlockers = routeCoordinateBlockers(requirement);
  const allBlockers = [...coordinateBlockers, ...blockers];
  return {
    verificationId: `OSRM-VERIFY-${requirement.routeRequirementId}`,
    routeRequirementId: requirement.routeRequirementId,
    osrmStatus: osrmUnavailable ? "OSRM_UNAVAILABLE" : "OSRM_READY",
    osrmEndpoint: OSRM_PUBLIC_ENDPOINT,
    lastRouteRequest: coordinateBlockers.length ? "COORDINATES_UNVERIFIED" : routeRequestUrl(requirement),
    routeSnapStatus: coordinateBlockers.length ? "COORDINATES_UNVERIFIED" : "ROUTE_BLOCKED",
    mileageSource: "UNAVAILABLE",
    source: "NON_OSRM_BLOCKED",
    aSiteCoordinateStatus: requirement.aSite.coordinateStatus,
    zSiteCoordinateStatus: requirement.zSite.coordinateStatus,
    coordinateSource: `${requirement.aSite.sourceArtifact}; ${requirement.zSite.sourceArtifact}`,
    totalFeet: 0,
    totalMiles: 0,
    geometryCoordinateCount: 0,
    takeoffSource: "BLOCKED",
    quoteSource: "BLOCKED",
    blockers: allBlockers.length ? allBlockers : ["OSRM route verification has not completed."],
    generatedAt: now(),
    salesEstimateOnly: true,
    engineeringCertified: false,
  };
}

function verifiedRouteBlockers(routePlan: Omit<GoogleRfpRouteBidPlan, "diversityAssessment" | "vendorResponsePreview">) {
  const blockers = [...routePlan.routeVerification.blockers];
  const verification = routePlan.routeVerification;
  if (!coordinatesAreVerified(verification.aSiteCoordinateStatus)) blockers.push("A site coordinate must be verified.");
  if (!coordinatesAreVerified(verification.zSiteCoordinateStatus)) blockers.push("Z site coordinate must be verified.");
  if (verification.routeSnapStatus !== "ROUTE_SNAPPED") blockers.push("OSRM route must be snapped.");
  if (!verification.centerlineRouteId) blockers.push("Centerline route is missing.");
  if (!routePlan.stationedCorridor || !verification.stationedCorridorId) blockers.push("Stationed corridor is missing.");
  if (!routePlan.stationedCorridor?.takeoff || !verification.takeoffId) blockers.push("Corridor takeoff is missing.");
  if (!routePlan.civilMixEstimate || !verification.civilMixEstimateId) blockers.push("Civil mix estimate is missing.");
  if (!verification.quotePreviewId) blockers.push("Vendor response preview is missing.");
  return [...new Set(blockers)];
}

function vendorField(
  routeRequirementId: string,
  googleFieldName: string,
  hyperlinxSource: string,
  value: string | number | boolean,
  readiness: GoogleRfpVendorResponseField["readiness"] = "READY",
  notes?: string,
): GoogleRfpVendorResponseField {
  return {
    fieldId: `${routeRequirementId}:${googleFieldName.replaceAll(/[^A-Za-z0-9]+/g, "_")}`,
    googleTab: "D Vendor Response",
    googleFieldName,
    hyperlinxSource,
    value,
    readiness,
    notes,
  };
}

function createVendorResponsePreview(routePlan: Omit<GoogleRfpRouteBidPlan, "vendorResponsePreview">): GoogleRfpVendorResponsePreview {
  const { routeRequirement, stationedCorridor, quotePackage, civilMixEstimate } = routePlan;
  if (!routeVerificationIsQuoteReady(routePlan.routeVerification) || !stationedCorridor || !quotePackage || !civilMixEstimate) {
    return {
      vendorResponseId: `VENDOR-RESPONSE-${routeRequirement.routeRequirementId}`,
      routeRequirementId: routeRequirement.routeRequirementId,
      bidSegmentName: routeRequirement.bidSegmentName,
      workbookTabTarget: "D Vendor Response",
      status: "BLOCKED",
      noWorkbookWrite: true,
      fields: [
        vendorField(
          routeRequirement.routeRequirementId,
          "Vendor Response Preview",
          "OsrmRouteVerification",
          "Vendor Response Preview Blocked - route coordinates or OSRM snapping require verification.",
          "BLOCKED",
          routePlan.routeVerification.blockers.join(" "),
        ),
      ],
    };
  }
  const takeoff = stationedCorridor.takeoff;
  return {
    vendorResponseId: `VENDOR-RESPONSE-${routeRequirement.routeRequirementId}`,
    routeRequirementId: routeRequirement.routeRequirementId,
    bidSegmentName: routeRequirement.bidSegmentName,
    workbookTabTarget: "D Vendor Response",
    status: "PREVIEW_READY",
    noWorkbookWrite: true,
    fields: [
      vendorField(routeRequirement.routeRequirementId, "Bid Segment Name", "GoogleRfpRouteRequirement.bidSegmentName", routeRequirement.bidSegmentName),
      vendorField(routeRequirement.routeRequirementId, "A Location", "GoogleRfpRouteRequirement.aSite", routeRequirement.aSite.facilityName),
      vendorField(routeRequirement.routeRequirementId, "Z Location", "GoogleRfpRouteRequirement.zSite", routeRequirement.zSite.facilityName),
      vendorField(routeRequirement.routeRequirementId, "Fiber Count to Deliver", "GoogleRfpRouteRequirement.fiberCount", routeRequirement.fiberCount),
      vendorField(routeRequirement.routeRequirementId, "Route Miles", "CorridorTakeoff.routeMiles", takeoff.routeMiles, "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "Fiber Type", "GoogleRfpRouteRequirement.requiredProduct", "Single-mode fiber"),
      vendorField(routeRequirement.routeRequirementId, "Placement", "CivilMixEstimate", "Buried, plow/HDD/open trench mix", "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "Delivery Interval", "Commercial assumption", "TBD after engineering review", "PENDING_COMMERCIAL"),
      vendorField(routeRequirement.routeRequirementId, "Additional Fibers Available", "Sales assumption", "Subject to design reserve", "PENDING_COMMERCIAL"),
      vendorField(routeRequirement.routeRequirementId, "Conduit Size", "Cost profile assumption", routeRequirement.ductRequirement),
      vendorField(routeRequirement.routeRequirementId, "Number of Conduits", "Cost profile assumption", "TBD by final architecture", "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "ILA Quantity", "CorridorTakeoff.regenSiteCount", takeoff.regenSiteCount, "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "ILA Rack Quantity", "ILA cost profile", "36 rack assumption", "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "Construction Length", "CorridorTakeoff.routeFeet", takeoff.routeFeet, "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "DP&E", "CivilMixEstimate.engineeringPermittingAllowance", money(civilMixEstimate.engineeringPermittingAllowance), "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "Construction Cost", "CivilMixEstimate.totalBudgetaryCost", money(civilMixEstimate.totalBudgetaryCost), "PENDING_COMMERCIAL"),
      vendorField(routeRequirement.routeRequirementId, "NRC", "PreliminaryQuotePackage.estimatedNrc", money(quotePackage.estimatedNrc), "PENDING_COMMERCIAL"),
      vendorField(routeRequirement.routeRequirementId, "O&M", "PreliminaryQuotePackage.estimatedMrc", money(quotePackage.estimatedMrc), "PENDING_COMMERCIAL"),
      vendorField(routeRequirement.routeRequirementId, "Risks", "CivilMixEstimate.assumptions", civilMixEstimate.assumptions.join(" "), "PENDING_ENGINEERING"),
      vendorField(routeRequirement.routeRequirementId, "TCO", "PreliminaryQuotePackage.estimatedTcv", money(quotePackage.estimatedTcv), "PENDING_COMMERCIAL"),
    ],
  };
}

function compareDiversity(route: GoogleRfpRouteBidPlan, allRoutes: GoogleRfpRouteBidPlan[]): GoogleRfpRouteDiversityAssessment {
  const requirement = route.routeRequirement;
  const compareToId = requirement.diverseFromRouteRequirementId;
  const compareTo = compareToId ? allRoutes.find((candidate) => candidate.routeRequirement.routeRequirementId === compareToId) : undefined;
  if (!compareToId) {
    return {
      assessmentId: `DIVERSITY-${requirement.routeRequirementId}`,
      routeRequirementId: requirement.routeRequirementId,
      sharedMileageEstimate: 0,
      sharedCorridorPercentage: 0,
      separationWarning: "No route diversity dependency declared.",
      diversityStatus: "NOT_EVALUATED",
    };
  }
  if (!route.stationedCorridor || !compareTo?.stationedCorridor) {
    return {
      assessmentId: `DIVERSITY-${requirement.routeRequirementId}`,
      routeRequirementId: requirement.routeRequirementId,
      comparedToRouteRequirementId: compareToId,
      sharedMileageEstimate: 0,
      sharedCorridorPercentage: 0,
      separationWarning: "Route comparison requires both centerline corridors.",
      diversityStatus: "REQUIRES_ENGINEERING_REVIEW",
    };
  }
  const routeA = route.stationedCorridor.centerlineRoute.geometry;
  const routeB = compareTo.stationedCorridor.centerlineRoute.geometry;
  const sampleCount = Math.min(routeA.length, routeB.length);
  const sharedSamples = routeA.slice(0, sampleCount).filter((coordinate, index) => {
    const other = routeB[index];
    return other && Math.abs(coordinate[0] - other[0]) < 0.02 && Math.abs(coordinate[1] - other[1]) < 0.02;
  }).length;
  const sharedCorridorPercentage = Math.round((sharedSamples / Math.max(1, sampleCount)) * 100);
  const sharedMileageEstimate = Number(((route.stationedCorridor.takeoff.routeMiles * sharedCorridorPercentage) / 100).toFixed(2));
  return {
    assessmentId: `DIVERSITY-${requirement.routeRequirementId}`,
    routeRequirementId: requirement.routeRequirementId,
    comparedToRouteRequirementId: compareToId,
    sharedMileageEstimate,
    sharedCorridorPercentage,
    separationWarning: sharedCorridorPercentage > 25 ? "Potential route overlap requires engineering diversity review." : "First-pass geometry suggests likely diversity.",
    diversityStatus: sharedCorridorPercentage > 50 ? "NOT_DIVERSE" : sharedCorridorPercentage > 25 ? "POTENTIAL_OVERLAP" : "LIKELY_DIVERSE",
  };
}

function createBlockedRoutePlan(opportunity: GoogleRfpOpportunity, requirement: GoogleRfpRouteRequirement): Omit<GoogleRfpRouteBidPlan, "diversityAssessment" | "vendorResponsePreview"> {
  const designRequest = buildDesignLaunchRequestFromRouteRequest(routeRequestFromRequirement(opportunity, requirement));
  const designLaunchResult = createDesignLaunchSession(designRequest);
  return {
    routeRequirement: requirement,
    designLaunchResult,
    stationedCorridor: null,
    proposedGraph: null,
    quotePackage: null,
    civilMixEstimate: null,
    routeVerification: blockedVerification(requirement, ["Live OSRM route verification has not been run for this browser session."], false),
    status: "BLOCKED",
  };
}

async function createOsrmRoutePlan(opportunity: GoogleRfpOpportunity, requirement: GoogleRfpRouteRequirement): Promise<Omit<GoogleRfpRouteBidPlan, "diversityAssessment" | "vendorResponsePreview">> {
  const coordinateBlockers = routeCoordinateBlockers(requirement);
  const designRequest = buildDesignLaunchRequestFromRouteRequest(routeRequestFromRequirement(opportunity, requirement));
  const designLaunchResult = createDesignLaunchSession(designRequest);
  if (coordinateBlockers.length || !designLaunchResult.session) {
    return {
      routeRequirement: requirement,
      designLaunchResult,
      stationedCorridor: null,
      proposedGraph: null,
      quotePackage: null,
      civilMixEstimate: null,
      routeVerification: blockedVerification(requirement, coordinateBlockers.length ? [] : ["Design launch session is blocked."], Boolean(!coordinateBlockers.length)),
      status: "BLOCKED",
    };
  }
  const stationedCorridor = await generateStationedCorridor(designLaunchResult.session);
  const centerlineRoute = stationedCorridor.centerlineRoute;
  if (stationedCorridor.status !== "READY_FOR_PROPOSAL" || centerlineRoute.source !== "OSRM_EXISTING_DAL" || centerlineRoute.status !== "CENTERLINE_ROUTE_VERIFIED") {
    return {
      routeRequirement: requirement,
      designLaunchResult,
      stationedCorridor: null,
      proposedGraph: null,
      quotePackage: null,
      civilMixEstimate: null,
      routeVerification: blockedVerification(
        requirement,
        centerlineRoute.diagnostics.map((entry) => entry.message),
        true,
      ),
      status: "BLOCKED",
    };
  }
  const proposedGraph = createProposedGraphFromStationedCorridor(designLaunchResult.session, stationedCorridor);
  const quotePackage = createPreliminaryQuotePackageFromGraph(proposedGraph);
  const civilMixEstimate = estimateCivilMixFromCorridor({
    routeRequirementId: requirement.routeRequirementId,
    stationedCorridor,
    profile: googleHeliumBudgetaryCostProfileV1,
  });
  const quotePreviewId = `VENDOR-RESPONSE-${requirement.routeRequirementId}`;
  const routeVerification = verificationFromRevisedRoute({
    requirement,
    centerlineRouteId: centerlineRoute.centerlineRouteId,
    totalFeet: centerlineRoute.totalFeet,
    totalMiles: centerlineRoute.totalMiles,
    geometryCoordinateCount: centerlineRoute.geometry.length,
    stationedCorridorId: stationedCorridor.stationedCorridorId,
    takeoffId: stationedCorridor.takeoff.takeoffId,
    civilMixEstimateId: civilMixEstimate.civilMixEstimateId,
    quotePreviewId,
  });
  return {
    routeRequirement: requirement,
    designLaunchResult,
    stationedCorridor,
    proposedGraph,
    quotePackage,
    civilMixEstimate,
    routeVerification,
    status: "READY",
  };
}

function checklist(routePlans: GoogleRfpRouteBidPlan[]): GoogleRfpChecklistItem[] {
  const everyReady = routePlans.every((route) => route.status === "READY" && routeVerificationIsQuoteReady(route.routeVerification));
  const diversityReady = routePlans.some((route) => route.diversityAssessment.diversityStatus === "LIKELY_DIVERSE");
  return [
    "Confirm Helium coordinates",
    "Confirm Muskogee coordinates",
    "Confirm Stillwater coordinates",
    "Generate Helium to Muskogee route",
    "Generate Helium to Stillwater route",
    "Compare route diversity",
    "Review civil mix assumptions",
    "Generate takeoff",
    "Generate budgetary quote",
    "Stage vendor proposed KMZ spans",
    "Populate tab D Vendor Response",
    "Prepare quote email attachments",
    "Final commercial review",
    "Submit to Google contacts",
  ].map((label, index) => ({
    checklistItemId: `GOOGLE-HELIUM-CHECK-${index + 1}`,
    label,
    status: label.includes("Submit") || label.includes("Final") || label.includes("Prepare") ? "NOT_STARTED" : label.includes("diversity") && !diversityReady ? "REQUIRES_REVIEW" : everyReady ? "READY" : "BLOCKED",
  }));
}

function finalizeRoutePlans(preliminaryRoutes: Array<Omit<GoogleRfpRouteBidPlan, "diversityAssessment" | "vendorResponsePreview">>): GoogleRfpRouteBidPlan[] {
  const routePlans: GoogleRfpRouteBidPlan[] = preliminaryRoutes.map((route) => {
    const withPendingDiversity = {
      ...route,
      diversityAssessment: {
        assessmentId: `DIVERSITY-${route.routeRequirement.routeRequirementId}`,
        routeRequirementId: route.routeRequirement.routeRequirementId,
        sharedMileageEstimate: 0,
        sharedCorridorPercentage: 0,
        separationWarning: "Diversity will be evaluated after all route plans are built.",
        diversityStatus: "NOT_EVALUATED" as const,
      },
    };
    return {
      ...withPendingDiversity,
      vendorResponsePreview: createVendorResponsePreview(withPendingDiversity),
    };
  });
  return routePlans.map((route) => {
    const diversityAssessment = compareDiversity(route, routePlans);
    const routeVerification = routeVerificationIsQuoteReady(route.routeVerification)
      ? route.routeVerification
      : { ...route.routeVerification, blockers: verifiedRouteBlockers(route) };
    const status: GoogleRfpRouteBidPlan["status"] = routeVerificationIsQuoteReady(routeVerification) ? "READY" : "BLOCKED";
    return {
      ...route,
      routeVerification,
      diversityAssessment,
      status,
    };
  });
}

function buildBidPlan(opportunity: GoogleRfpOpportunity, routePlansWithDiversity: GoogleRfpRouteBidPlan[]): GoogleRfpBidPlan {
  const allRoutesReady = routePlansWithDiversity.every((route) => route.status === "READY" && routeVerificationIsQuoteReady(route.routeVerification));
  const workbookReady = routePlansWithDiversity.every((route) => route.vendorResponsePreview?.status === "PREVIEW_READY");
  const kmzReady = routePlansWithDiversity.every((route) => route.stationedCorridor);
  const routeBlockers = routePlansWithDiversity.flatMap((route) => route.routeVerification.blockers.map((blocker) => `${route.routeRequirement.bidSegmentName}: ${blocker}`));
  return {
    bidPlanId: `BIDPLAN-${opportunity.rfpId}`,
    opportunity,
    routePlans: routePlansWithDiversity,
    checklist: checklist(routePlansWithDiversity),
    kmzReadiness: kmzReady ? "STAGED" : "BLOCKED",
    workbookReadiness: workbookReady ? "PREVIEW_READY" : "BLOCKED",
    budgetaryReadiness: allRoutesReady ? "READY" : "BLOCKED",
    nextActions: [
      "Confirm customer coordinates and KMZ span interpretation.",
      "Verify each route uses OSRM_EXISTING_DAL snapped centerline geometry before treating quote values as reliable.",
      "Engineering review required for diversity, crossings, permitting, and final construction assumptions.",
      "Stage Tab D Vendor Response preview; do not write workbook until explicit export phase.",
      "Prepare budgetary quote package for commercial review.",
    ],
    diagnostics: [
      `routeCount=${routePlansWithDiversity.length}`,
      `workbookReadiness=${workbookReady ? "PREVIEW_READY" : "BLOCKED"}`,
      `kmzReadiness=${kmzReady ? "STAGED" : "BLOCKED"}`,
      `costProfile=${googleHeliumBudgetaryCostProfileV1.profileId}`,
      `routeBlockers=${routeBlockers.length}`,
      ...routeBlockers,
    ],
    status: allRoutesReady ? "READY_FOR_REVIEW" : "BLOCKED",
    noSubmission: true,
    noWorkbookWrite: true,
    noPersistence: true,
  };
}

export function rebuildGoogleRfpBidPlanFromRoutePlans(opportunity: GoogleRfpOpportunity, routePlans: GoogleRfpRouteBidPlan[]): GoogleRfpBidPlan {
  return buildBidPlan(
    opportunity,
    routePlans.map((route) => {
      const withDiversity = { ...route, diversityAssessment: compareDiversity(route, routePlans) };
      return {
        ...withDiversity,
        vendorResponsePreview: createVendorResponsePreview(withDiversity),
      };
    }),
  );
}

export function buildGoogleRfpBidPlan(opportunity: GoogleRfpOpportunity): GoogleRfpBidPlan {
  return buildBidPlan(opportunity, finalizeRoutePlans(opportunity.requestedRoutes.map((requirement) => createBlockedRoutePlan(opportunity, requirement))));
}

export async function buildGoogleRfpBidPlanWithOsrm(opportunity: GoogleRfpOpportunity): Promise<GoogleRfpBidPlan> {
  const preliminaryRoutes = await Promise.all(opportunity.requestedRoutes.map((requirement) => createOsrmRoutePlan(opportunity, requirement)));
  return buildBidPlan(opportunity, finalizeRoutePlans(preliminaryRoutes));
}

export async function createGoogleRfpRouteRevisionPlan(args: {
  routePlan: GoogleRfpRouteBidPlan;
  viaPoints: Array<[number, number]>;
  avoidanceAreas?: RouteAvoidanceArea[];
  protectedSegmentIds?: string[];
  affectedSegmentIds?: string[];
  actor: string;
  reason: string;
}): Promise<GoogleRfpRouteBidPlan> {
  const { routePlan } = args;
  const session = routePlan.designLaunchResult.session;
  if (!session || !routePlan.proposedGraph) return routePlan;
  const revisionNumber = (routePlan.routeRevisions?.length ?? 0) + 1;
  const revisionResult = await createOsrmRouteRevision({
    graph: routePlan.proposedGraph,
    session,
    viaPoints: args.viaPoints,
    avoidanceAreas: args.avoidanceAreas,
    protectedSegmentIds: args.protectedSegmentIds,
    affectedSegmentIds: args.affectedSegmentIds,
    actor: args.actor,
    reason: args.reason,
    revisionNumber,
    selectedForProposal: true,
  });
  if (!revisionResult.stationedCorridor || revisionResult.revision.snapStatus !== "OSRM_RESNAPPED") {
    return {
      ...routePlan,
      routeRevisions: [...(routePlan.routeRevisions ?? []), revisionResult.revision],
      selectedRevisionId: revisionResult.revision.revisionId,
      routeVerification: {
        ...routePlan.routeVerification,
        routeSnapStatus: "ROUTE_BLOCKED",
        source: "NON_OSRM_BLOCKED",
        mileageSource: "UNAVAILABLE",
        takeoffSource: "BLOCKED",
        quoteSource: "BLOCKED",
        blockers: ["Route revision was saved but OSRM resnap did not complete. Vendor response preview remains blocked."],
      },
      status: "BLOCKED",
    };
  }
  const stationedCorridor = revisionResult.stationedCorridor;
  const proposedGraph = createProposedGraphFromStationedCorridor(session, stationedCorridor);
  const quotePackage = createPreliminaryQuotePackageFromGraph(proposedGraph);
  const civilMixEstimate = estimateCivilMixFromCorridor({
    routeRequirementId: routePlan.routeRequirement.routeRequirementId,
    stationedCorridor,
    profile: googleHeliumBudgetaryCostProfileV1,
  });
  const revision = {
    ...revisionResult.revision,
    civilMixEstimateId: civilMixEstimate.civilMixEstimateId,
    quotePreviewId: `VENDOR-RESPONSE-${routePlan.routeRequirement.routeRequirementId}`,
    selectedForProposal: true,
    revisionStatus: "SELECTED_FOR_PROPOSAL" as const,
  };
  const routeVerification = verificationFromRevisedRoute({
    requirement: routePlan.routeRequirement,
    centerlineRouteId: stationedCorridor.centerlineRouteId,
    totalFeet: stationedCorridor.centerlineRoute.totalFeet,
    totalMiles: stationedCorridor.centerlineRoute.totalMiles,
    geometryCoordinateCount: stationedCorridor.centerlineRoute.geometry.length,
    stationedCorridorId: stationedCorridor.stationedCorridorId,
    takeoffId: stationedCorridor.takeoff.takeoffId,
    civilMixEstimateId: civilMixEstimate.civilMixEstimateId,
    quotePreviewId: revision.quotePreviewId,
    verificationSuffix: revision.revisionId,
  });
  const withPendingVendor: Omit<GoogleRfpRouteBidPlan, "vendorResponsePreview"> = {
    ...routePlan,
    originalStationedCorridor: routePlan.originalStationedCorridor ?? routePlan.stationedCorridor,
    originalProposedGraph: routePlan.originalProposedGraph ?? routePlan.proposedGraph,
    originalQuotePackage: routePlan.originalQuotePackage ?? routePlan.quotePackage,
    originalCivilMixEstimate: routePlan.originalCivilMixEstimate ?? routePlan.civilMixEstimate,
    stationedCorridor,
    proposedGraph,
    quotePackage,
    civilMixEstimate,
    routeVerification,
    routeRevisions: [...(routePlan.routeRevisions ?? []), revision],
    selectedRevisionId: revision.revisionId,
    status: "READY",
  };
  return {
    ...withPendingVendor,
    vendorResponsePreview: createVendorResponsePreview(withPendingVendor),
  };
}

export async function previewGoogleRfpRouteRevision(args: {
  routePlan: GoogleRfpRouteBidPlan;
  viaPoints: Array<[number, number]>;
  protectedSegmentIds?: string[];
  affectedSegmentIds?: string[];
  actor: string;
  reason: string;
}): Promise<RouteRevisionBuildResult | null> {
  const session = args.routePlan.designLaunchResult.session;
  if (!session || !args.routePlan.proposedGraph || !args.viaPoints.length) return null;
  return createOsrmRouteRevision({
    graph: args.routePlan.proposedGraph,
    session,
    viaPoints: args.viaPoints,
    protectedSegmentIds: args.protectedSegmentIds,
    affectedSegmentIds: args.affectedSegmentIds,
    actor: args.actor,
    reason: args.reason,
    revisionNumber: (args.routePlan.routeRevisions?.length ?? 0) + 1,
    selectedForProposal: false,
  });
}
