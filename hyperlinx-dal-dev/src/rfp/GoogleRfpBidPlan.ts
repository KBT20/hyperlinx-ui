import type { CivilMixEstimate } from "../construction/CivilMixEstimate";
import type { DesignLaunchResult } from "../design/DesignLaunchResult";
import type { PreliminaryQuotePackage } from "../proposal/PreliminaryQuotePackage";
import type { ProposedGraph } from "../proposedGraph/ProposedGraph";
import type { OsrmRouteVerification } from "../routeGeneration/OsrmRouteVerification";
import type { RouteRevision } from "../redline/RouteRevision";
import type { StationedCorridor } from "../corridor/StationedCorridor";
import type { GoogleRfpOpportunity } from "./GoogleRfpOpportunity";
import type { GoogleRfpRouteRequirement } from "./GoogleRfpRouteRequirement";
import type { GoogleRfpVendorResponsePreview } from "./GoogleRfpVendorResponse";

export type GoogleRfpDiversityStatus =
  | "NOT_EVALUATED"
  | "LIKELY_DIVERSE"
  | "POTENTIAL_OVERLAP"
  | "NOT_DIVERSE"
  | "REQUIRES_ENGINEERING_REVIEW";

export interface GoogleRfpRouteDiversityAssessment {
  assessmentId: string;
  routeRequirementId: string;
  comparedToRouteRequirementId?: string;
  sharedMileageEstimate: number;
  sharedCorridorPercentage: number;
  separationWarning: string;
  diversityStatus: GoogleRfpDiversityStatus;
}

export interface GoogleRfpRouteBidPlan {
  routeRequirement: GoogleRfpRouteRequirement;
  designLaunchResult: DesignLaunchResult;
  stationedCorridor: StationedCorridor | null;
  proposedGraph: ProposedGraph | null;
  quotePackage: PreliminaryQuotePackage | null;
  civilMixEstimate: CivilMixEstimate | null;
  originalStationedCorridor?: StationedCorridor | null;
  originalProposedGraph?: ProposedGraph | null;
  originalQuotePackage?: PreliminaryQuotePackage | null;
  originalCivilMixEstimate?: CivilMixEstimate | null;
  routeVerification: OsrmRouteVerification;
  routeRevisions?: RouteRevision[];
  selectedRevisionId?: string;
  vendorResponsePreview: GoogleRfpVendorResponsePreview | null;
  diversityAssessment: GoogleRfpRouteDiversityAssessment;
  status: "READY" | "BLOCKED";
}

export interface GoogleRfpChecklistItem {
  checklistItemId: string;
  label: string;
  status: "NOT_STARTED" | "READY" | "BLOCKED" | "REQUIRES_REVIEW";
}

export interface GoogleRfpBidPlan {
  bidPlanId: string;
  opportunity: GoogleRfpOpportunity;
  routePlans: GoogleRfpRouteBidPlan[];
  checklist: GoogleRfpChecklistItem[];
  kmzReadiness: "NOT_STARTED" | "STAGED" | "READY" | "BLOCKED";
  workbookReadiness: "NOT_STARTED" | "PREVIEW_READY" | "BLOCKED";
  budgetaryReadiness: "NOT_STARTED" | "READY" | "BLOCKED";
  nextActions: string[];
  diagnostics: string[];
  status: "BUDGETARY_IN_PROGRESS" | "READY_FOR_REVIEW" | "BLOCKED";
  noSubmission: true;
  noWorkbookWrite: true;
  noPersistence: true;
}
