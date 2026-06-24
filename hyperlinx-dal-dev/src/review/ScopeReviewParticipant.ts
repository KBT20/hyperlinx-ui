export type ScopeReviewParticipantRole =
  | "CUSTOMER"
  | "ACCOUNT_OWNER"
  | "CRO"
  | "ENGINEER"
  | "DESIGNER"
  | "PROJECT_MANAGER"
  | "EXECUTIVE"
  | "VENDOR"
  | "OBSERVER";

export interface ScopeReviewParticipant {
  participantId: string;
  name: string;
  role: ScopeReviewParticipantRole;
  organization?: string;
  email?: string;
  canComment: boolean;
  canRedline: boolean;
  canApprove: boolean;
}
