import type { CivilMixCategory } from "../construction/CivilMixProfile";
import type { GoogleRfpBidPlan, GoogleRfpDiversityStatus, GoogleRfpRouteBidPlan } from "./GoogleRfpBidPlan";
import type { GoogleBidCommercialSummary } from "./GoogleBidCommercialSummary";
import type { GoogleBidExecutiveSummary } from "./GoogleBidExecutiveSummary";
import type { GoogleBidRoutePreview } from "./GoogleBidRoutePreview";
import type { GoogleBidKmzStagingPreview, GoogleBidSubmissionReadiness } from "./GoogleBidSubmissionReadiness";
import type { GoogleRfpVendorResponsePreview } from "./GoogleRfpVendorResponse";

export interface GoogleBidDiagnosticsSummary {
  rfpId: string;
  routeCount: number;
  vendorResponsePreviewCount: number;
  checklistReadyCount: number;
  checklistBlockedCount: number;
  civilMixStatus: "READY" | "BLOCKED";
  diversityStatus: GoogleRfpDiversityStatus;
  kmzStagingStatus: GoogleRfpBidPlan["kmzReadiness"];
  workbookPreviewStatus: GoogleRfpBidPlan["workbookReadiness"];
}

export interface GoogleBidPackagePreview {
  bidPackagePreviewId: string;
  bidPlanId: string;
  executiveSummary: GoogleBidExecutiveSummary;
  routePreviews: GoogleBidRoutePreview[];
  commercialSummary: GoogleBidCommercialSummary;
  submissionReadiness: GoogleBidSubmissionReadiness;
  kmzStagingPreview: GoogleBidKmzStagingPreview;
  vendorResponsePreviews: GoogleRfpVendorResponsePreview[];
  diagnosticsSummary: GoogleBidDiagnosticsSummary;
  generatedAt: string;
  previewOnly: true;
  noWorkbookWrite: true;
  noKmzExport: true;
  noExternalSubmission: true;
}

function miles(feet: number) {
  return Number((feet / 5280).toFixed(2));
}

function categoryFeet(routePlan: GoogleRfpRouteBidPlan, category: CivilMixCategory) {
  return routePlan.civilMixEstimate?.lineItems.find((item) => item.category === category)?.feet ?? 0;
}

function categoryCount(routePlan: GoogleRfpRouteBidPlan, category: CivilMixCategory) {
  return routePlan.civilMixEstimate?.lineItems.find((item) => item.category === category)?.count ?? 0;
}

function routePreview(routePlan: GoogleRfpRouteBidPlan): GoogleBidRoutePreview {
  const takeoff = routePlan.stationedCorridor?.takeoff;
  return {
    routeRequirementId: routePlan.routeRequirement.routeRequirementId,
    routeName: routePlan.routeRequirement.bidSegmentName,
    aSite: routePlan.routeRequirement.aSite.facilityName,
    zSite: routePlan.routeRequirement.zSite.facilityName,
    routeMiles: takeoff?.routeMiles ?? 0,
    civilMix: routePlan.civilMixEstimate?.lineItems.map((item) => item.category).join(" / ") ?? "Blocked",
    plowMiles: miles(categoryFeet(routePlan, "PLOW")),
    hddMiles: miles(categoryFeet(routePlan, "HDD_BORE")),
    openTrenchMiles: miles(categoryFeet(routePlan, "OPEN_TRENCH")),
    bridgeAttachmentCount: categoryCount(routePlan, "BRIDGE_ATTACHMENT"),
    railCrossings: takeoff?.railCrossingCount ?? 0,
    waterCrossings: takeoff ? takeoff.waterCrossingCount + takeoff.bridgeCrossingCount : 0,
    highwayCrossings: takeoff?.roadCrossingCount ?? 0,
    vaultCount: takeoff?.vaultCount ?? 0,
    handholeCount: takeoff?.handholeCount ?? 0,
    regenIlaCount: takeoff?.regenSiteCount ?? 0,
    estimatedNrc: routePlan.quotePackage?.estimatedNrc ?? 0,
    estimatedMrc: routePlan.quotePackage?.estimatedMrc ?? 0,
    riskNotes: [
      ...routePlan.routeVerification.blockers,
      routePlan.diversityAssessment.separationWarning,
      ...(routePlan.civilMixEstimate?.assumptions ?? []),
    ],
    diversityStatus: routePlan.diversityAssessment.diversityStatus,
    status: routePlan.status,
  };
}

function mostConservativeDiversity(statuses: GoogleRfpDiversityStatus[]): GoogleRfpDiversityStatus {
  if (statuses.includes("NOT_DIVERSE")) return "NOT_DIVERSE";
  if (statuses.includes("POTENTIAL_OVERLAP")) return "POTENTIAL_OVERLAP";
  if (statuses.includes("REQUIRES_ENGINEERING_REVIEW")) return "REQUIRES_ENGINEERING_REVIEW";
  if (statuses.includes("LIKELY_DIVERSE")) return "LIKELY_DIVERSE";
  return "NOT_EVALUATED";
}

export function buildGoogleBidPackagePreview(bidPlan: GoogleRfpBidPlan): GoogleBidPackagePreview {
  const routePreviews = bidPlan.routePlans.map(routePreview);
  const routeVerificationBlockers = bidPlan.routePlans.flatMap((route) => route.routeVerification.blockers.map((blocker) => `${route.routeRequirement.bidSegmentName}: ${blocker}`));
  const diversityStatus = mostConservativeDiversity(bidPlan.routePlans.map((route) => route.diversityAssessment.diversityStatus));
  const vendorResponsePreviews = bidPlan.routePlans.flatMap((route) => route.vendorResponsePreview ? [route.vendorResponsePreview] : []);
  const totalEstimatedNrc = routePreviews.reduce((sum, route) => sum + route.estimatedNrc, 0);
  const totalEstimatedMrc = routePreviews.reduce((sum, route) => sum + route.estimatedMrc, 0);
  const totalCivilBudgetaryCost = bidPlan.routePlans.reduce((sum, route) => sum + (route.civilMixEstimate?.totalBudgetaryCost ?? 0), 0);
  const totalEngineeringPermittingAllowance = bidPlan.routePlans.reduce((sum, route) => sum + (route.civilMixEstimate?.engineeringPermittingAllowance ?? 0), 0);
  const totalProjectManagementAllowance = bidPlan.routePlans.reduce((sum, route) => sum + (route.civilMixEstimate?.projectManagementAllowance ?? 0), 0);
  const totalContingencyAllowance = bidPlan.routePlans.reduce((sum, route) => sum + (route.civilMixEstimate?.contingencyAllowance ?? 0), 0);
  const checklistReadyCount = bidPlan.checklist.filter((item) => item.status === "READY").length;
  const checklistBlockedCount = bidPlan.checklist.filter((item) => item.status === "BLOCKED").length;
  const submissionReadiness: GoogleBidSubmissionReadiness = {
    status: bidPlan.status === "READY_FOR_REVIEW" ? "BID_PREVIEW_READY" : "ENGINEERING_REVIEW_REQUIRED",
    commercialReviewRequired: true,
    engineeringReviewRequired: true,
    exportNotStarted: bidPlan.kmzReadiness !== "READY",
    submissionNotStarted: true,
    message: routeVerificationBlockers.length
      ? `Route verification blocks quote readiness: ${routeVerificationBlockers.join(" ")}`
      : "No external submission is performed by DAL.",
    noExternalSubmission: true,
  };
  return {
    bidPackagePreviewId: `BIDPREVIEW-${bidPlan.bidPlanId}`,
    bidPlanId: bidPlan.bidPlanId,
    executiveSummary: {
      customer: bidPlan.opportunity.customerName,
      opportunity: bidPlan.opportunity.opportunityName,
      rfpIssueDate: bidPlan.opportunity.issueDate,
      kmzDeadline: bidPlan.opportunity.kmzDeadline,
      budgetaryDeadline: bidPlan.opportunity.budgetaryDeadline,
      routeCount: bidPlan.routePlans.length,
      totalRouteMiles: Number(routePreviews.reduce((sum, route) => sum + route.routeMiles, 0).toFixed(2)),
      totalEstimatedNrc,
      totalEstimatedMrc,
      totalPlowMiles: Number(routePreviews.reduce((sum, route) => sum + route.plowMiles, 0).toFixed(2)),
      totalHddMiles: Number(routePreviews.reduce((sum, route) => sum + route.hddMiles, 0).toFixed(2)),
      totalOpenTrenchMiles: Number(routePreviews.reduce((sum, route) => sum + route.openTrenchMiles, 0).toFixed(2)),
      totalVaultsHandholes: routePreviews.reduce((sum, route) => sum + route.vaultCount + route.handholeCount, 0),
      totalRegenIlaSites: routePreviews.reduce((sum, route) => sum + route.regenIlaCount, 0),
      highwayCrossings: routePreviews.reduce((sum, route) => sum + route.highwayCrossings, 0),
      railCrossings: routePreviews.reduce((sum, route) => sum + route.railCrossings, 0),
      waterCrossings: routePreviews.reduce((sum, route) => sum + route.waterCrossings, 0),
      diversityStatus,
      commercialReviewStatus: "COMMERCIAL_REVIEW_REQUIRED",
      submissionReadiness: submissionReadiness.status,
    },
    routePreviews,
    commercialSummary: {
      totalEstimatedNrc,
      totalEstimatedMrc,
      totalEstimatedTco: bidPlan.routePlans.reduce((sum, route) => sum + (route.quotePackage?.estimatedTcv ?? 0), 0),
      totalCivilBudgetaryCost,
      totalEngineeringPermittingAllowance,
      totalProjectManagementAllowance,
      totalContingencyAllowance,
      reviewStatus: "COMMERCIAL_REVIEW_REQUIRED",
      assumptions: [
        "Budgetary preview only.",
        "Route Engineering must verify GIS constraints, named crossings, permits, construction method, and diversity.",
        "No workbook write, KMZ export, email, or external submission occurs in DAL.",
      ],
    },
    submissionReadiness,
    kmzStagingPreview: {
      sourceKmzsDetected: ["HIU-Summary-06-03-2026.kmz", "MUS 07162024.kmz"],
      vendorProposedSpansFolderTargets: bidPlan.routePlans.map((route) => route.routeRequirement.kmzFolderTarget),
      routeSpanStatuses: bidPlan.routePlans.map((route) => ({
        routeRequirementId: route.routeRequirement.routeRequirementId,
        routeName: route.routeRequirement.bidSegmentName,
        staged: route.routeVerification.routeSnapStatus === "ROUTE_SNAPPED" && Boolean(route.stationedCorridor),
      })),
      kmzExportReadiness: bidPlan.kmzReadiness,
      humanReviewRequired: true,
    },
    vendorResponsePreviews,
    diagnosticsSummary: {
      rfpId: bidPlan.opportunity.rfpId,
      routeCount: bidPlan.routePlans.length,
      vendorResponsePreviewCount: vendorResponsePreviews.length,
      checklistReadyCount,
      checklistBlockedCount,
      civilMixStatus: bidPlan.routePlans.every((route) => route.civilMixEstimate) ? "READY" : "BLOCKED",
      diversityStatus,
      kmzStagingStatus: bidPlan.kmzReadiness,
      workbookPreviewStatus: bidPlan.workbookReadiness,
    },
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    noWorkbookWrite: true,
    noKmzExport: true,
    noExternalSubmission: true,
  };
}
