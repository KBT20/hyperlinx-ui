import type { ScopeReviewParticipantRole } from "./ScopeReviewParticipant";

export type ScopeReviewCommentType =
  | "GENERAL"
  | "TECHNICAL"
  | "COMMERCIAL"
  | "ROUTE"
  | "FACILITY"
  | "RISK"
  | "QUESTION"
  | "ACTION_ITEM";

export type ScopeReviewAttachmentTargetType =
  | "ScopeVersion"
  | "Object"
  | "Station"
  | "Segment"
  | "Location";

export interface ScopeReviewTarget {
  targetType: ScopeReviewAttachmentTargetType;
  targetId: string;
  label?: string;
}

export interface ScopeReviewComment {
  commentId: string;
  reviewId: string;
  scopeVersionId: string;
  commentType: ScopeReviewCommentType;
  target: ScopeReviewTarget;
  body: string;
  authorId: string;
  authorRole: ScopeReviewParticipantRole;
  createdAt: string;
  resolved: boolean;
  nonAuthoritative: true;
}
