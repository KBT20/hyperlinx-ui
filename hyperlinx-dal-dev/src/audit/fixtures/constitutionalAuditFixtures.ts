import {
  createCloseAuditRecord,
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../../scopeversion/ScopeVersionCloseAuthorityEngine";
import type {
  ScopeVersionCloseActorRole,
  ScopeVersionCloseEvent,
  ScopeVersionCloseType,
} from "../../scopeversion/ScopeVersionCloseAuthority";
import {
  createTransitionAudit,
  evaluateTransition,
} from "../../scopeversion/ScopeVersionTransitionAuthorityEngine";
import type {
  ScopeVersionState,
  ScopeVersionTransitionResult,
} from "../../scopeversion/ScopeVersionLifecycle";
import type { WorkPackage } from "../../control/WorkPackage";
import {
  runConstitutionalAudit,
  runTraceabilityAudit,
  runAuthorityAudit,
  runLifecycleAudit,
  runCloseAudit,
  runReplayabilityAudit,
} from "../ConstitutionalAuditEngine";
import type {
  ConstitutionalAuthorityEvent,
  ConstitutionalRuntimeSnapshot,
  ConstitutionalScopeVersionRef,
} from "../ConstitutionalAudit";

const trace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-CONSTITUTIONAL-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
  scopeVersionId: "SV-CONSTITUTIONAL-001",
};

function actorFor(closeType: ScopeVersionCloseType): { actorId: string; actorRole: ScopeVersionCloseActorRole } {
  if (closeType === "CONTRACT_CLOSE") return { actorId: "legal-001", actorRole: "LEGAL" };
  if (closeType === "FIELD_CLOSE") return { actorId: "field-001", actorRole: "FIELD_OPERATOR" };
  return { actorId: "ops-001", actorRole: "TERALINX_OPERATIONS" };
}

function close(closeType: ScopeVersionCloseType, scopeVersionId = trace.scopeVersionId): ScopeVersionCloseEvent {
  const actor = actorFor(closeType);
  const draft = createScopeVersionCloseDraft({
    closeId: `${closeType}-${scopeVersionId}`,
    scopeVersionId,
    customerId: trace.customerId,
    opportunityId: trace.opportunityId,
    corridorId: trace.corridorId,
    closeType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    evidenceIds: [`EVIDENCE-${closeType}-${scopeVersionId}`],
    inputReferences: [
      {
        referenceId: scopeVersionId,
        referenceType: "ScopeVersion",
        source: "ConstitutionalAuditFixture",
        immutable: true,
      },
    ],
    constraintReferences: [
      {
        referenceId: closeType,
        referenceType: "CloseType",
        source: "ConstitutionalAuditFixture",
        immutable: true,
      },
    ],
    outcome: closeOutcome(closeType),
  });
  const validation = validateScopeVersionClose(draft);
  return {
    ...draft,
    validatedAt: validation.validatedAt,
    immutable: validation.valid,
  };
}

function closeOutcome(closeType: ScopeVersionCloseType) {
  if (closeType === "CONTRACT_CLOSE") return { status: "ACCEPTED" as const, previousState: "CONTRACT_REVIEW", resultingState: "CONTRACT_EXECUTED" };
  if (closeType === "CONTROL_CLOSE") return { status: "ACCEPTED" as const, previousState: "CONTROL_READY", resultingState: "CONTROL_ACTIVE" };
  if (closeType === "FIELD_CLOSE") return { status: "ACCEPTED" as const, previousState: "FIELD_READY", resultingState: "FIELD_ACTIVE" };
  if (closeType === "COMPLETION_CLOSE") return { status: "ACCEPTED" as const, previousState: "COMPLETION_REVIEW", resultingState: "COMPLETE" };
  if (closeType === "OPERATIONS_CLOSE") return { status: "ACCEPTED" as const, previousState: "COMPLETE", resultingState: "OPERATIONS" };
  return { status: "ACCEPTED" as const };
}

function baseScope(overrides: Partial<ConstitutionalScopeVersionRef> = {}): ConstitutionalScopeVersionRef {
  return {
    ...trace,
    lifecycleState: "OPERATIONS",
    status: "OPERATIONS",
    ...overrides,
  };
}

function workPackage(scopeVersionId = trace.scopeVersionId): WorkPackage {
  return {
    workPackageId: `WP-${scopeVersionId}`,
    workPackageType: "CONSTRUCTION_WORK_PACKAGE",
    status: "READY_FOR_FIELD",
    scopeVersionId,
    customerId: trace.customerId,
    opportunityId: trace.opportunityId,
    corridorId: trace.corridorId,
    name: "Constitutional audit work package",
    description: "Fixture work package for constitutional audit replayability.",
    allocation: {
      scopeVersionId,
      customerId: trace.customerId,
      opportunityId: trace.opportunityId,
      corridorId: trace.corridorId,
      stationIds: ["STA-0000", "STA-0100"],
      segmentIds: ["SEG-001"],
      objectIds: ["OBJ-CONDUIT-001"],
      vendorIds: ["VENDOR-CONSTRUCTION-001"],
      budgetReferences: ["BUDGET-001"],
      quantityReferences: ["QUANTITY-001"],
      dependencyReferences: [],
    },
    dependencies: [],
    authorityReferences: {
      controlActivationId: `CONTROL-ACTIVATION-${scopeVersionId}`,
      controlCloseId: `CONTROL_CLOSE-${scopeVersionId}`,
      lifecycleState: "CONTROL_ACTIVE",
    },
    createdAt: "2026-06-24T00:00:00.000Z",
    diagnostics: [],
  };
}

function transition(
  previousState: ScopeVersionState,
  requestedState: ScopeVersionState,
  closes: ScopeVersionCloseEvent[],
): ScopeVersionTransitionResult {
  return evaluateTransition({
    scopeVersionId: trace.scopeVersionId,
    previousState,
    requestedState,
    actorId: "ops-001",
    actorRole: requestedState === "FIELD_ACTIVE" ? "FIELD_OPERATOR" : "TERALINX_OPERATIONS",
    closes,
  });
}

function invalidTransition(previousState: ScopeVersionState, requestedState: ScopeVersionState): ScopeVersionTransitionResult {
  return {
    transitionId: `INVALID-${previousState}-${requestedState}`,
    scopeVersionId: trace.scopeVersionId,
    previousState,
    requestedState,
    approved: true,
    missingCloseTypes: [],
    validatedCloseIds: [],
    actor: {
      actorId: "ops-001",
      actorRole: "TERALINX_OPERATIONS",
    },
    evaluatedAt: "2026-06-24T00:00:00.000Z",
    diagnostics: [],
  };
}

function authorityEvents(scopeVersionId = trace.scopeVersionId): ConstitutionalAuthorityEvent[] {
  return [
    event("PRISM", "ADVISORY", "AUTH-EVENT-PRISM", scopeVersionId, "PRISM-AUDIT-001"),
    event("MARKETPLACE", "ADVISORY", "AUTH-EVENT-MARKETPLACE", scopeVersionId, "MARKET-AUDIT-001"),
    event("CONTROL", "EXECUTION_AUTHORITY", "AUTH-EVENT-CONTROL", scopeVersionId, `CONTROL_CLOSE-${scopeVersionId}`),
    event("FIELD", "FIELD_EXECUTION", "AUTH-EVENT-FIELD", scopeVersionId, `FIELD_CLOSE-${scopeVersionId}`),
    event("COMPLETION", "COMPLETION_AUTHORITY", "AUTH-EVENT-COMPLETION", scopeVersionId, `COMPLETION_CLOSE-${scopeVersionId}`),
    event("OPERATIONS", "OPERATIONS_AUTHORITY", "AUTH-EVENT-OPERATIONS", scopeVersionId, `OPERATIONS_CLOSE-${scopeVersionId}`),
  ];
}

function event(
  authorityLayer: ConstitutionalAuthorityEvent["authorityLayer"],
  actionType: ConstitutionalAuthorityEvent["actionType"],
  eventId: string,
  scopeVersionId = trace.scopeVersionId,
  auditOrCloseId?: string,
): ConstitutionalAuthorityEvent {
  return {
    ...trace,
    eventId,
    authorityLayer,
    actionType,
    scopeVersionId,
    closeId: auditOrCloseId?.includes("_CLOSE") || auditOrCloseId?.includes("CLOSE-") ? auditOrCloseId : undefined,
    auditId: auditOrCloseId?.includes("AUDIT") ? auditOrCloseId : undefined,
    actorId: actionType === "ADVISORY" ? "analyst-001" : "ops-001",
    actorRole: actionType === "ADVISORY" ? "TERALINX_ENGINEERING" : "TERALINX_OPERATIONS",
  };
}

function validSnapshot(snapshotId: string): ConstitutionalRuntimeSnapshot {
  const closes = [
    close("CONTRACT_CLOSE"),
    close("CONTROL_CLOSE"),
    close("FIELD_CLOSE"),
    close("COMPLETION_CLOSE"),
    close("OPERATIONS_CLOSE"),
  ];
  const transitions = [
    transition("CONTRACT_REVIEW", "CONTRACT_EXECUTED", closes),
    transition("CONTROL_READY", "CONTROL_ACTIVE", closes),
    transition("FIELD_READY", "FIELD_ACTIVE", closes),
    transition("COMPLETION_REVIEW", "COMPLETE", closes),
    transition("COMPLETE", "OPERATIONS", closes),
  ];

  return {
    snapshotId,
    customers: [{ customerId: trace.customerId, name: "Hyperscaler Customer" }],
    opportunities: [
      {
        opportunityId: trace.opportunityId,
        customerId: trace.customerId,
        corridorIds: [trace.corridorId],
        scopeVersionIds: [trace.scopeVersionId],
      },
    ],
    corridors: [
      {
        corridorId: trace.corridorId,
        customerId: trace.customerId,
        opportunityId: trace.opportunityId,
        scopeVersionIds: [trace.scopeVersionId],
      },
    ],
    scopeVersions: [baseScope()],
    authorityEvents: authorityEvents(),
    closeEvents: closes,
    closeAudits: closes.map((item) => createCloseAuditRecord(item, validateScopeVersionClose(item))),
    lifecycleTransitions: transitions,
    lifecycleAudits: transitions.map(createTransitionAudit),
    workPackages: [workPackage()],
  };
}

export const constitutionalAuditSnapshots: readonly ConstitutionalRuntimeSnapshot[] = Object.freeze([
  validSnapshot("SNAPSHOT-FULLY-VALID-RUNTIME"),
  {
    ...validSnapshot("SNAPSHOT-MISSING-CUSTOMER-TRACEABILITY"),
    opportunities: [{ opportunityId: trace.opportunityId, corridorIds: [trace.corridorId], scopeVersionIds: [trace.scopeVersionId] }],
  },
  {
    ...validSnapshot("SNAPSHOT-MISSING-SCOPEVERSION-TRACEABILITY"),
    authorityEvents: [
      {
        ...event("CONTROL", "EXECUTION_AUTHORITY", "AUTH-EVENT-MISSING-SCOPE"),
        scopeVersionId: undefined,
      },
    ],
  },
  {
    ...validSnapshot("SNAPSHOT-AUTHORITY-VIOLATION"),
    authorityEvents: [
      ...authorityEvents(),
      event("PRISM", "EXECUTION_AUTHORITY", "AUTH-EVENT-PRISM-VIOLATION"),
    ],
  },
  {
    ...validSnapshot("SNAPSHOT-LIFECYCLE-BYPASS"),
    lifecycleTransitions: [invalidTransition("INTENT", "OPERATIONS")],
    lifecycleAudits: [],
  },
  {
    ...validSnapshot("SNAPSHOT-MISSING-CLOSE-AUTHORITY"),
    closeEvents: [close("CONTRACT_CLOSE"), close("CONTROL_CLOSE"), close("FIELD_CLOSE"), close("COMPLETION_CLOSE")],
  },
  {
    ...validSnapshot("SNAPSHOT-REPLAYABILITY-FAILURE"),
    closeAudits: [],
    lifecycleAudits: [],
    authorityEvents: authorityEvents().map((item) => ({ ...item, closeId: undefined, auditId: undefined })),
  },
  {
    ...validSnapshot("SNAPSHOT-ORPHAN-WORK-PACKAGE"),
    workPackages: [workPackage("SV-UNKNOWN")],
  },
  {
    ...validSnapshot("SNAPSHOT-INVALID-FIELD-ACTIVATION"),
    lifecycleTransitions: [invalidTransition("CONTROL_ACTIVE", "FIELD_ACTIVE")],
    lifecycleAudits: [],
  },
  validSnapshot("SNAPSHOT-FULLY-COMPLIANT-RUNTIME"),
]);

export const constitutionalTraceabilityAuditFixtures = Object.freeze(
  constitutionalAuditSnapshots.map(runTraceabilityAudit),
);

export const constitutionalAuthorityAuditFixtures = Object.freeze(
  constitutionalAuditSnapshots.map(runAuthorityAudit),
);

export const constitutionalLifecycleAuditFixtures = Object.freeze(
  constitutionalAuditSnapshots.map(runLifecycleAudit),
);

export const constitutionalCloseAuditFixtures = Object.freeze(
  constitutionalAuditSnapshots.map(runCloseAudit),
);

export const constitutionalReplayabilityAuditFixtures = Object.freeze(
  constitutionalAuditSnapshots.map(runReplayabilityAudit),
);

export const constitutionalAuditFixtures = Object.freeze(
  constitutionalAuditSnapshots.map(runConstitutionalAudit),
);

export function evaluateConstitutionalAuditFixtures() {
  return {
    fixtureCount: constitutionalAuditFixtures.length,
    passedCount: constitutionalAuditFixtures.filter((audit) => audit.passed).length,
    failedCount: constitutionalAuditFixtures.filter((audit) => !audit.passed).length,
    criticalFindings: constitutionalAuditFixtures.flatMap((audit) =>
      audit.findings.filter((item) => item.severity === "CRITICAL").map((item) => ({
        snapshotId: audit.snapshotId,
        findingType: item.findingType,
        message: item.message,
        objectId: item.objectId,
      })),
    ),
  };
}
