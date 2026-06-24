import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent, ScopeVersionCloseType } from "./ScopeVersionCloseAuthority";
import {
  SCOPEVERSION_TRANSITION_AUTHORITY_REGISTRY,
  findTransitionAuthority,
} from "./ScopeVersionTransitionAuthority";
import {
  SCOPEVERSION_TRANSITION_REGISTRY,
  SCOPEVERSION_TRANSITION_REQUIREMENTS,
  type ScopeVersionLifecycleAudit,
  type ScopeVersionLifecycleDiagnostic,
  type ScopeVersionState,
  type ScopeVersionTransitionAuthority,
  type ScopeVersionTransitionResult,
} from "./ScopeVersionLifecycle";

export interface ScopeVersionTransitionEvaluationInput {
  scopeVersionId: string;
  previousState: ScopeVersionState;
  requestedState: ScopeVersionState;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  closes: readonly ScopeVersionCloseEvent[];
}

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: ScopeVersionLifecycleDiagnostic["code"],
  transitionId: string,
  severity: ScopeVersionLifecycleDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): ScopeVersionLifecycleDiagnostic {
  return { code, transitionId, severity, message, details };
}

export function getRequiredCloses(requestedState: ScopeVersionState): ScopeVersionCloseType[] {
  return SCOPEVERSION_TRANSITION_REQUIREMENTS.find((requirement) => requirement.targetState === requestedState)?.requiredCloseTypes ?? [];
}

export function getAllowedTransitions(
  currentState: ScopeVersionState,
  actorRole?: ScopeVersionCloseActorRole,
): ScopeVersionState[] {
  return SCOPEVERSION_TRANSITION_AUTHORITY_REGISTRY.filter((authority) => {
    if (authority.transition.from !== currentState) return false;
    if (!actorRole) return true;
    if (actorRole === "AI_ASSISTANT_ADVISORY") return false;
    return authority.authorizedRoles.includes(actorRole);
  }).map((authority) => authority.transition.to);
}

export function validateTransitionRequirements(input: {
  scopeVersionId: string;
  requestedState: ScopeVersionState;
  closes: readonly ScopeVersionCloseEvent[];
}): {
  missingCloseTypes: ScopeVersionCloseType[];
  validatedCloseIds: string[];
  diagnostics: ScopeVersionLifecycleDiagnostic[];
} {
  const transitionId = `REQ-${input.scopeVersionId}-${input.requestedState}`;
  const requiredCloseTypes = getRequiredCloses(input.requestedState);
  const validCloses = input.closes.filter((close) => isValidatedCloseForScope(close, input.scopeVersionId));
  const validatedCloseIds = validCloses
    .filter((close) => requiredCloseTypes.includes(close.closeType))
    .map((close) => close.closeId);
  const satisfiedTypes = new Set(validCloses.map((close) => close.closeType));
  const missingCloseTypes = requiredCloseTypes.filter((closeType) => !satisfiedTypes.has(closeType));

  return {
    missingCloseTypes,
    validatedCloseIds,
    diagnostics: missingCloseTypes.map((closeType) =>
      diagnostic("LIFECYCLE_REQUIREMENT_MISSING", transitionId, "ERROR", `${closeType} is required for ${input.requestedState}.`, {
        scopeVersionId: input.scopeVersionId,
        requestedState: input.requestedState,
        closeType,
      }),
    ),
  };
}

export function evaluateTransition(input: ScopeVersionTransitionEvaluationInput): ScopeVersionTransitionResult {
  const authority = findTransitionAuthority(input.previousState, input.requestedState);
  const transitionId = authority?.transition.transitionId ?? `INVALID-${input.previousState}-${input.requestedState}`;
  const diagnostics: ScopeVersionLifecycleDiagnostic[] = [
    diagnostic("LIFECYCLE_TRANSITION_EVALUATED", transitionId, "INFO", `${input.previousState} -> ${input.requestedState} evaluated.`, {
      scopeVersionId: input.scopeVersionId,
      actorRole: input.actorRole,
    }),
  ];

  if (!input.scopeVersionId) {
    return rejected(input, transitionId, authority, ["scopeVersionId is required."], [], diagnostics);
  }

  if (!authority) {
    return rejected(input, transitionId, authority, [`${input.previousState} -> ${input.requestedState} is not an allowed transition.`], [], diagnostics);
  }

  if (input.actorRole === "AI_ASSISTANT_ADVISORY") {
    return rejected(input, transitionId, authority, ["AI_ASSISTANT_ADVISORY may not advance lifecycle state."], [], diagnostics);
  }

  if (!authority.authorizedRoles.includes(input.actorRole)) {
    return rejected(input, transitionId, authority, [`${input.actorRole} is not authorized for ${transitionId}.`], [], diagnostics);
  }

  const requirements = validateTransitionRequirements({
    scopeVersionId: input.scopeVersionId,
    requestedState: input.requestedState,
    closes: input.closes,
  });

  if (requirements.missingCloseTypes.length) {
    return rejected(input, transitionId, authority, [], requirements.missingCloseTypes, [
      ...diagnostics,
      ...requirements.diagnostics,
    ]);
  }

  const result = {
    transitionId,
    scopeVersionId: input.scopeVersionId,
    previousState: input.previousState,
    requestedState: input.requestedState,
    approved: true,
    missingCloseTypes: [],
    validatedCloseIds: requirements.validatedCloseIds,
    authority,
    actor: {
      actorId: input.actorId,
      actorRole: input.actorRole,
    },
    evaluatedAt: nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("LIFECYCLE_TRANSITION_APPROVED", transitionId, "INFO", `${transitionId} approved.`, {
        validatedCloseIds: requirements.validatedCloseIds,
      }),
    ],
  } satisfies ScopeVersionTransitionResult;

  console.info("[LIFECYCLE_TRANSITION_APPROVED]", {
    scopeVersionId: result.scopeVersionId,
    previousState: result.previousState,
    requestedState: result.requestedState,
    transitionId: result.transitionId,
  });

  return result;
}

export function createTransitionAudit(result: ScopeVersionTransitionResult): ScopeVersionLifecycleAudit {
  const audit = {
    auditId: `LIFECYCLE-AUDIT-${result.transitionId}-${result.scopeVersionId}`,
    scopeVersionId: result.scopeVersionId,
    previousState: result.previousState,
    requestedState: result.requestedState,
    requiredCloses: getRequiredCloses(result.requestedState),
    validatedCloses: result.validatedCloseIds,
    authority: result.authority,
    actor: result.actor,
    timestamp: result.evaluatedAt,
    result: result.approved ? "APPROVED" : "REJECTED",
    diagnostics: [
      ...result.diagnostics,
      diagnostic("LIFECYCLE_AUDIT_CREATED", result.transitionId, "INFO", `Lifecycle audit created for ${result.transitionId}.`, {
        auditId: `LIFECYCLE-AUDIT-${result.transitionId}-${result.scopeVersionId}`,
      }),
    ],
  } satisfies ScopeVersionLifecycleAudit;

  console.info("[LIFECYCLE_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    result: audit.result,
  });

  return audit;
}

export function getTransitionAuthority(
  previousState: ScopeVersionState,
  requestedState: ScopeVersionState,
): ScopeVersionTransitionAuthority | undefined {
  return findTransitionAuthority(previousState, requestedState);
}

export function isKnownLifecycleState(state: string): state is ScopeVersionState {
  return SCOPEVERSION_TRANSITION_REGISTRY.some((transition) => transition.from === state || transition.to === state);
}

function isValidatedCloseForScope(close: ScopeVersionCloseEvent, scopeVersionId: string) {
  return close.scopeVersionId === scopeVersionId && close.immutable === true && Boolean(close.validatedAt);
}

function rejected(
  input: ScopeVersionTransitionEvaluationInput,
  transitionId: string,
  authority: ScopeVersionTransitionAuthority | undefined,
  reasons: string[],
  missingCloseTypes: ScopeVersionCloseType[],
  diagnostics: ScopeVersionLifecycleDiagnostic[],
): ScopeVersionTransitionResult {
  const rejectionDiagnostics = [
    ...diagnostics,
    ...reasons.map((reason) => diagnostic("LIFECYCLE_TRANSITION_REJECTED", transitionId, "ERROR", reason)),
    ...missingCloseTypes.map((closeType) =>
      diagnostic("LIFECYCLE_REQUIREMENT_MISSING", transitionId, "ERROR", `${closeType} is required.`, { closeType }),
    ),
    diagnostic("LIFECYCLE_TRANSITION_REJECTED", transitionId, "ERROR", `${transitionId} rejected.`, {
      reasons,
      missingCloseTypes,
    }),
  ];

  const result = {
    transitionId,
    scopeVersionId: input.scopeVersionId,
    previousState: input.previousState,
    requestedState: input.requestedState,
    approved: false,
    missingCloseTypes,
    validatedCloseIds: [],
    authority,
    actor: {
      actorId: input.actorId,
      actorRole: input.actorRole,
    },
    evaluatedAt: nowIso(),
    diagnostics: rejectionDiagnostics,
  } satisfies ScopeVersionTransitionResult;

  console.info("[LIFECYCLE_TRANSITION_REJECTED]", {
    scopeVersionId: result.scopeVersionId,
    previousState: result.previousState,
    requestedState: result.requestedState,
    transitionId: result.transitionId,
    reasons,
    missingCloseTypes,
  });

  return result;
}

