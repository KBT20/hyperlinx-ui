import type { BaselineNetworkCandidate } from "../translate/BaselineNetworkCandidate";
import type { ScopeReview } from "./ScopeReview";
import type { ScopeReviewWorkspaceNextAction } from "./ScopeReviewWorkspaceStatus";

export interface ScopeReviewWorkspaceSummary {
  reviewId: string;
  customerId: string;
  opportunityId: string;
  scopeVersionId: string;
  status: string;
  participantCount: number;
  commentCount: number;
  unresolvedCommentCount: number;
  redlineCount: number;
  approvalCount: number;
  baselineReferenceArchitecture?: string;
  baselineObjectCount: number;
  readyForPrism: boolean;
  nextAction: ScopeReviewWorkspaceNextAction;
  blockers: string[];
}

export interface ReviewSummaryCardModel {
  modelId: "REVIEW_SUMMARY_CARD";
  reviewId: string;
  status: string;
  participantCount: number;
  readyForPrism: boolean;
}

export interface ParticipantPanelModel {
  modelId: "PARTICIPANT_PANEL";
  participantCount: number;
  canApproveCount: number;
  canRedlineCount: number;
  canCommentCount: number;
}

export interface BaselineNetworkReviewCardModel {
  modelId: "SCOPE_REVIEW_BASELINE_NETWORK_CARD";
  candidateId?: string;
  referenceArchitecture?: string;
  candidateObjectCount: number;
  readiness: "READY_FOR_SCOPE_REVIEW" | "BLOCKED" | "MISSING";
  blockers: string[];
}

export interface CommentPanelModel {
  modelId: "SCOPE_REVIEW_COMMENT_PANEL";
  commentCount: number;
  unresolvedCount: number;
  actionItemCount: number;
}

export interface RedlinePanelModel {
  modelId: "SCOPE_REVIEW_REDLINE_PANEL";
  redlineCount: number;
  proposalsOnly: true;
  mutatesGeometry: false;
}

export interface ApprovalPanelModel {
  modelId: "SCOPE_REVIEW_APPROVAL_PANEL";
  approvalCount: number;
  latestDecision?: string;
  approvalsAreNonAuthoritative: true;
}

export interface ScopeReviewReadinessCardModel {
  modelId: "SCOPE_REVIEW_WORKSPACE_READINESS_CARD";
  status: "APPROVED_FOR_PRISM" | "BLOCKED";
  nextWorkspace?: "Prism";
  blockers: string[];
}

export interface ScopeReviewNextActionPanelModel {
  modelId: "SCOPE_REVIEW_NEXT_ACTION_PANEL";
  nextAction: ScopeReviewWorkspaceNextAction;
}

export function summarizeReviewForWorkspace(
  review: ScopeReview,
  baseline: BaselineNetworkCandidate | undefined,
  nextAction: ScopeReviewWorkspaceNextAction,
  blockers: readonly string[],
): ScopeReviewWorkspaceSummary {
  return {
    reviewId: review.reviewId,
    customerId: review.customerId,
    opportunityId: review.opportunityId,
    scopeVersionId: review.scopeVersionId,
    status: review.status,
    participantCount: review.participants.length,
    commentCount: review.comments.length,
    unresolvedCommentCount: review.comments.filter((comment) => !comment.resolved).length,
    redlineCount: review.redlines.length,
    approvalCount: review.approvals.length,
    baselineReferenceArchitecture: baseline?.referenceArchitecture,
    baselineObjectCount: baseline?.candidateObjects.length ?? 0,
    readyForPrism: blockers.length === 0 && review.status === "APPROVED_FOR_PRISM",
    nextAction,
    blockers: [...blockers],
  };
}
