import type { BaselineNetworkCandidate } from "../translate/BaselineNetworkCandidate";
import type { ScopeReview } from "./ScopeReview";
import type {
  ApprovalPanelModel,
  BaselineNetworkReviewCardModel,
  CommentPanelModel,
  ParticipantPanelModel,
  RedlinePanelModel,
  ReviewSummaryCardModel,
  ScopeReviewNextActionPanelModel,
  ScopeReviewReadinessCardModel,
  ScopeReviewWorkspaceSummary,
} from "./ScopeReviewWorkspaceSummary";
import type { ScopeReviewWorkspaceNextAction, ScopeReviewWorkspaceStatus } from "./ScopeReviewWorkspaceStatus";

export type ScopeReviewWorkspaceSection =
  | "REVIEW_SUMMARY"
  | "PARTICIPANTS"
  | "BASELINE_NETWORK_SUMMARY"
  | "COMMENTS"
  | "REDLINES"
  | "APPROVALS"
  | "REVIEW_STATUS"
  | "NEXT_ACTION"
  | "DIAGNOSTICS";

export interface ScopeReviewWorkspaceBlocker {
  blockerId: string;
  field: string;
  severity: "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  blocksPrism: boolean;
}

export interface ScopeReviewWorkspaceDiagnostic {
  code:
    | "SCOPE_REVIEW_WORKSPACE_CREATED"
    | "COMMENT_REGISTERED"
    | "REDLINE_REGISTERED"
    | "APPROVAL_REGISTERED"
    | "REVISION_REQUESTED"
    | "READY_FOR_PRISM"
    | "REVIEW_BLOCKED";
  severity: "INFO" | "WARNING" | "ERROR";
  reviewId: string;
  scopeVersionId: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ScopeReviewWorkspaceInput {
  review: ScopeReview;
  baselineNetworkCandidate?: BaselineNetworkCandidate;
  evaluatedAt?: string;
}

export interface ScopeReviewWorkspace {
  workspaceId: "SCOPE_REVIEW_WORKSPACE";
  title: string;
  review: ScopeReview;
  baselineNetworkCandidate?: BaselineNetworkCandidate;
  status: ScopeReviewWorkspaceStatus;
  sections: ScopeReviewWorkspaceSection[];
  summary: ScopeReviewWorkspaceSummary;
  blockers: ScopeReviewWorkspaceBlocker[];
  diagnostics: ScopeReviewWorkspaceDiagnostic[];
  nextAction: ScopeReviewWorkspaceNextAction;
  cards: {
    reviewSummary: ReviewSummaryCardModel;
    participants: ParticipantPanelModel;
    baselineNetwork: BaselineNetworkReviewCardModel;
    comments: CommentPanelModel;
    redlines: RedlinePanelModel;
    approvals: ApprovalPanelModel;
    readiness: ScopeReviewReadinessCardModel;
    nextAction: ScopeReviewNextActionPanelModel;
  };
  scopeVersionRemainsTruth: true;
  noPersistence: true;
  noServerRoutes: true;
  noReactImplementation: true;
  noGeometryMutation: true;
  noScopeVersionMutation: true;
}
