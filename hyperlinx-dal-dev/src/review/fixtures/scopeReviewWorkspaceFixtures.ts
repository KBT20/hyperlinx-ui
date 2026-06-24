import {
  carrierLongHaulTranslateWorkspace,
  googleTexasAiTranslateWorkspace,
  metaAiCorridorTranslateWorkspace,
  oracleGpuExpansionTranslateWorkspace,
} from "../../translate/fixtures/translateWorkspaceFixtures";
import type { ScopeReviewApproval } from "../ScopeReviewApproval";
import type { ScopeReviewComment } from "../ScopeReviewComment";
import type { ScopeReviewParticipant } from "../ScopeReviewParticipant";
import type { ScopeReviewRedline } from "../ScopeReviewRedline";
import {
  addApproval,
  addComment,
  addRedline,
  createScopeReview,
} from "../ScopeReviewEngine";
import { buildScopeReviewWorkspace } from "../ScopeReviewWorkspaceOrchestrator";
import type { ScopeReviewWorkspace, ScopeReviewWorkspaceInput } from "../ScopeReviewWorkspace";

const createdAt = "2026-06-24T00:00:00.000Z";

const googleParticipants: ScopeReviewParticipant[] = [
  { participantId: "PART-GOOGLE-CUSTOMER", name: "Google Network Planner", role: "CUSTOMER", organization: "Google", canComment: true, canRedline: true, canApprove: true },
  { participantId: "PART-RYAN", name: "Ryan", role: "ACCOUNT_OWNER", organization: "Teralinx", canComment: true, canRedline: false, canApprove: false },
  { participantId: "PART-CRO", name: "Teralinx CRO", role: "CRO", organization: "Teralinx", canComment: true, canRedline: false, canApprove: true },
  { participantId: "PART-ENGINEER", name: "Route Engineer", role: "ENGINEER", organization: "Teralinx", canComment: true, canRedline: true, canApprove: false },
];

function baseReview(reviewId: string, scopeVersionId: string, customerId: string, opportunityId: string, participants = googleParticipants) {
  return createScopeReview({
    reviewId,
    scopeVersionId,
    customerId,
    opportunityId,
    corridorId: `CORRIDOR-${opportunityId}`,
    participants,
  });
}

function comment(
  commentId: string,
  reviewId: string,
  scopeVersionId: string,
  commentType: ScopeReviewComment["commentType"],
  body: string,
  resolved = false,
): ScopeReviewComment {
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

function redline(
  redlineId: string,
  reviewId: string,
  scopeVersionId: string,
  action: ScopeReviewRedline["action"],
  description: string,
): ScopeReviewRedline {
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

function approval(
  approvalId: string,
  reviewId: string,
  scopeVersionId: string,
  decision: ScopeReviewApproval["decision"],
  approverRole: ScopeReviewApproval["approverRole"] = "CUSTOMER",
): ScopeReviewApproval {
  return {
    approvalId,
    reviewId,
    scopeVersionId,
    decision,
    approverId: approverRole === "CRO" ? "PART-CRO" : "PART-GOOGLE-CUSTOMER",
    approverRole,
    comments: decision,
    createdAt,
    nonAuthoritative: true,
    mutatesLifecycle: false,
    mutatesAuthority: false,
  };
}

const googleTexasAiExpansionReview = addComment(
  baseReview("REVIEW-GOOGLE-TX-AI", "SV-GOOGLE-TX-AI-SEED", "CUST-GOOGLE", "OPP-GOOGLE-TX-AI"),
  comment("COMMENT-GOOGLE-TX-AI-001", "REVIEW-GOOGLE-TX-AI", "SV-GOOGLE-TX-AI-SEED", "GENERAL", "Review AI corridor baseline before Prism scoring."),
);

const googleRouteRevisionRequest = addApproval(
  addRedline(
    googleTexasAiExpansionReview,
    redline("REDLINE-GOOGLE-ROUTE-001", "REVIEW-GOOGLE-TX-AI", "SV-GOOGLE-TX-AI-SEED", "RELOCATE", "Propose relocating the future corridor around expansion parcel evidence."),
  ),
  approval("APPROVAL-GOOGLE-REVISION-001", "REVIEW-GOOGLE-TX-AI", "SV-GOOGLE-TX-AI-SEED", "REQUEST_REVISION"),
);

const googleDiversityRequest = addComment(
  baseReview("REVIEW-GOOGLE-DIVERSITY", "SV-GOOGLE-DIVERSITY-SEED", "CUST-GOOGLE", "OPP-GOOGLE-TX-AI"),
  comment("COMMENT-GOOGLE-DIVERSITY-001", "REVIEW-GOOGLE-DIVERSITY", "SV-GOOGLE-DIVERSITY-SEED", "RISK", "Customer requests additional diversity evidence before Prism.", false),
);

const metaCampusExpansion = addRedline(
  baseReview("REVIEW-META-CAMPUS", "SV-META-CAMPUS-SEED", "CUST-META", "OPP-META-AI-CORRIDOR"),
  redline("REDLINE-META-CAMPUS-001", "REVIEW-META-CAMPUS", "SV-META-CAMPUS-SEED", "ANNOTATE", "Annotate future campus expansion as review evidence."),
);

const oracleGpuExpansion = addComment(
  baseReview("REVIEW-ORACLE-GPU", "SV-ORACLE-GPU-SEED", "CUST-ORACLE", "OPP-ORACLE-GPU"),
  comment("COMMENT-ORACLE-GPU-001", "REVIEW-ORACLE-GPU", "SV-ORACLE-GPU-SEED", "FACILITY", "GPU expansion assumptions require power evidence review.", true),
);

const carrierLongHaulReview = addComment(
  baseReview("REVIEW-CARRIER-LONGHAUL", "SV-CARRIER-LONGHAUL-SEED", "CUST-CARRIER", "OPP-CARRIER-LONGHAUL"),
  comment("COMMENT-CARRIER-LH-001", "REVIEW-CARRIER-LONGHAUL", "SV-CARRIER-LONGHAUL-SEED", "ROUTE", "Carrier supplied route remains seed evidence for Prism.", true),
);

const revisionRequestedExample = addApproval(
  baseReview("REVIEW-REVISION-REQUESTED", "SV-REVISION-REQUESTED", "CUST-GOOGLE", "OPP-REVISION-REQUESTED"),
  approval("APPROVAL-REVISION-REQUESTED", "REVIEW-REVISION-REQUESTED", "SV-REVISION-REQUESTED", "REQUEST_REVISION"),
);

const blockedExample = baseReview("REVIEW-BLOCKED", "", "CUST-GOOGLE", "OPP-BLOCKED");

const readyForPrismExample = addApproval(
  addComment(
    baseReview("REVIEW-READY-FOR-PRISM", "SV-READY-FOR-PRISM", "CUST-GOOGLE", "OPP-GOOGLE-TX-AI"),
    comment("COMMENT-READY-PRISM-001", "REVIEW-READY-FOR-PRISM", "SV-READY-FOR-PRISM", "TECHNICAL", "Customer and CRO confirm review assumptions.", true),
  ),
  approval("APPROVAL-READY-PRISM-001", "REVIEW-READY-FOR-PRISM", "SV-READY-FOR-PRISM", "APPROVE_WITH_COMMENTS", "CRO"),
);

export const scopeReviewWorkspaceFixtureInputs: readonly ScopeReviewWorkspaceInput[] = Object.freeze([
  {
    review: googleTexasAiExpansionReview,
    baselineNetworkCandidate: googleTexasAiTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: googleRouteRevisionRequest,
    baselineNetworkCandidate: googleTexasAiTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: googleDiversityRequest,
    baselineNetworkCandidate: googleTexasAiTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: metaCampusExpansion,
    baselineNetworkCandidate: metaAiCorridorTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: oracleGpuExpansion,
    baselineNetworkCandidate: oracleGpuExpansionTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: carrierLongHaulReview,
    baselineNetworkCandidate: carrierLongHaulTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: revisionRequestedExample,
    baselineNetworkCandidate: googleTexasAiTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
  {
    review: blockedExample,
    baselineNetworkCandidate: undefined,
    evaluatedAt: createdAt,
  },
  {
    review: readyForPrismExample,
    baselineNetworkCandidate: googleTexasAiTranslateWorkspace.baselineNetworkCandidate,
    evaluatedAt: createdAt,
  },
]);

export const scopeReviewWorkspaceFixtures: readonly ScopeReviewWorkspace[] = Object.freeze(
  scopeReviewWorkspaceFixtureInputs.map(buildScopeReviewWorkspace),
);

export const googleTexasAiExpansionReviewWorkspace = scopeReviewWorkspaceFixtures[0];
export const googleRouteRevisionRequestWorkspace = scopeReviewWorkspaceFixtures[1];
export const googleDiversityRequestWorkspace = scopeReviewWorkspaceFixtures[2];
export const metaCampusExpansionReviewWorkspace = scopeReviewWorkspaceFixtures[3];
export const oracleGpuExpansionReviewWorkspace = scopeReviewWorkspaceFixtures[4];
export const carrierLongHaulReviewWorkspace = scopeReviewWorkspaceFixtures[5];
export const revisionRequestedReviewWorkspace = scopeReviewWorkspaceFixtures[6];
export const blockedReviewWorkspace = scopeReviewWorkspaceFixtures[7];
export const readyForPrismReviewWorkspace = scopeReviewWorkspaceFixtures[8];

export function evaluateScopeReviewWorkspaceFixtures(): readonly ScopeReviewWorkspace[] {
  return scopeReviewWorkspaceFixtures;
}
