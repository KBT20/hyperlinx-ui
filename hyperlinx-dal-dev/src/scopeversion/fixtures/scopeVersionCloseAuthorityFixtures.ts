import type {
  ScopeVersionCloseAuditRecord,
  ScopeVersionCloseDraftInput,
  ScopeVersionCloseEvent,
  ScopeVersionCloseValidation,
} from "../ScopeVersionCloseAuthority";
import {
  createCloseAuditRecord,
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../ScopeVersionCloseAuthorityEngine";

const trace = {
  scopeVersionId: "SV-DAL-HYPERSCALER-LONG-HAUL",
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-HYPERSCALER-LONG-HAUL",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

const defaultInputReferences = [
  {
    referenceId: "SV-DAL-HYPERSCALER-LONG-HAUL",
    referenceType: "ScopeVersion",
    source: "RouteEngineering",
    immutable: true,
  },
];

const defaultConstraintReferences = [
  {
    referenceId: "CONSTRAINT-PACKAGE-HYPERSCALER-LONG-HAUL",
    referenceType: "ConstraintEvidencePackage",
    source: "RouteEngineering",
    immutable: true,
  },
];

function draft(input: ScopeVersionCloseDraftInput): ScopeVersionCloseEvent {
  return createScopeVersionCloseDraft({
    ...trace,
    evidenceIds: ["EV-SCOPEVERSION-CLOSE-AUTHORITY"],
    inputReferences: defaultInputReferences,
    constraintReferences: defaultConstraintReferences,
    createdAt: "2026-06-24T00:00:00.000Z",
    ...input,
  });
}

export const scopeVersionCloseDraftFixtures: readonly ScopeVersionCloseEvent[] = Object.freeze([
  draft({
    closeId: "SVCLOSE-ENGINEERING-HYPERSCALER-LONG-HAUL",
    closeType: "ENGINEERING_CLOSE",
    actorId: "engineer-001",
    actorRole: "TERALINX_ENGINEERING",
    evidenceIds: ["EV-ENGINEERING-APPROVAL-HYPERSCALER-LONG-HAUL"],
    outcome: { status: "ACCEPTED", previousState: "QUOTED", resultingState: "APPROVED" },
  }),
  draft({
    closeId: "SVCLOSE-BUDGET-HYPERSCALER-LONG-HAUL",
    closeType: "BUDGET_CLOSE",
    actorId: "finance-001",
    actorRole: "FINANCE",
    evidenceIds: ["BL-HYPERSCALER-LONG-HAUL"],
    inputReferences: [
      ...defaultInputReferences,
      { referenceId: "BL-HYPERSCALER-LONG-HAUL", referenceType: "BudgetLock", source: "Marketplace", immutable: true },
    ],
    outcome: { status: "ACCEPTED", previousState: "APPROVED", resultingState: "BUDGET_LOCKED" },
  }),
  draft({
    closeId: "SVCLOSE-VENDOR-ACCEPTANCE-HYPERSCALER-LONG-HAUL",
    closeType: "VENDOR_ACCEPTANCE_CLOSE",
    actorId: "vendor-fiberlight",
    actorRole: "VENDOR",
    evidenceIds: ["VR-HYPERSCALER-FBL"],
    outcome: { status: "ACCEPTED", previousState: "BUDGET_LOCKED", resultingState: "VENDOR_ACCEPTED" },
  }),
  draft({
    closeId: "SVCLOSE-CUSTOMER-ACCEPTANCE-HYPERSCALER-LONG-HAUL",
    closeType: "CUSTOMER_ACCEPTANCE_CLOSE",
    actorId: "customer-sponsor-001",
    actorRole: "CUSTOMER",
    evidenceIds: ["EV-CUSTOMER-ACCEPTANCE-001"],
    outcome: { status: "ACCEPTED", previousState: "VENDOR_ACCEPTED", resultingState: "CUSTOMER_ACCEPTED" },
  }),
  draft({
    closeId: "SVCLOSE-CONTRACT-HYPERSCALER-LONG-HAUL",
    closeType: "CONTRACT_CLOSE",
    actorId: "legal-001",
    actorRole: "LEGAL",
    evidenceIds: ["CONTRACT-HYPERSCALER-LONG-HAUL"],
    outcome: { status: "ACCEPTED", previousState: "CUSTOMER_ACCEPTED", resultingState: "CONTRACT_EXECUTED" },
  }),
  draft({
    closeId: "SVCLOSE-CONTROL-ACTIVATION-HYPERSCALER-LONG-HAUL",
    closeType: "CONTROL_CLOSE",
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    evidenceIds: ["CONTROL-WORK-ACTIVATION-001"],
    outcome: { status: "ACCEPTED", previousState: "CONTRACT_EXECUTED", resultingState: "CONTROL_ACTIVE" },
  }),
  draft({
    closeId: "SVCLOSE-FIELD-HYPERSCALER-LONG-HAUL",
    closeType: "FIELD_CLOSE",
    actorId: "field-operator-001",
    actorRole: "FIELD_OPERATOR",
    evidenceIds: ["FIELD-CLOSURE-STA-0100"],
    outcome: { status: "ACCEPTED", previousState: "CONTROL_ACTIVE", resultingState: "FIELD_PROGRESS" },
  }),
  draft({
    closeId: "SVCLOSE-AI-REJECTED-HYPERSCALER-LONG-HAUL",
    closeType: "ENGINEERING_CLOSE",
    actorId: "ai-assistant-001",
    actorRole: "AI_ASSISTANT_ADVISORY",
    evidenceIds: ["AI-RECOMMENDATION-001"],
    outcome: { status: "REJECTED", previousState: "QUOTED", resultingState: "QUOTED", notes: "AI advisory cannot validate close authority." },
  }),
  createScopeVersionCloseDraft({
    closeId: "SVCLOSE-MISSING-SCOPEVERSION",
    customerId: trace.customerId,
    opportunityId: trace.opportunityId,
    corridorId: trace.corridorId,
    closeType: "BUDGET_CLOSE",
    actorId: "finance-001",
    actorRole: "FINANCE",
    evidenceIds: ["BL-MISSING-SCOPEVERSION"],
    inputReferences: defaultInputReferences,
    constraintReferences: defaultConstraintReferences,
    createdAt: "2026-06-24T00:00:00.000Z",
    outcome: { status: "REJECTED", previousState: "APPROVED", resultingState: "APPROVED" },
  }),
  draft({
    closeId: "SVCLOSE-BUDGET-HYPERSCALER-LONG-HAUL-SUPERSEDING",
    closeType: "BUDGET_CLOSE",
    actorId: "finance-001",
    actorRole: "FINANCE",
    evidenceIds: ["BL-HYPERSCALER-LONG-HAUL-REV2"],
    supersedesCloseId: "SVCLOSE-BUDGET-HYPERSCALER-LONG-HAUL",
    inputReferences: [
      ...defaultInputReferences,
      { referenceId: "BL-HYPERSCALER-LONG-HAUL-REV2", referenceType: "BudgetLock", source: "Marketplace", immutable: true },
    ],
    outcome: {
      status: "SUPERSEDED",
      previousState: "BUDGET_LOCKED",
      resultingState: "BUDGET_LOCKED",
      supersedesCloseId: "SVCLOSE-BUDGET-HYPERSCALER-LONG-HAUL",
    },
  }),
]);

export const scopeVersionCloseValidationFixtures: readonly ScopeVersionCloseValidation[] = Object.freeze(
  scopeVersionCloseDraftFixtures.map(validateScopeVersionClose),
);

export const scopeVersionCloseAuditFixtures: readonly ScopeVersionCloseAuditRecord[] = Object.freeze(
  scopeVersionCloseDraftFixtures.map((close, index) => createCloseAuditRecord(close, scopeVersionCloseValidationFixtures[index])),
);

export function evaluateScopeVersionCloseAuthorityFixtures() {
  return {
    closeCount: scopeVersionCloseDraftFixtures.length,
    validCloseCount: scopeVersionCloseValidationFixtures.filter((validation) => validation.valid).length,
    rejectedCloseCount: scopeVersionCloseValidationFixtures.filter((validation) => !validation.valid).length,
    auditRecordCount: scopeVersionCloseAuditFixtures.length,
    rejectedCloseIds: scopeVersionCloseValidationFixtures
      .filter((validation) => !validation.valid)
      .map((validation) => ({ closeId: validation.closeId, errors: validation.errors })),
  };
}

