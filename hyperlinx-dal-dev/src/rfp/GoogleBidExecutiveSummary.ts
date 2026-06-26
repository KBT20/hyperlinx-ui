import type { GoogleRfpDiversityStatus } from "./GoogleRfpBidPlan";

export interface GoogleBidExecutiveSummary {
  customer: string;
  opportunity: string;
  rfpIssueDate: string;
  kmzDeadline: string;
  budgetaryDeadline: string;
  routeCount: number;
  totalRouteMiles: number;
  totalEstimatedNrc: number;
  totalEstimatedMrc: number;
  totalPlowMiles: number;
  totalHddMiles: number;
  totalOpenTrenchMiles: number;
  totalVaultsHandholes: number;
  totalRegenIlaSites: number;
  highwayCrossings: number;
  railCrossings: number;
  waterCrossings: number;
  diversityStatus: GoogleRfpDiversityStatus;
  commercialReviewStatus: "COMMERCIAL_REVIEW_REQUIRED" | "READY_FOR_CUSTOMER_REVIEW";
  submissionReadiness: "BID_PREVIEW_READY" | "COMMERCIAL_REVIEW_REQUIRED" | "ENGINEERING_REVIEW_REQUIRED" | "EXPORT_NOT_STARTED" | "SUBMISSION_NOT_STARTED";
}
