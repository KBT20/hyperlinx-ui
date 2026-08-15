import {
  deriveDomainProjection,
  type DomainProjection,
} from "./DomainProjectionEngine";
import {
  appendClosureEvent,
  closureLedgerHash,
  createConstitutionalClosureLedger,
  type ClosureLedgerEvidence,
  type ConstitutionalClosureEvent,
  type ConstitutionalClosureLedger,
} from "./ClosureLedger";
import {
  stateDefinitionFor,
  type ConstitutionalStateDefinition,
} from "./StateRegistry";
import type { ConstitutionalLifecycleState, DomainAuthority } from "./ObjectTransitionEngine";

export const CLOSURE_ENGINE_AUTHORITY = "CLOSURE_ENGINE" as const;
export const CLOSURE_ENGINE_VERSION = "39.0" as const;

export type ClosureDependency = {
  dependencyId: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "PENDING" | "CLOSED" | "OPEN";
  reason?: string;
};

export type SubmitClosureInput = {
  objectId?: string;
  spanId?: string;
  closureSegmentId?: string;
  currentState: ConstitutionalLifecycleState;
  requestedState: ConstitutionalLifecycleState;
  authority: DomainAuthority | string;
  actor: string;
  evidenceIds: string[];
  evidence?: ClosureLedgerEvidence[];
  stationRange?: {
    startStation?: string;
    endStation?: string;
    startMeasure?: number;
    endMeasure?: number;
  };
  scopeVersionId?: string;
  geometryAuthorityId?: string;
  reason: string;
  ledger?: ConstitutionalClosureLedger;
  closureLedgerId?: string;
  entity?: Record<string, unknown>;
  dependencies?: ClosureDependency[];
  timestamp?: string;
};

export type ClosureValidationResult = {
  status: "PASS" | "FAIL";
  failures: string[];
  currentState: ConstitutionalLifecycleState;
  requestedState: ConstitutionalLifecycleState;
  currentDefinition: ConstitutionalStateDefinition;
  requestedDefinition: ConstitutionalStateDefinition;
  validatedBy: typeof CLOSURE_ENGINE_AUTHORITY;
};

export type SubmitClosureResult = {
  status: "PASS" | "FAIL";
  validation: ClosureValidationResult;
  closureEvent?: ConstitutionalClosureEvent;
  closureLedger: ConstitutionalClosureLedger;
  advancedEntity?: Record<string, unknown>;
  domainProjection: DomainProjection;
  twinRefresh: {
    refreshRequired: boolean;
    projectionSource: "Closure Ledger";
    currentState: ConstitutionalLifecycleState;
    ledgerHash: string;
  };
  operationalIntelligenceRefresh: {
    refreshRequired: boolean;
    reasoningSource: "Closure Ledger";
    eventCount: number;
    blockedDependencies: ClosureDependency[];
  };
  stateMutationAuthority: typeof CLOSURE_ENGINE_AUTHORITY;
};

function nowIso() {
  return new Date().toISOString();
}

function closureEntityId(input: SubmitClosureInput) {
  return input.objectId ?? input.spanId ?? input.closureSegmentId ?? "UNKNOWN";
}

function evidenceForInput(input: SubmitClosureInput) {
  const typedEvidence = input.evidence ?? [];
  const existingIds = new Set(typedEvidence.map((entry) => entry.evidenceId));
  return [
    ...typedEvidence,
    ...input.evidenceIds
      .filter((evidenceId) => !existingIds.has(evidenceId))
      .map((evidenceId) => ({ evidenceId, status: "PASS" as const })),
  ];
}

function blockedDependencies(input: SubmitClosureInput) {
  return (input.dependencies ?? []).filter((dependency) => (
    dependency.status === "FAIL"
    || dependency.status === "BLOCKED"
    || dependency.status === "PENDING"
    || dependency.status === "OPEN"
  ));
}

function validateClosureInput(input: SubmitClosureInput): ClosureValidationResult {
  const currentDefinition = stateDefinitionFor(input.currentState);
  const requestedDefinition = stateDefinitionFor(input.requestedState);
  const blockers = blockedDependencies(input);
  const failures = [
    ...(currentDefinition.allowedTransitions.includes(input.requestedState)
      ? []
      : [`transition ${input.currentState} -> ${input.requestedState} is not allowed`]),
    ...(requestedDefinition.authority === input.authority
      ? []
      : [`authority ${input.authority} cannot advance ${input.requestedState}; ${requestedDefinition.authority} is required`]),
    ...(currentDefinition.requiredEvidence.length === 0 || input.evidenceIds.length > 0
      ? []
      : [`required evidence missing: ${currentDefinition.requiredEvidence.join(", ")}`]),
    ...(closureEntityId(input) === "UNKNOWN"
      ? ["objectId, spanId, or closureSegmentId is required"]
      : []),
    ...blockers.map((dependency) => `blocking dependency ${dependency.dependencyId}: ${dependency.reason ?? dependency.status}`),
  ];
  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    currentState: currentDefinition.stateId,
    requestedState: requestedDefinition.stateId,
    currentDefinition,
    requestedDefinition,
    validatedBy: CLOSURE_ENGINE_AUTHORITY,
  };
}

function closureEventFor(input: SubmitClosureInput, validation: ClosureValidationResult) {
  const timestamp = input.timestamp ?? nowIso();
  const evidence = evidenceForInput(input);
  const auditHash = closureLedgerHash({
    entityId: closureEntityId(input),
    fromState: validation.currentState,
    toState: validation.requestedState,
    authority: input.authority,
    actor: input.actor,
    evidence,
    geometryAuthorityId: input.geometryAuthorityId,
    scopeVersionId: input.scopeVersionId,
    stationRange: input.stationRange,
    reason: input.reason,
    timestamp,
  });
  return {
    closureId: `CLOSURE-${auditHash.replace("closure-hash-", "").toUpperCase()}`,
    timestamp,
    objectId: input.objectId,
    spanId: input.spanId,
    closureSegmentId: input.closureSegmentId,
    fromState: validation.currentState,
    toState: validation.requestedState,
    domain: validation.requestedDefinition.domain,
    authority: validation.requestedDefinition.authority,
    actor: input.actor,
    evidence,
    evidenceIds: evidence.map((entry) => entry.evidenceId),
    geometryAuthorityId: input.geometryAuthorityId ?? "MEASURED_CENTERLINE",
    scopeVersionId: input.scopeVersionId,
    stationRange: input.stationRange,
    reason: input.reason,
    auditHash,
    immutable: true,
    ledgerAuthority: "CLOSURE_LEDGER",
  } satisfies ConstitutionalClosureEvent;
}

function advanceEntity(input: SubmitClosureInput, event: ConstitutionalClosureEvent, projection: DomainProjection) {
  return {
    ...(input.entity ?? {}),
    previousState: event.fromState,
    currentState: event.toState,
    currentLifecycleState: event.toState,
    nextState: projection.nextAllowedStates[0],
    currentAuthority: projection.currentAuthority,
    allowedTransitions: projection.nextAllowedStates,
    requiredEvidenceForNextTransition: stateDefinitionFor(event.toState).requiredEvidence,
    latestClosureId: event.closureId,
    closureEventHistory: [
      ...((Array.isArray(input.entity?.closureEventHistory) ? input.entity?.closureEventHistory : []) as unknown[]),
      event,
    ],
    auditStatus: event.toState === "RETIRED" ? "CLOSED" : "OPEN",
    stateMutationAuthority: CLOSURE_ENGINE_AUTHORITY,
    stateProjectionAuthority: projection.projectionAuthority,
    closureLedgerAuthority: event.ledgerAuthority,
  };
}

export function submitClosure(input: SubmitClosureInput): SubmitClosureResult {
  const validation = validateClosureInput(input);
  const baseLedger = input.ledger ?? createConstitutionalClosureLedger({
    closureLedgerId: input.closureLedgerId ?? `${closureEntityId(input)}:CLOSURE-LEDGER`,
    scopeVersionId: input.scopeVersionId,
    geometryAuthorityId: input.geometryAuthorityId,
  });
  const domainProjection = deriveDomainProjection(input.requestedState);

  if (validation.status === "FAIL") {
    return {
      status: "FAIL",
      validation,
      closureLedger: baseLedger,
      domainProjection,
      twinRefresh: {
        refreshRequired: false,
        projectionSource: "Closure Ledger",
        currentState: input.currentState,
        ledgerHash: baseLedger.ledgerHash,
      },
      operationalIntelligenceRefresh: {
        refreshRequired: false,
        reasoningSource: "Closure Ledger",
        eventCount: baseLedger.eventCount,
        blockedDependencies: blockedDependencies(input),
      },
      stateMutationAuthority: CLOSURE_ENGINE_AUTHORITY,
    };
  }

  const closureEvent = closureEventFor(input, validation);
  const closureLedger = appendClosureEvent(baseLedger, closureEvent);
  const advancedEntity = advanceEntity(input, closureEvent, domainProjection);

  return {
    status: "PASS",
    validation,
    closureEvent,
    closureLedger,
    advancedEntity,
    domainProjection,
    twinRefresh: {
      refreshRequired: true,
      projectionSource: "Closure Ledger",
      currentState: input.requestedState,
      ledgerHash: closureLedger.ledgerHash,
    },
    operationalIntelligenceRefresh: {
      refreshRequired: true,
      reasoningSource: "Closure Ledger",
      eventCount: closureLedger.eventCount,
      blockedDependencies: [],
    },
    stateMutationAuthority: CLOSURE_ENGINE_AUTHORITY,
  };
}
