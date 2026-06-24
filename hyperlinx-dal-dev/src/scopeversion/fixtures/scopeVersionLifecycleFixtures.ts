import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent, ScopeVersionCloseType } from "../ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../ScopeVersionCloseAuthorityEngine";
import type { ScopeVersionLifecycleAudit, ScopeVersionState, ScopeVersionTransitionResult } from "../ScopeVersionLifecycle";
import {
  createTransitionAudit,
  evaluateTransition,
  getAllowedTransitions,
  getRequiredCloses,
} from "../ScopeVersionTransitionAuthorityEngine";

const trace = {
  scopeVersionId: "SV-DAL-HYPERSCALER-LIFECYCLE",
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-HYPERSCALER-LIFECYCLE",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

function close(input: {
  closeId: string;
  closeType: ScopeVersionCloseType;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  previousState: ScopeVersionState;
  resultingState: ScopeVersionState;
  evidenceIds?: string[];
}): ScopeVersionCloseEvent {
  const draft = createScopeVersionCloseDraft({
    ...trace,
    closeId: input.closeId,
    closeType: input.closeType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: input.evidenceIds ?? [`EV-${input.closeId}`],
    inputReferences: [
      {
        referenceId: trace.scopeVersionId,
        referenceType: "ScopeVersion",
        source: "LifecycleFixture",
        immutable: true,
      },
    ],
    constraintReferences: [
      {
        referenceId: `CONSTRAINT-${input.closeId}`,
        referenceType: "LifecycleConstraint",
        source: "LifecycleFixture",
        immutable: true,
      },
    ],
    createdAt: "2026-06-24T00:00:00.000Z",
    outcome: {
      status: "ACCEPTED",
      previousState: input.previousState,
      resultingState: input.resultingState,
    },
  });
  const validation = validateScopeVersionClose(draft);
  return { ...draft, validatedAt: validation.validatedAt, immutable: validation.valid };
}

export const lifecycleCloseEvidenceFixtures: readonly ScopeVersionCloseEvent[] = Object.freeze([
  close({
    closeId: "LIFE-CLOSE-ENGINEERING",
    closeType: "ENGINEERING_CLOSE",
    actorId: "engineer-001",
    actorRole: "TERALINX_ENGINEERING",
    previousState: "ENGINEERING_REVIEW",
    resultingState: "ENGINEERING_APPROVED",
  }),
  close({
    closeId: "LIFE-CLOSE-COMMERCIAL",
    closeType: "COMMERCIAL_CLOSE",
    actorId: "marketplace-001",
    actorRole: "TERALINX_MARKETPLACE",
    previousState: "COMMERCIAL_REVIEW",
    resultingState: "BUDGET_CANDIDATE",
  }),
  close({
    closeId: "LIFE-CLOSE-BUDGET",
    closeType: "BUDGET_CLOSE",
    actorId: "finance-001",
    actorRole: "FINANCE",
    previousState: "BUDGET_CANDIDATE",
    resultingState: "BUDGET_LOCKED",
  }),
  close({
    closeId: "LIFE-CLOSE-VENDOR-ACCEPTANCE",
    closeType: "VENDOR_ACCEPTANCE_CLOSE",
    actorId: "vendor-001",
    actorRole: "VENDOR",
    previousState: "VENDOR_REVIEW",
    resultingState: "VENDOR_ACCEPTED",
  }),
  close({
    closeId: "LIFE-CLOSE-CUSTOMER-ACCEPTANCE",
    closeType: "CUSTOMER_ACCEPTANCE_CLOSE",
    actorId: "customer-001",
    actorRole: "CUSTOMER",
    previousState: "CUSTOMER_REVIEW",
    resultingState: "CUSTOMER_ACCEPTED",
  }),
  close({
    closeId: "LIFE-CLOSE-CONTRACT",
    closeType: "CONTRACT_CLOSE",
    actorId: "legal-001",
    actorRole: "LEGAL",
    previousState: "CONTRACT_REVIEW",
    resultingState: "CONTRACT_EXECUTED",
  }),
  close({
    closeId: "LIFE-CLOSE-CONTROL",
    closeType: "CONTROL_CLOSE",
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    previousState: "CONTROL_READY",
    resultingState: "CONTROL_ACTIVE",
  }),
  close({
    closeId: "LIFE-CLOSE-FIELD",
    closeType: "FIELD_CLOSE",
    actorId: "field-001",
    actorRole: "FIELD_OPERATOR",
    previousState: "FIELD_READY",
    resultingState: "FIELD_ACTIVE",
  }),
  close({
    closeId: "LIFE-CLOSE-COMPLETION",
    closeType: "COMPLETION_CLOSE",
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    previousState: "COMPLETION_REVIEW",
    resultingState: "COMPLETE",
  }),
  close({
    closeId: "LIFE-CLOSE-OPERATIONS",
    closeType: "OPERATIONS_CLOSE",
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    previousState: "COMPLETE",
    resultingState: "OPERATIONS",
  }),
  close({
    closeId: "LIFE-CLOSE-DESIGN-SUPERSEDE",
    closeType: "DESIGN_CLOSE",
    actorId: "engineer-001",
    actorRole: "TERALINX_ENGINEERING",
    previousState: "ENGINEERING_APPROVED",
    resultingState: "SUPERSEDED",
  }),
  close({
    closeId: "LIFE-CLOSE-CANCEL",
    closeType: "COMMERCIAL_CLOSE",
    actorId: "sales-001",
    actorRole: "TERALINX_SALES",
    previousState: "INTENT",
    resultingState: "CANCELLED",
  }),
]);

function transition(input: {
  previousState: ScopeVersionState;
  requestedState: ScopeVersionState;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  closes?: readonly ScopeVersionCloseEvent[];
}): ScopeVersionTransitionResult {
  return evaluateTransition({
    scopeVersionId: trace.scopeVersionId,
    previousState: input.previousState,
    requestedState: input.requestedState,
    actorId: input.actorId,
    actorRole: input.actorRole,
    closes: input.closes ?? lifecycleCloseEvidenceFixtures,
  });
}

export const lifecycleTransitionFixtures: readonly ScopeVersionTransitionResult[] = Object.freeze([
  transition({ previousState: "INTENT", requestedState: "DESIGN", actorId: "engineer-001", actorRole: "TERALINX_ENGINEERING" }),
  transition({ previousState: "DESIGN", requestedState: "ENGINEERING_REVIEW", actorId: "engineer-001", actorRole: "TERALINX_ENGINEERING" }),
  transition({ previousState: "ENGINEERING_REVIEW", requestedState: "ENGINEERING_APPROVED", actorId: "engineer-001", actorRole: "TERALINX_ENGINEERING" }),
  transition({ previousState: "ENGINEERING_APPROVED", requestedState: "COMMERCIAL_REVIEW", actorId: "marketplace-001", actorRole: "TERALINX_MARKETPLACE" }),
  transition({ previousState: "COMMERCIAL_REVIEW", requestedState: "BUDGET_CANDIDATE", actorId: "marketplace-001", actorRole: "TERALINX_MARKETPLACE" }),
  transition({ previousState: "BUDGET_CANDIDATE", requestedState: "BUDGET_LOCKED", actorId: "finance-001", actorRole: "FINANCE" }),
  transition({ previousState: "BUDGET_LOCKED", requestedState: "VENDOR_REVIEW", actorId: "marketplace-001", actorRole: "TERALINX_MARKETPLACE" }),
  transition({ previousState: "VENDOR_REVIEW", requestedState: "VENDOR_ACCEPTED", actorId: "vendor-001", actorRole: "VENDOR" }),
  transition({ previousState: "VENDOR_ACCEPTED", requestedState: "CUSTOMER_REVIEW", actorId: "sales-001", actorRole: "TERALINX_SALES" }),
  transition({ previousState: "CUSTOMER_REVIEW", requestedState: "CUSTOMER_ACCEPTED", actorId: "customer-001", actorRole: "CUSTOMER" }),
  transition({ previousState: "CUSTOMER_ACCEPTED", requestedState: "CONTRACT_REVIEW", actorId: "legal-001", actorRole: "LEGAL" }),
  transition({ previousState: "CONTRACT_REVIEW", requestedState: "CONTRACT_EXECUTED", actorId: "legal-001", actorRole: "LEGAL" }),
  transition({ previousState: "CONTRACT_EXECUTED", requestedState: "CONTROL_READY", actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" }),
  transition({ previousState: "CONTROL_READY", requestedState: "CONTROL_ACTIVE", actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" }),
  transition({ previousState: "CONTROL_ACTIVE", requestedState: "FIELD_READY", actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" }),
  transition({ previousState: "FIELD_READY", requestedState: "FIELD_ACTIVE", actorId: "field-001", actorRole: "FIELD_OPERATOR" }),
  transition({ previousState: "FIELD_ACTIVE", requestedState: "COMPLETION_REVIEW", actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" }),
  transition({ previousState: "COMPLETION_REVIEW", requestedState: "COMPLETE", actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" }),
  transition({ previousState: "COMPLETE", requestedState: "OPERATIONS", actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" }),
  transition({
    previousState: "BUDGET_CANDIDATE",
    requestedState: "BUDGET_LOCKED",
    actorId: "finance-001",
    actorRole: "FINANCE",
    closes: lifecycleCloseEvidenceFixtures.filter((closeEvent) => closeEvent.closeType !== "BUDGET_CLOSE"),
  }),
  transition({ previousState: "ENGINEERING_REVIEW", requestedState: "ENGINEERING_APPROVED", actorId: "ai-001", actorRole: "AI_ASSISTANT_ADVISORY" }),
  transition({ previousState: "ENGINEERING_APPROVED", requestedState: "SUPERSEDED", actorId: "engineer-001", actorRole: "TERALINX_ENGINEERING" }),
  transition({ previousState: "INTENT", requestedState: "CANCELLED", actorId: "sales-001", actorRole: "TERALINX_SALES" }),
]);

export const lifecycleAuditFixtures: readonly ScopeVersionLifecycleAudit[] = Object.freeze(
  lifecycleTransitionFixtures.map(createTransitionAudit),
);

export function evaluateScopeVersionLifecycleFixtures() {
  return {
    transitionCount: lifecycleTransitionFixtures.length,
    approvedTransitionCount: lifecycleTransitionFixtures.filter((result) => result.approved).length,
    rejectedTransitionCount: lifecycleTransitionFixtures.filter((result) => !result.approved).length,
    auditCount: lifecycleAuditFixtures.length,
    engineeringAllowedTransitions: getAllowedTransitions("ENGINEERING_REVIEW", "TERALINX_ENGINEERING"),
    aiAllowedTransitions: getAllowedTransitions("ENGINEERING_REVIEW", "AI_ASSISTANT_ADVISORY"),
    budgetLockedRequiredCloses: getRequiredCloses("BUDGET_LOCKED"),
    rejectedTransitions: lifecycleTransitionFixtures
      .filter((result) => !result.approved)
      .map((result) => ({
        transitionId: result.transitionId,
        missingCloseTypes: result.missingCloseTypes,
        diagnostics: result.diagnostics.map((diagnostic) => diagnostic.message),
      })),
  };
}

