import type {
  ScopeVersionCloseActorRole,
  ScopeVersionCloseEvent,
} from "../scopeversion/ScopeVersionCloseAuthority";
import type {
  ScopeVersionLifecycleAudit,
  ScopeVersionState,
  ScopeVersionTransitionResult,
} from "../scopeversion/ScopeVersionLifecycle";
import type {
  CompletionBlocker,
  CompletionDiagnostic,
  CompletionReadinessInput,
  CompletionRequirement,
  CompletionStatus,
} from "./CompletionRequirement";
import { COMPLETION_REQUIREMENTS } from "./CompletionRequirement";

export interface CompletionAuthority {
  authorityId: string;
  requiredLifecycleState: "FIELD_ACTIVE";
  reviewState: "COMPLETION_REVIEW";
  completedState: "COMPLETE";
  scopeVersionCloseType: "COMPLETION_CLOSE";
  authorizedRoles: readonly ScopeVersionCloseActorRole[];
  requirements: readonly CompletionRequirement[];
  notes: string;
}

export interface CompletionValidation {
  scopeVersionId?: string;
  valid: boolean;
  status: CompletionStatus;
  blockers: CompletionBlocker[];
  closedWorkPackageIds: string[];
  closedObjectIds: string[];
  closedStationIds: string[];
  closedSegmentIds: string[];
  closedDeliverableIds: string[];
  validatedFieldCloseIds: string[];
  diagnostics: CompletionDiagnostic[];
}

export interface CompletionAudit {
  auditId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  status: CompletionStatus;
  closeId?: string;
  blockerIds: string[];
  validatedFieldCloseIds: string[];
  lifecycleTransitionIds: string[];
  timestamp: string;
  diagnostics: CompletionDiagnostic[];
}

export interface CompletionResult {
  scopeVersionId?: string;
  status: CompletionStatus;
  validation: CompletionValidation;
  completionCloseDraft?: ScopeVersionCloseEvent;
  completionClose?: ScopeVersionCloseEvent;
  completionReviewTransition?: ScopeVersionTransitionResult;
  completionTransition?: ScopeVersionTransitionResult;
  lifecycleAudits: ScopeVersionLifecycleAudit[];
  audit: CompletionAudit;
  diagnostics: CompletionDiagnostic[];
}

export interface CompletionDraftInput extends CompletionReadinessInput {
  validation: CompletionValidation;
  createdAt?: string;
}

export const COMPLETION_AUTHORITY: CompletionAuthority = Object.freeze({
  authorityId: "AUTH-COMPLETION-AUTHORITY",
  requiredLifecycleState: "FIELD_ACTIVE",
  reviewState: "COMPLETION_REVIEW",
  completedState: "COMPLETE",
  scopeVersionCloseType: "COMPLETION_CLOSE",
  authorizedRoles: ["TERALINX_OPERATIONS", "FIELD_OPERATOR", "SYSTEM"] satisfies readonly ScopeVersionCloseActorRole[],
  requirements: COMPLETION_REQUIREMENTS,
  notes:
    "Completion Authority validates Field close evidence and creates COMPLETION_CLOSE. It does not activate operations, billing, revenue, or monitoring.",
});

export function statusFromBlockers(blockers: readonly CompletionBlocker[]): CompletionStatus {
  if (blockers.some((blocker) => blocker.severity === "CRITICAL" || blocker.severity === "HIGH")) return "NOT_READY";
  if (blockers.length) return "REVIEW_REQUIRED";
  return "READY_FOR_COMPLETION";
}

export function isCompletionLifecycleState(state: ScopeVersionState): state is "FIELD_ACTIVE" | "COMPLETION_REVIEW" | "COMPLETE" {
  return state === "FIELD_ACTIVE" || state === "COMPLETION_REVIEW" || state === "COMPLETE";
}
