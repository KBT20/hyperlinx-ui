import type { ScopeReviewApproval } from "../ScopeReviewApproval";
import type { ScopeReviewComment } from "../ScopeReviewComment";
import type { ScopeReviewParticipant } from "../ScopeReviewParticipant";
import type { ScopeReviewRedline } from "../ScopeReviewRedline";
import {
  addApproval,
  addComment,
  addRedline,
  createScopeReview,
  createScopeReviewViewModel,
} from "../ScopeReviewEngine";

const createdAt = "2026-06-24T00:00:00.000Z";

const participants: ScopeReviewParticipant[] = [
  { participantId: "PART-GOOGLE-CUSTOMER", name: "Google Network Planner", role: "CUSTOMER", organization: "Google", canComment: true, canRedline: true, canApprove: true },
  { participantId: "PART-CRO", name: "Teralinx CRO", role: "CRO", organization: "Teralinx", canComment: true, canRedline: false, canApprove: true },
  { participantId: "PART-ENGINEER", name: "Route Engineer", role: "ENGINEER", organization: "Teralinx", canComment: true, canRedline: true, canApprove: false },
  { participantId: "PART-OBSERVER", name: "Executive Observer", role: "OBSERVER", organization: "Teralinx", canComment: false, canRedline: false, canApprove: false },
];

function comment(commentId: string, reviewId: string, scopeVersionId: string, commentType: ScopeReviewComment["commentType"], body: string, resolved = false): ScopeReviewComment {
  return {
    commentId,
    reviewId,
    scopeVersionId,
    commentType,
    target: { targetType: "ScopeVersion", targetId: scopeVersionId },
    body,
    authorId: "PART-GOOGLE-CUSTOMER",
    authorRole: "CUSTOMER",
    createdAt,
    resolved,
    nonAuthoritative: true,
  };
}

function redline(redlineId: string, reviewId: string, scopeVersionId: string, action: ScopeReviewRedline["action"], description: string): ScopeReviewRedline {
  return {
    redlineId,
    reviewId,
    scopeVersionId,
    action,
    target: { targetType: "Segment", targetId: `${scopeVersionId}-SEGMENT-001` },
    description,
    proposedBy: "PART-ENGINEER",
    proposedByRole: "ENGINEER",
    createdAt,
    nonAuthoritative: true,
    mutatesGeometry: false,
    mutatesScopeVersion: false,
  };
}

function approval(approvalId: string, reviewId: string, scopeVersionId: string, decision: ScopeReviewApproval["decision"], role: ScopeReviewApproval["approverRole"] = "CUSTOMER"): ScopeReviewApproval {
  return {
    approvalId,
    reviewId,
    scopeVersionId,
    decision,
    approverId: role === "CRO" ? "PART-CRO" : "PART-GOOGLE-CUSTOMER",
    approverRole: role,
    comments: decision,
    createdAt,
    nonAuthoritative: true,
    mutatesLifecycle: false,
    mutatesAuthority: false,
  };
}

function baseReview(reviewId: string, scopeVersionId: string, customerId: string, opportunityId: string) {
  return createScopeReview({
    reviewId,
    scopeVersionId,
    customerId,
    opportunityId,
    corridorId: `COR-${opportunityId}`,
    participants,
  });
}

const googleAiCorridorReview = addComment(
  baseReview("REVIEW-GOOGLE-AI-CORRIDOR", "SV-GOOGLE-AI-CORRIDOR", "CUST-GOOGLE", "OPP-GOOGLE-AI-CORRIDOR"),
  comment("COMMENT-GOOGLE-AI-001", "REVIEW-GOOGLE-AI-CORRIDOR", "SV-GOOGLE-AI-CORRIDOR", "GENERAL", "Review AI corridor candidate with power and data center context."),
);

const googleRouteRevision = addApproval(
  addRedline(
    googleAiCorridorReview,
    redline("REDLINE-GOOGLE-ROUTE-001", "REVIEW-GOOGLE-AI-CORRIDOR", "SV-GOOGLE-AI-CORRIDOR", "RELOCATE", "Propose relocating the route around customer campus expansion parcel."),
  ),
  approval("APPROVAL-GOOGLE-REVISION", "REVIEW-GOOGLE-AI-CORRIDOR", "SV-GOOGLE-AI-CORRIDOR", "REQUEST_REVISION"),
);

const googleDiversityRequest = addComment(
  baseReview("REVIEW-GOOGLE-DIVERSITY", "SV-GOOGLE-DIVERSITY", "CUST-GOOGLE", "OPP-GOOGLE-DIVERSITY"),
  comment("COMMENT-GOOGLE-DIVERSITY-001", "REVIEW-GOOGLE-DIVERSITY", "SV-GOOGLE-DIVERSITY", "RISK", "Customer asks for dual-diverse route evidence before Prism scoring."),
);

const metaCampusExpansion = addRedline(
  baseReview("REVIEW-META-CAMPUS", "SV-META-CAMPUS", "CUST-META", "OPP-META-CAMPUS"),
  redline("REDLINE-META-CAMPUS-001", "REVIEW-META-CAMPUS", "SV-META-CAMPUS", "ANNOTATE", "Annotate future campus expansion boundary as customer-provided evidence."),
);

const oracleGpuExpansion = addComment(
  baseReview("REVIEW-ORACLE-GPU", "SV-ORACLE-GPU", "CUST-ORACLE", "OPP-ORACLE-GPU"),
  comment("COMMENT-ORACLE-GPU-001", "REVIEW-ORACLE-GPU", "SV-ORACLE-GPU", "FACILITY", "GPU facility assumptions require power handoff review."),
);

const carrierLongHaulReview = addComment(
  baseReview("REVIEW-CARRIER-LONG-HAUL", "SV-CARRIER-LONG-HAUL", "CUST-CARRIER", "OPP-CARRIER-LONG-HAUL"),
  comment("COMMENT-CARRIER-LH-001", "REVIEW-CARRIER-LONG-HAUL", "SV-CARRIER-LONG-HAUL", "ROUTE", "Carrier supplied route remains seed evidence only."),
);

const approvedReview = addApproval(
  addComment(
    baseReview("REVIEW-APPROVED", "SV-APPROVED", "CUST-GOOGLE", "OPP-APPROVED"),
    comment("COMMENT-APPROVED-001", "REVIEW-APPROVED", "SV-APPROVED", "GENERAL", "No objections.", true),
  ),
  approval("APPROVAL-APPROVED", "REVIEW-APPROVED", "SV-APPROVED", "APPROVE"),
);

const rejectedReview = addApproval(
  baseReview("REVIEW-REJECTED", "SV-REJECTED", "CUST-GOOGLE", "OPP-REJECTED"),
  approval("APPROVAL-REJECTED", "REVIEW-REJECTED", "SV-REJECTED", "REJECT"),
);

const revisionRequestedReview = addApproval(
  baseReview("REVIEW-REVISION", "SV-REVISION", "CUST-GOOGLE", "OPP-REVISION"),
  approval("APPROVAL-REVISION", "REVIEW-REVISION", "SV-REVISION", "REQUEST_REVISION"),
);

const readyForPrismReview = addApproval(
  addComment(
    baseReview("REVIEW-READY-PRISM", "SV-READY-PRISM", "CUST-GOOGLE", "OPP-READY-PRISM"),
    comment("COMMENT-READY-PRISM-001", "REVIEW-READY-PRISM", "SV-READY-PRISM", "TECHNICAL", "Customer confirms technical assumptions for Prism scoring.", true),
  ),
  approval("APPROVAL-READY-PRISM", "REVIEW-READY-PRISM", "SV-READY-PRISM", "APPROVE_WITH_COMMENTS", "CRO"),
);

export const scopeReviewFixtures = Object.freeze([
  googleAiCorridorReview,
  googleRouteRevision,
  googleDiversityRequest,
  metaCampusExpansion,
  oracleGpuExpansion,
  carrierLongHaulReview,
  approvedReview,
  rejectedReview,
  revisionRequestedReview,
  readyForPrismReview,
]);

export const scopeReviewViewModelFixtures = Object.freeze(scopeReviewFixtures.map(createScopeReviewViewModel));

export function evaluateScopeReviewFixtures() {
  return scopeReviewFixtures.map((review, index) => ({
    review,
    viewModel: scopeReviewViewModelFixtures[index],
  }));
}
