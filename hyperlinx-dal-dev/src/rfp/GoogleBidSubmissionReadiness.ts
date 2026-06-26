export type GoogleBidSubmissionReadinessStatus =
  | "BID_PREVIEW_READY"
  | "COMMERCIAL_REVIEW_REQUIRED"
  | "ENGINEERING_REVIEW_REQUIRED"
  | "EXPORT_NOT_STARTED"
  | "SUBMISSION_NOT_STARTED";

export interface GoogleBidKmzStagingPreview {
  sourceKmzsDetected: string[];
  vendorProposedSpansFolderTargets: string[];
  routeSpanStatuses: Array<{
    routeRequirementId: string;
    routeName: string;
    staged: boolean;
  }>;
  kmzExportReadiness: "NOT_STARTED" | "STAGED" | "READY" | "BLOCKED";
  humanReviewRequired: true;
}

export interface GoogleBidSubmissionReadiness {
  status: GoogleBidSubmissionReadinessStatus;
  commercialReviewRequired: boolean;
  engineeringReviewRequired: boolean;
  exportNotStarted: boolean;
  submissionNotStarted: boolean;
  message: string;
  noExternalSubmission: true;
}
