import {
  SCOPEVERSION_CLOSE_TYPE_REGISTRY,
  type ScopeVersionCloseActorRole,
  type ScopeVersionCloseAuditRecord,
  type ScopeVersionCloseDiagnostic,
  type ScopeVersionCloseDraftInput,
  type ScopeVersionCloseEvent,
  type ScopeVersionCloseOutcome,
  type ScopeVersionCloseType,
  type ScopeVersionCloseValidation,
} from "./ScopeVersionCloseAuthority";

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: ScopeVersionCloseDiagnostic["code"],
  closeId: string,
  severity: ScopeVersionCloseDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): ScopeVersionCloseDiagnostic {
  return { code, closeId, severity, message, details };
}

export function getAllowedCloseTypesForRole(actorRole: ScopeVersionCloseActorRole): ScopeVersionCloseType[] {
  if (actorRole === "AI_ASSISTANT_ADVISORY") return [];
  return SCOPEVERSION_CLOSE_TYPE_REGISTRY.filter((authority) => authority.authorizedRoles.includes(actorRole)).map(
    (authority) => authority.closeType,
  );
}

export function evaluateCloseAuthority(close: Pick<ScopeVersionCloseEvent, "closeType" | "actorRole" | "closeId">) {
  const authority = SCOPEVERSION_CLOSE_TYPE_REGISTRY.find((entry) => entry.closeType === close.closeType);
  const diagnostics: ScopeVersionCloseDiagnostic[] = [
    diagnostic("SCOPEVERSION_CLOSE_AUTHORITY_CHECKED", close.closeId, "INFO", `${close.closeType} authority checked.`, {
      actorRole: close.actorRole,
      authorityId: authority?.authorityId,
    }),
  ];

  if (!authority) {
    return {
      authorized: false,
      authority,
      diagnostics: [
        ...diagnostics,
        diagnostic("SCOPEVERSION_CLOSE_REJECTED", close.closeId, "ERROR", `Unknown close type ${close.closeType}.`),
      ],
    };
  }

  if (close.actorRole === "AI_ASSISTANT_ADVISORY") {
    return {
      authorized: false,
      authority,
      diagnostics: [
        ...diagnostics,
        diagnostic("SCOPEVERSION_CLOSE_REJECTED", close.closeId, "ERROR", "AI_ASSISTANT_ADVISORY may not validate a close."),
      ],
    };
  }

  if (!authority.authorizedRoles.includes(close.actorRole)) {
    return {
      authorized: false,
      authority,
      diagnostics: [
        ...diagnostics,
        diagnostic("SCOPEVERSION_CLOSE_REJECTED", close.closeId, "ERROR", `${close.actorRole} cannot validate ${close.closeType}.`),
      ],
    };
  }

  return { authorized: true, authority, diagnostics };
}

export function createScopeVersionCloseDraft(input: ScopeVersionCloseDraftInput): ScopeVersionCloseEvent {
  const authority = SCOPEVERSION_CLOSE_TYPE_REGISTRY.find((entry) => entry.closeType === input.closeType);
  if (!authority) throw new Error(`Unknown ScopeVersion close type: ${input.closeType}`);

  const outcome: ScopeVersionCloseOutcome = {
    status: input.outcome?.status ?? (input.supersedesCloseId ? "SUPERSEDED" : "NO_STATE_CHANGE"),
    previousState: input.outcome?.previousState,
    resultingState: input.outcome?.resultingState,
    supersedesCloseId: input.supersedesCloseId ?? input.outcome?.supersedesCloseId,
    notes: input.outcome?.notes,
  };

  const draft = {
    closeId: input.closeId,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    closeType: input.closeType,
    authority,
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: input.evidenceIds ?? [],
    inputReferences: input.inputReferences ?? [],
    constraintReferences: input.constraintReferences ?? [],
    outcome,
    createdAt: input.createdAt ?? nowIso(),
    validatedAt: undefined,
    immutable: false,
  } satisfies ScopeVersionCloseEvent;

  console.info("[SCOPEVERSION_CLOSE_DRAFT_CREATED]", {
    closeId: draft.closeId,
    scopeVersionId: draft.scopeVersionId,
    closeType: draft.closeType,
    actorRole: draft.actorRole,
  });

  return draft;
}

export function validateScopeVersionClose(close: ScopeVersionCloseEvent): ScopeVersionCloseValidation {
  const started = diagnostic("SCOPEVERSION_CLOSE_VALIDATION_STARTED", close.closeId, "INFO", `${close.closeId} validation started.`);
  const authorityEvaluation = evaluateCloseAuthority(close);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!close.scopeVersionId) errors.push("A close must have a valid scopeVersionId.");
  if (!close.customerId) errors.push("A close must trace to customerId.");
  if (!close.opportunityId) errors.push("A close must trace to opportunityId.");
  if (!close.corridorId) errors.push("A close must trace to corridorId.");
  if (!close.closeType) errors.push("A close must have a close type.");
  if (!close.actorId) errors.push("A close must have an actorId.");
  if (!authorityEvaluation.authorized) errors.push("Actor role is not authorized for this close type.");
  if (close.authority.requiredEvidence && close.evidenceIds.length === 0) errors.push("A close must have evidence.");
  if (close.validatedAt && !close.immutable) errors.push("A validated close must be immutable.");
  if (close.actorRole === "AI_ASSISTANT_ADVISORY") errors.push("AI_ASSISTANT_ADVISORY may never validate a close.");

  if (close.inputReferences.length === 0) warnings.push("Close has no input references.");
  if (close.constraintReferences.length === 0) warnings.push("Close has no constraint references.");
  if (close.outcome.status === "ACCEPTED" && !close.outcome.resultingState) warnings.push("Accepted close should identify resulting state.");

  const valid = errors.length === 0;
  const validatedAt = valid ? nowIso() : undefined;
  const resultDiagnostic = valid
    ? diagnostic("SCOPEVERSION_CLOSE_VALIDATED", close.closeId, "INFO", `${close.closeId} validated.`, { validatedAt })
    : diagnostic("SCOPEVERSION_CLOSE_REJECTED", close.closeId, "ERROR", `${close.closeId} rejected.`, { errors });

  console.info(valid ? "[SCOPEVERSION_CLOSE_VALIDATED]" : "[SCOPEVERSION_CLOSE_REJECTED]", {
    closeId: close.closeId,
    scopeVersionId: close.scopeVersionId,
    closeType: close.closeType,
    errors,
    warnings,
  });

  return {
    closeId: close.closeId,
    scopeVersionId: close.scopeVersionId,
    status: valid ? "VALIDATED" : "REJECTED",
    valid,
    errors,
    warnings,
    diagnostics: [started, ...authorityEvaluation.diagnostics, resultDiagnostic],
    validatedAt,
  };
}

export function createCloseAuditRecord(close: ScopeVersionCloseEvent, validation: ScopeVersionCloseValidation): ScopeVersionCloseAuditRecord {
  const timestamp = validation.validatedAt ?? nowIso();
  const auditRecord: ScopeVersionCloseAuditRecord = {
    auditId: `AUDIT-${close.closeId}`,
    closeId: close.closeId,
    scopeVersionId: close.scopeVersionId,
    inputs: close.inputReferences,
    evidence: close.evidenceIds,
    constraints: close.constraintReferences,
    actor: {
      actorId: close.actorId,
      actorRole: close.actorRole,
    },
    authority: close.authority,
    timestamp,
    outcome: close.outcome,
    previousState: close.outcome.previousState,
    resultingState: close.outcome.resultingState,
    replayReferences: [...close.inputReferences, ...close.constraintReferences],
    diagnostics: [
      ...validation.diagnostics,
      diagnostic("SCOPEVERSION_CLOSE_AUDIT_RECORD_CREATED", close.closeId, "INFO", `Audit record created for ${close.closeId}.`, {
        auditId: `AUDIT-${close.closeId}`,
      }),
    ],
  };

  console.info("[SCOPEVERSION_CLOSE_AUDIT_RECORD_CREATED]", {
    auditId: auditRecord.auditId,
    closeId: auditRecord.closeId,
    scopeVersionId: auditRecord.scopeVersionId,
  });

  return auditRecord;
}
