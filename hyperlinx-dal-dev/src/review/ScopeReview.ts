import type { ScopeReviewApproval } from "./ScopeReviewApproval";
import type { ScopeReviewComment } from "./ScopeReviewComment";
import type { ScopeReviewParticipant } from "./ScopeReviewParticipant";
import type { ScopeReviewRedline } from "./ScopeReviewRedline";

export type ScopeReviewStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "REVISION_REQUESTED"
  | "REVIEW_COMPLETE"
  | "APPROVED_FOR_PRISM"
  | "BLOCKED";

export interface ScopeReviewDiagnostic {
  code:
    | "SCOPE_REVIEW_CREATED"
    | "COMMENT_ADDED"
    | "REDLINE_ADDED"
    | "APPROVAL_ADDED"
    | "REVISION_REQUESTED"
    | "READY_FOR_PRISM";
  severity: "INFO" | "WARNING" | "ERROR";
  reviewId: string;
  scopeVersionId: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ScopeReviewTraceability {
  customerId: string;
  opportunityId: string;
  corridorId?: string;
  scopeVersionId: string;
  reviewId: string;
}

export interface ScopeReview {
  reviewId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId?: string;
  status: ScopeReviewStatus;
  participants: ScopeReviewParticipant[];
  comments: ScopeReviewComment[];
  redlines: ScopeReviewRedline[];
  approvals: ScopeReviewApproval[];
  diagnostics: ScopeReviewDiagnostic[];
  traceability: ScopeReviewTraceability;
  createdAt: string;
  updatedAt: string;
  scopeVersionRemainsTruth: true;
  nonAuthoritative: true;
}

export interface ScopeReviewWorkspaceModel {
  workspaceId: "SCOPE_REVIEW";
  title: string;
  noPersistence: true;
  noLifecycleChanges: true;
  noAuthorityChanges: true;
  noScopeVersionCreation: true;
}

export interface ScopeReviewCommentPanelModel {
  commentCount: number;
  unresolvedCount: number;
  supportedCommentTypes: string[];
}

export interface ScopeReviewRedlinePanelModel {
  redlineCount: number;
  supportedRedlineActions: string[];
  proposalsOnly: true;
}

export interface ScopeReviewApprovalPanelModel {
  approvalCount: number;
  latestDecision?: string;
  approvalsAreNonAuthoritative: true;
}

export interface ScopeReviewStatusPanelModel {
  status: ScopeReviewStatus;
  readyForPrism: boolean;
  blockers: string[];
}

export interface ScopeReviewViewModel {
  workspace: ScopeReviewWorkspaceModel;
  commentPanel: ScopeReviewCommentPanelModel;
  redlinePanel: ScopeReviewRedlinePanelModel;
  approvalPanel: ScopeReviewApprovalPanelModel;
  statusPanel: ScopeReviewStatusPanelModel;
}
