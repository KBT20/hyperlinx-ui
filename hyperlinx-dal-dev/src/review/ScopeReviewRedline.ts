import type { ScopeReviewTarget } from "./ScopeReviewComment";
import type { ScopeReviewParticipantRole } from "./ScopeReviewParticipant";

export type ScopeReviewRedlineAction =
  | "ADD"
  | "REMOVE"
  | "MODIFIY"
  | "MODIFY"
  | "MOVE"
  | "RELOCATE"
  | "ANNOTATE";

export interface ScopeReviewRedline {
  redlineId: string;
  reviewId: string;
  scopeVersionId: string;
  action: ScopeReviewRedlineAction;
  target: ScopeReviewTarget;
  description: string;
  proposedBy: string;
  proposedByRole: ScopeReviewParticipantRole;
  createdAt: string;
  geometryProposal?: unknown;
  nonAuthoritative: true;
  mutatesGeometry: false;
  mutatesScopeVersion: false;
}
