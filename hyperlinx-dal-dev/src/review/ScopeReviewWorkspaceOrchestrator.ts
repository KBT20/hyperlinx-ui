import type { ScopeReviewStatus } from "./ScopeReview";
import { evaluateReviewStatus } from "./ScopeReviewEngine";
import type {
  ScopeReviewWorkspace,
  ScopeReviewWorkspaceBlocker,
  ScopeReviewWorkspaceDiagnostic,
  ScopeReviewWorkspaceInput,
  ScopeReviewWorkspaceSection,
} from "./ScopeReviewWorkspace";
import { summarizeReviewForWorkspace } from "./ScopeReviewWorkspaceSummary";
import {
  createScopeReviewWorkspaceNextAction,
  type ScopeReviewWorkspaceNextAction,
  type ScopeReviewWorkspaceNextActionType,
  type ScopeReviewWorkspaceStatus,
} from "./ScopeReviewWorkspaceStatus";

const WORKSPACE_SECTIONS: ScopeReviewWorkspaceSection[] = [
  "REVIEW_SUMMARY",
  "PARTICIPANTS",
  "BASELINE_NETWORK_SUMMARY",
  "COMMENTS",
  "REDLINES",
  "APPROVALS",
  "REVIEW_STATUS",
  "NEXT_ACTION",
  "DIAGNOSTICS",
];

function now(value?: string): string {
  return value ?? new Date().toISOString();
}

function blocker(input: Omit<ScopeReviewWorkspaceBlocker, "blockerId"> & { reviewId: string }): ScopeReviewWorkspaceBlocker {
  const entry: ScopeReviewWorkspaceBlocker = {
    blockerId: `SCOPE-REVIEW-BLOCKER-${input.reviewId}-${input.field}`.replace(/[^A-Z0-9-]+/gi, "-").toUpperCase(),
    field: input.field,
    severity: input.severity,
    message: input.message,
    blocksPrism: input.blocksPrism,
  };
  console.info("[REVIEW_BLOCKED]", entry);
  return entry;
}

function diagnostic(
  code: ScopeReviewWorkspaceDiagnostic["code"],
  severity: ScopeReviewWorkspaceDiagnostic["severity"],
  message: string,
  input: ScopeReviewWorkspaceInput,
  details?: Record<string, unknown>,
): ScopeReviewWorkspaceDiagnostic {
  const entry: ScopeReviewWorkspaceDiagnostic = {
    code,
    severity,
    reviewId: input.review.reviewId,
    scopeVersionId: input.review.scopeVersionId,
    message,
    timestamp: now(input.evaluatedAt),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

export function identifyReviewBlockers(input: ScopeReviewWorkspaceInput): ScopeReviewWorkspaceBlocker[] {
  const blockers: ScopeReviewWorkspaceBlocker[] = [];
  const review = input.review;
  const add = (field: string, message: string, severity: ScopeReviewWorkspaceBlocker["severity"] = "ERROR", blocksPrism = true) =>
    blockers.push(blocker({ reviewId: review.reviewId, field, message, severity, blocksPrism }));

  if (!review.reviewId) add("reviewId", "Review ID is required.", "CRITICAL");
  if (!review.customerId) add("customerId", "Customer ID is required.", "CRITICAL");
  if (!review.opportunityId) add("opportunityId", "Opportunity ID is required.", "CRITICAL");
  if (!review.scopeVersionId) add("scopeVersionId", "ScopeVersion ID is required.", "CRITICAL");
  if (!input.baselineNetworkCandidate) add("baselineNetworkCandidate", "Baseline Network Candidate is required.");
  if (input.baselineNetworkCandidate?.status === "BLOCKED") {
    input.baselineNetworkCandidate.blockers.forEach((item) => add(`baseline.${item}`, `Baseline blocker: ${item}`));
  }
  if (!review.participants.length) add("participants", "At least one participant is required.", "WARNING", false);
  if (!review.participants.some((participant) => participant.canApprove)) add("approver", "At least one participant with approval capability is required.");
  if (review.status === "REVISION_REQUESTED") add("revision", "Revision has been requested.");
  if (review.status === "BLOCKED") add("status", "Review is blocked.", "CRITICAL");
  review.comments
    .filter((comment) => comment.commentType === "ACTION_ITEM" && !comment.resolved)
    .forEach((comment) => add(`comment.${comment.commentId}`, `Unresolved action item: ${comment.commentId}`));

  const latestApproval = review.approvals.at(-1);
  if (latestApproval?.decision === "REJECT") add("approval", "Latest approval decision rejected the review.", "CRITICAL");

  return Array.from(new Map(blockers.map((item) => [item.blockerId, item])).values());
}

export function evaluateReviewWorkspaceStatus(input: ScopeReviewWorkspaceInput): ScopeReviewWorkspaceStatus {
  const evaluated = evaluateReviewStatus(input.review);
  const blockers = identifyReviewBlockers({ ...input, review: { ...input.review, status: evaluated } });
  if (blockers.some((item) => item.severity === "CRITICAL")) return "BLOCKED";
  if (blockers.some((item) => item.blocksPrism) && evaluated === "APPROVED_FOR_PRISM") return "BLOCKED";
  return evaluated;
}

function determineActionType(status: ScopeReviewWorkspaceStatus, input: ScopeReviewWorkspaceInput, blockers: readonly ScopeReviewWorkspaceBlocker[]): ScopeReviewWorkspaceNextActionType {
  if (blockers.some((item) => item.severity === "CRITICAL")) return "RESOLVE_BLOCKERS";
  if (status === "APPROVED_FOR_PRISM" && !blockers.some((item) => item.blocksPrism)) return "OPEN_PRISM";
  if (status === "REVISION_REQUESTED") return "ADD_REDLINE";
  if (input.review.redlines.length && !input.review.approvals.length) return "REQUEST_REVISION";
  if (input.review.comments.some((comment) => comment.commentType === "ACTION_ITEM" && !comment.resolved)) return "ADD_COMMENT";
  if (input.review.comments.length || input.review.redlines.length) return "APPROVE_REVIEW";
  return "ADD_COMMENT";
}

export function determineNextAction(input: ScopeReviewWorkspaceInput): ScopeReviewWorkspaceNextAction {
  const status = evaluateReviewWorkspaceStatus(input);
  const blockers = identifyReviewBlockers(input);
  const actionType = determineActionType(status, input, blockers);
  const reasons: Record<ScopeReviewWorkspaceNextActionType, string> = {
    ADD_COMMENT: "Add or resolve review comments before approval.",
    ADD_REDLINE: "Add redline details for the requested revision.",
    REQUEST_REVISION: "Request revision for proposed redlines.",
    APPROVE_REVIEW: "Approve review when collaboration is complete.",
    OPEN_PRISM: "Review is approved for Prism.",
    RESOLVE_BLOCKERS: blockers[0]?.message ?? "Resolve blockers before continuing.",
  };
  return createScopeReviewWorkspaceNextAction(input.review.reviewId, actionType, reasons[actionType], blockers.length);
}

export function buildReviewSummary(input: ScopeReviewWorkspaceInput) {
  const blockers = identifyReviewBlockers(input);
  const nextAction = determineNextAction(input);
  return summarizeReviewForWorkspace(input.review, input.baselineNetworkCandidate, nextAction, blockers.map((item) => item.message));
}

export function generateReviewDiagnostics(input: ScopeReviewWorkspaceInput): ScopeReviewWorkspaceDiagnostic[] {
  const review = input.review;
  const diagnostics: ScopeReviewWorkspaceDiagnostic[] = [
    diagnostic("SCOPE_REVIEW_WORKSPACE_CREATED", "INFO", "Scope Review Workspace created.", input, {
      status: review.status,
    }),
    ...review.comments.map((comment) =>
      diagnostic("COMMENT_REGISTERED", "INFO", "Review comment registered.", input, {
        commentId: comment.commentId,
        commentType: comment.commentType,
      }),
    ),
    ...review.redlines.map((redline) =>
      diagnostic("REDLINE_REGISTERED", "WARNING", "Review redline proposal registered.", input, {
        redlineId: redline.redlineId,
        action: redline.action,
      }),
    ),
    ...review.approvals.map((approval) =>
      diagnostic("APPROVAL_REGISTERED", approval.decision === "REJECT" ? "ERROR" : "INFO", "Review approval decision registered.", input, {
        approvalId: approval.approvalId,
        decision: approval.decision,
      }),
    ),
  ];

  const status = evaluateReviewWorkspaceStatus(input);
  if (status === "REVISION_REQUESTED") diagnostics.push(diagnostic("REVISION_REQUESTED", "WARNING", "Revision requested.", input));
  if (status === "APPROVED_FOR_PRISM") diagnostics.push(diagnostic("READY_FOR_PRISM", "INFO", "Review is ready for Prism.", input));
  if (status === "BLOCKED") diagnostics.push(diagnostic("REVIEW_BLOCKED", "ERROR", "Review is blocked.", input));

  return diagnostics;
}

function baselineReadiness(input: ScopeReviewWorkspaceInput): "READY_FOR_SCOPE_REVIEW" | "BLOCKED" | "MISSING" {
  if (!input.baselineNetworkCandidate) return "MISSING";
  return input.baselineNetworkCandidate.status;
}

export function buildScopeReviewWorkspace(input: ScopeReviewWorkspaceInput): ScopeReviewWorkspace {
  const status = evaluateReviewWorkspaceStatus(input);
  const blockers = identifyReviewBlockers(input);
  const nextAction = determineNextAction(input);
  const summary = summarizeReviewForWorkspace(input.review, input.baselineNetworkCandidate, nextAction, blockers.map((item) => item.message));
  const latestApproval = input.review.approvals.at(-1);

  return {
    workspaceId: "SCOPE_REVIEW_WORKSPACE",
    title: `Scope Review: ${input.review.reviewId}`,
    review: { ...input.review, status: status as ScopeReviewStatus },
    baselineNetworkCandidate: input.baselineNetworkCandidate,
    status,
    sections: WORKSPACE_SECTIONS,
    summary,
    blockers,
    diagnostics: generateReviewDiagnostics(input),
    nextAction,
    cards: {
      reviewSummary: {
        modelId: "REVIEW_SUMMARY_CARD",
        reviewId: input.review.reviewId,
        status,
        participantCount: input.review.participants.length,
        readyForPrism: status === "APPROVED_FOR_PRISM" && !blockers.some((item) => item.blocksPrism),
      },
      participants: {
        modelId: "PARTICIPANT_PANEL",
        participantCount: input.review.participants.length,
        canApproveCount: input.review.participants.filter((participant) => participant.canApprove).length,
        canRedlineCount: input.review.participants.filter((participant) => participant.canRedline).length,
        canCommentCount: input.review.participants.filter((participant) => participant.canComment).length,
      },
      baselineNetwork: {
        modelId: "SCOPE_REVIEW_BASELINE_NETWORK_CARD",
        candidateId: input.baselineNetworkCandidate?.candidateId,
        referenceArchitecture: input.baselineNetworkCandidate?.referenceArchitecture,
        candidateObjectCount: input.baselineNetworkCandidate?.candidateObjects.length ?? 0,
        readiness: baselineReadiness(input),
        blockers: input.baselineNetworkCandidate?.blockers ?? (input.baselineNetworkCandidate ? [] : ["Baseline Network Candidate is missing."]),
      },
      comments: {
        modelId: "SCOPE_REVIEW_COMMENT_PANEL",
        commentCount: input.review.comments.length,
        unresolvedCount: input.review.comments.filter((comment) => !comment.resolved).length,
        actionItemCount: input.review.comments.filter((comment) => comment.commentType === "ACTION_ITEM").length,
      },
      redlines: {
        modelId: "SCOPE_REVIEW_REDLINE_PANEL",
        redlineCount: input.review.redlines.length,
        proposalsOnly: true,
        mutatesGeometry: false,
      },
      approvals: {
        modelId: "SCOPE_REVIEW_APPROVAL_PANEL",
        approvalCount: input.review.approvals.length,
        latestDecision: latestApproval?.decision,
        approvalsAreNonAuthoritative: true,
      },
      readiness: {
        modelId: "SCOPE_REVIEW_WORKSPACE_READINESS_CARD",
        status: status === "APPROVED_FOR_PRISM" && !blockers.some((item) => item.blocksPrism) ? "APPROVED_FOR_PRISM" : "BLOCKED",
        nextWorkspace: status === "APPROVED_FOR_PRISM" && !blockers.some((item) => item.blocksPrism) ? "Prism" : undefined,
        blockers: blockers.map((item) => item.message),
      },
      nextAction: {
        modelId: "SCOPE_REVIEW_NEXT_ACTION_PANEL",
        nextAction,
      },
    },
    scopeVersionRemainsTruth: true,
    noPersistence: true,
    noServerRoutes: true,
    noReactImplementation: true,
    noGeometryMutation: true,
    noScopeVersionMutation: true,
  };
}
