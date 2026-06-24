import type { ScopeReview, ScopeReviewDiagnostic, ScopeReviewStatus, ScopeReviewViewModel } from "./ScopeReview";
import type { ScopeReviewApproval } from "./ScopeReviewApproval";
import type { ScopeReviewComment } from "./ScopeReviewComment";
import type { ScopeReviewParticipant } from "./ScopeReviewParticipant";
import type { ScopeReviewRedline } from "./ScopeReviewRedline";

export interface CreateScopeReviewInput {
  reviewId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId?: string;
  participants?: ScopeReviewParticipant[];
}

export function createScopeReview(input: CreateScopeReviewInput): ScopeReview {
  const timestamp = new Date().toISOString();
  const review: ScopeReview = {
    reviewId: input.reviewId,
    scopeVersionId: input.scopeVersionId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    status: "DRAFT",
    participants: input.participants ?? [],
    comments: [],
    redlines: [],
    approvals: [],
    diagnostics: [],
    traceability: {
      customerId: input.customerId,
      opportunityId: input.opportunityId,
      corridorId: input.corridorId,
      scopeVersionId: input.scopeVersionId,
      reviewId: input.reviewId,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    scopeVersionRemainsTruth: true,
    nonAuthoritative: true,
  };
  return {
    ...review,
    diagnostics: [diagnostic("SCOPE_REVIEW_CREATED", "INFO", "Scope Review created.", review)],
  };
}

export function addComment(review: ScopeReview, comment: ScopeReviewComment): ScopeReview {
  const next = {
    ...review,
    comments: [...review.comments, { ...comment, nonAuthoritative: true as const }],
    updatedAt: new Date().toISOString(),
  };
  return withStatusAndDiagnostic(next, diagnostic("COMMENT_ADDED", "INFO", "Review comment added.", next, { commentId: comment.commentId }));
}

export function addRedline(review: ScopeReview, redline: ScopeReviewRedline): ScopeReview {
  const next = {
    ...review,
    redlines: [
      ...review.redlines,
      {
        ...redline,
        nonAuthoritative: true as const,
        mutatesGeometry: false as const,
        mutatesScopeVersion: false as const,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  return withStatusAndDiagnostic(next, diagnostic("REDLINE_ADDED", "WARNING", "Review redline proposal added.", next, { redlineId: redline.redlineId }));
}

export function addApproval(review: ScopeReview, approval: ScopeReviewApproval): ScopeReview {
  const next = {
    ...review,
    approvals: [
      ...review.approvals,
      {
        ...approval,
        nonAuthoritative: true as const,
        mutatesLifecycle: false as const,
        mutatesAuthority: false as const,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  const code = approval.decision === "REQUEST_REVISION" ? "REVISION_REQUESTED" : "APPROVAL_ADDED";
  return withStatusAndDiagnostic(next, diagnostic(code, approval.decision === "REJECT" ? "ERROR" : "INFO", "Review approval decision added.", next, {
    approvalId: approval.approvalId,
    decision: approval.decision,
  }));
}

export function evaluateReviewStatus(review: ScopeReview): ScopeReviewStatus {
  if (!review.scopeVersionId || !review.customerId || !review.opportunityId) return "BLOCKED";
  const latestApproval = review.approvals.at(-1);
  if (latestApproval?.decision === "REJECT") return "BLOCKED";
  if (latestApproval?.decision === "REQUEST_REVISION") return "REVISION_REQUESTED";
  if (latestApproval?.decision === "APPROVE" || latestApproval?.decision === "APPROVE_WITH_COMMENTS") {
    const unresolvedActionItems = review.comments.filter((comment) => comment.commentType === "ACTION_ITEM" && !comment.resolved);
    return unresolvedActionItems.length ? "REVIEW_COMPLETE" : "APPROVED_FOR_PRISM";
  }
  if (review.comments.length || review.redlines.length || review.approvals.length) return "UNDER_REVIEW";
  return "DRAFT";
}

export function generateReviewDiagnostics(review: ScopeReview): ScopeReviewDiagnostic[] {
  const status = evaluateReviewStatus(review);
  const diagnostics: ScopeReviewDiagnostic[] = [];
  if (status === "REVISION_REQUESTED") {
    diagnostics.push(diagnostic("REVISION_REQUESTED", "WARNING", "Scope Review revision requested.", review));
  }
  if (status === "APPROVED_FOR_PRISM") {
    diagnostics.push(diagnostic("READY_FOR_PRISM", "INFO", "Scope Review is ready for Prism.", review));
  }
  return diagnostics;
}

export function createScopeReviewViewModel(review: ScopeReview): ScopeReviewViewModel {
  const status = evaluateReviewStatus(review);
  const blockers = reviewBlockers(review, status);
  return {
    workspace: {
      workspaceId: "SCOPE_REVIEW",
      title: "Scope Review",
      noPersistence: true,
      noLifecycleChanges: true,
      noAuthorityChanges: true,
      noScopeVersionCreation: true,
    },
    commentPanel: {
      commentCount: review.comments.length,
      unresolvedCount: review.comments.filter((comment) => !comment.resolved).length,
      supportedCommentTypes: ["GENERAL", "TECHNICAL", "COMMERCIAL", "ROUTE", "FACILITY", "RISK", "QUESTION", "ACTION_ITEM"],
    },
    redlinePanel: {
      redlineCount: review.redlines.length,
      supportedRedlineActions: ["ADD", "REMOVE", "MODIFIY", "MODIFY", "MOVE", "RELOCATE", "ANNOTATE"],
      proposalsOnly: true,
    },
    approvalPanel: {
      approvalCount: review.approvals.length,
      latestDecision: review.approvals.at(-1)?.decision,
      approvalsAreNonAuthoritative: true,
    },
    statusPanel: {
      status,
      readyForPrism: status === "APPROVED_FOR_PRISM",
      blockers,
    },
  };
}

function withStatusAndDiagnostic(review: ScopeReview, eventDiagnostic: ScopeReviewDiagnostic): ScopeReview {
  const status = evaluateReviewStatus(review);
  const statusDiagnostics = generateReviewDiagnostics({ ...review, status });
  return {
    ...review,
    status,
    diagnostics: [...review.diagnostics, eventDiagnostic, ...statusDiagnostics],
  };
}

function reviewBlockers(review: ScopeReview, status: ScopeReviewStatus) {
  const blockers: string[] = [];
  if (!review.scopeVersionId) blockers.push("scopeVersionId required");
  if (!review.customerId) blockers.push("customerId required");
  if (!review.opportunityId) blockers.push("opportunityId required");
  if (status === "REVISION_REQUESTED") blockers.push("revision requested");
  if (status === "BLOCKED") blockers.push("review blocked");
  review.comments
    .filter((comment) => comment.commentType === "ACTION_ITEM" && !comment.resolved)
    .forEach((comment) => blockers.push(`unresolved action item: ${comment.commentId}`));
  return blockers;
}

function diagnostic(
  code: ScopeReviewDiagnostic["code"],
  severity: ScopeReviewDiagnostic["severity"],
  message: string,
  review: ScopeReview,
  details?: Record<string, unknown>,
): ScopeReviewDiagnostic {
  console.info(`[${code}]`, {
    reviewId: review.reviewId,
    scopeVersionId: review.scopeVersionId,
    details,
  });
  return {
    code,
    severity,
    reviewId: review.reviewId,
    scopeVersionId: review.scopeVersionId,
    message,
    timestamp: new Date().toISOString(),
    details,
  };
}
