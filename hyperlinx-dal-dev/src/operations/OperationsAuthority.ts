import type {
  ScopeVersionCloseActorRole,
  ScopeVersionCloseEvent,
} from "../scopeversion/ScopeVersionCloseAuthority";
import type {
  ScopeVersionLifecycleAudit,
  ScopeVersionState,
  ScopeVersionTransitionResult,
} from "../scopeversion/ScopeVersionLifecycle";
import {
  OPERATIONS_REQUIREMENTS,
  type OperationsBlocker,
  type OperationsDiagnostic,
  type OperationsReadiness,
  type OperationsReadinessInput,
  type OperationsRequirement,
  type OperationsStatus,
} from "./OperationsReadiness";

export interface OperationsAuthority {
  authorityId: string;
  requiredLifecycleState: "COMPLETE";
  operationalState: "OPERATIONS";
  scopeVersionCloseType: "OPERATIONS_CLOSE";
  authorizedRoles: readonly ScopeVersionCloseActorRole[];
  requirements: readonly OperationsRequirement[];
  notes: string;
}

export interface OperationsAudit {
  auditId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  status: OperationsStatus;
  closeId?: string;
  blockerIds: string[];
  validatedCompletionCloseIds: string[];
  lifecycleTransitionIds: string[];
  timestamp: string;
  diagnostics: OperationsDiagnostic[];
}

export interface OperationsResult {
  scopeVersionId?: string;
  status: OperationsStatus;
  readiness: OperationsReadiness;
  operationsCloseDraft?: ScopeVersionCloseEvent;
  operationsClose?: ScopeVersionCloseEvent;
  operationsTransition?: ScopeVersionTransitionResult;
  lifecycleAudits: ScopeVersionLifecycleAudit[];
  audit: OperationsAudit;
  diagnostics: OperationsDiagnostic[];
}

export interface OperationsDraftInput extends OperationsReadinessInput {
  readiness: OperationsReadiness;
  createdAt?: string;
}

export const OPERATIONS_AUTHORITY: OperationsAuthority = Object.freeze({
  authorityId: "AUTH-OPERATIONS-AUTHORITY",
  requiredLifecycleState: "COMPLETE",
  operationalState: "OPERATIONS",
  scopeVersionCloseType: "OPERATIONS_CLOSE",
  authorizedRoles: ["TERALINX_OPERATIONS", "SYSTEM"] satisfies readonly ScopeVersionCloseActorRole[],
  requirements: OPERATIONS_REQUIREMENTS,
  notes:
    "Operations Authority validates operational readiness and creates OPERATIONS_CLOSE. It does not activate billing, revenue, telemetry, monitoring, ticketing, OSS/BSS, or production service.",
});

export function operationsStatusFromBlockers(blockers: readonly OperationsBlocker[]): OperationsStatus {
  if (blockers.some((blocker) => blocker.severity === "CRITICAL" || blocker.severity === "HIGH")) return "NOT_READY";
  if (blockers.length) return "REVIEW_REQUIRED";
  return "READY_FOR_OPERATIONS";
}

export function isOperationsLifecycleState(state: ScopeVersionState): state is "COMPLETE" | "OPERATIONS" {
  return state === "COMPLETE" || state === "OPERATIONS";
}
