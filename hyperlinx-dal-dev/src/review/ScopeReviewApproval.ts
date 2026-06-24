import type { ScopeReviewParticipantRole } from "./ScopeReviewParticipant";

export type ScopeReviewApprovalDecision =
  | "APPROVE"
  | "APPROVE_WITH_COMMENTS"
  | "REJECT"
  | "REQUEST_REVISION";

export interface ScopeReviewApproval {
  approvalId: string;
  reviewId: string;
  scopeVersionId: string;
  decision: ScopeReviewApprovalDecision;
  approverId: string;
  approverRole: ScopeReviewParticipantRole;
  comments?: string;
  createdAt: string;
  nonAuthoritative: true;
  mutatesLifecycle: false;
  mutatesAuthority: false;
}
