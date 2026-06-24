import type { ScopeReviewStatus } from "./ScopeReview";

export type ScopeReviewWorkspaceStatus = ScopeReviewStatus;

export type ScopeReviewWorkspaceNextActionType =
  | "ADD_COMMENT"
  | "ADD_REDLINE"
  | "REQUEST_REVISION"
  | "APPROVE_REVIEW"
  | "OPEN_PRISM"
  | "RESOLVE_BLOCKERS";

export interface ScopeReviewWorkspaceNextAction {
  actionId: string;
  actionType: ScopeReviewWorkspaceNextActionType;
  label: string;
  targetWorkspace: "Scope Review" | "Prism";
  reason: string;
  blockerCount: number;
  noExecution: true;
  noPersistence: true;
}

export function createScopeReviewWorkspaceNextAction(
  reviewId: string,
  actionType: ScopeReviewWorkspaceNextActionType,
  reason: string,
  blockerCount = 0,
): ScopeReviewWorkspaceNextAction {
  const labels: Record<ScopeReviewWorkspaceNextActionType, string> = {
    ADD_COMMENT: "Add Comment",
    ADD_REDLINE: "Add Redline",
    REQUEST_REVISION: "Request Revision",
    APPROVE_REVIEW: "Approve Review",
    OPEN_PRISM: "Open Prism",
    RESOLVE_BLOCKERS: "Resolve Blockers",
  };

  return {
    actionId: `SCOPE-REVIEW-NEXT-${reviewId}-${actionType}`,
    actionType,
    label: labels[actionType],
    targetWorkspace: actionType === "OPEN_PRISM" ? "Prism" : "Scope Review",
    reason,
    blockerCount,
    noExecution: true,
    noPersistence: true,
  };
}
