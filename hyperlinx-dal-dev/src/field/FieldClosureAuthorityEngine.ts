import type { ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../scopeversion/ScopeVersionCloseAuthorityEngine";
import {
  FIELD_CLOSURE_AUTHORITY,
  fieldClosureRequiresObjects,
  fieldClosureRequiresSegments,
  fieldClosureRequiresStations,
  type FieldClosureAudit,
  type FieldClosureBlocker,
  type FieldClosureBlockerCode,
  type FieldClosureBlockerSeverity,
  type FieldClosureEvaluationInput,
  type FieldClosureResult,
  type FieldClosureValidation,
} from "./FieldClosureAuthority";
import type {
  FieldClosureDiagnostic,
  FieldClosureDiagnosticCode,
  FieldClosureEvent,
  FieldClosureType,
} from "./FieldClosureEvent";

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: FieldClosureDiagnosticCode,
  severity: FieldClosureDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): FieldClosureDiagnostic {
  return { code, severity, message, details };
}

export function getAllowedFieldClosureTypes(): readonly FieldClosureType[] {
  return FIELD_CLOSURE_AUTHORITY.allowedClosureTypes;
}

export function evaluateFieldClosure(input: FieldClosureEvaluationInput): FieldClosureResult {
  const started = diagnostic("FIELD_CLOSURE_STARTED", "INFO", "Field closure evaluation started.", {
    fieldClosureId: input.fieldClosureId,
    fieldClosureType: input.fieldClosureType,
    scopeVersionId: input.scopeVersionId,
  });
  console.info("[FIELD_CLOSURE_STARTED]", {
    fieldClosureId: input.fieldClosureId,
    fieldClosureType: input.fieldClosureType,
    scopeVersionId: input.scopeVersionId,
  });

  const validation = validateFieldClosure(input);

  if (!validation.valid) {
    const diagnostics = [
      started,
      ...validation.diagnostics,
      diagnostic("FIELD_CLOSURE_REJECTED", "ERROR", "Field closure rejected.", {
        blockerCount: validation.blockers.length,
      }),
    ];
    const audit = createFieldClosureAudit(input, undefined, validation.blockers, diagnostics);
    return {
      fieldClosureId: input.fieldClosureId,
      status: "REJECTED",
      validation,
      audit,
      diagnostics: [...diagnostics, ...audit.diagnostics],
    };
  }

  const fieldClosure = buildFieldClosureEvent(input);
  const scopeVersionCloseDraft = createFieldClosureDraft(input);
  const closeValidation = validateScopeVersionClose(scopeVersionCloseDraft);
  const scopeVersionClose: ScopeVersionCloseEvent = {
    ...scopeVersionCloseDraft,
    validatedAt: closeValidation.validatedAt,
    immutable: closeValidation.valid,
  };
  const blockers = closeValidation.valid
    ? []
    : [createBlocker(input, "FIELD_CLOSE_REJECTED", "CRITICAL", "ScopeVersion FIELD_CLOSE validation rejected.")];
  const status = blockers.length ? "REJECTED" : "VALIDATED";
  const fieldClosureWithClose: FieldClosureEvent = {
    ...fieldClosure,
    status,
    scopeVersionClose: closeValidation.valid ? scopeVersionClose : undefined,
  };
  const diagnostics = [
    started,
    ...validation.diagnostics,
    ...(closeValidation.valid
      ? [diagnostic("FIELD_CLOSE_CREATED", "INFO", "ScopeVersion FIELD_CLOSE created for Field closure.", { closeId: scopeVersionClose.closeId })]
      : [diagnostic("FIELD_CLOSURE_REJECTED", "ERROR", "ScopeVersion FIELD_CLOSE rejected.", { errors: closeValidation.errors })]),
    diagnostic(status === "VALIDATED" ? "FIELD_CLOSURE_VALIDATED" : "FIELD_CLOSURE_REJECTED", status === "VALIDATED" ? "INFO" : "ERROR", `Field closure ${status}.`),
  ];
  const audit = createFieldClosureAudit(input, closeValidation.valid ? scopeVersionClose : undefined, blockers, diagnostics);

  console.info(status === "VALIDATED" ? "[FIELD_CLOSURE_VALIDATED]" : "[FIELD_CLOSURE_REJECTED]", {
    fieldClosureId: input.fieldClosureId,
    scopeVersionId: input.scopeVersionId,
    status,
  });

  return {
    fieldClosureId: input.fieldClosureId,
    status,
    fieldClosure: fieldClosureWithClose,
    scopeVersionCloseDraft,
    scopeVersionClose: closeValidation.valid ? scopeVersionClose : undefined,
    validation: {
      ...validation,
      valid: status === "VALIDATED",
      status,
      blockers,
      diagnostics: [...validation.diagnostics, ...diagnostics],
    },
    audit,
    diagnostics: [...diagnostics, ...audit.diagnostics],
  };
}

export function validateFieldClosure(input: FieldClosureEvaluationInput): FieldClosureValidation {
  const blockers = identifyFieldClosureBlockers(input);
  const valid = blockers.length === 0;
  const diagnostics = [
    ...blockerDiagnostics(blockers),
    diagnostic(valid ? "FIELD_CLOSURE_VALIDATED" : "FIELD_CLOSURE_REJECTED", valid ? "INFO" : "ERROR", `Field closure validation ${valid ? "passed" : "failed"}.`, {
      blockerCount: blockers.length,
    }),
  ];

  console.info(valid ? "[FIELD_CLOSURE_VALIDATED]" : "[FIELD_CLOSURE_REJECTED]", {
    fieldClosureId: input.fieldClosureId,
    blockerCount: blockers.length,
  });

  return {
    fieldClosureId: input.fieldClosureId,
    valid,
    status: valid ? "VALIDATED" : "REJECTED",
    blockers,
    diagnostics,
  };
}

export function createFieldClosureDraft(input: FieldClosureEvaluationInput): ScopeVersionCloseEvent {
  return createScopeVersionCloseDraft({
    closeId: `FIELD-CLOSE-${input.fieldClosureId}`,
    scopeVersionId: input.scopeVersionId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    closeType: FIELD_CLOSURE_AUTHORITY.scopeVersionCloseType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: input.evidence?.map((evidence) => evidence.evidenceId) ?? [],
    inputReferences: [
      {
        referenceId: input.workPackage?.workPackageId ?? "",
        referenceType: "WorkPackage",
        source: "FieldClosureAuthority",
        immutable: true,
      },
      ...((input.objectIds ?? []).map((objectId) => ({
        referenceId: objectId,
        referenceType: "Object",
        source: "FieldClosureAuthority",
        immutable: true,
      }))),
      ...((input.stationIds ?? []).map((stationId) => ({
        referenceId: stationId,
        referenceType: "Station",
        source: "FieldClosureAuthority",
        immutable: true,
      }))),
      ...((input.segmentIds ?? []).map((segmentId) => ({
        referenceId: segmentId,
        referenceType: "Segment",
        source: "FieldClosureAuthority",
        immutable: true,
      }))),
    ],
    constraintReferences: [
      {
        referenceId: input.fieldClosureType,
        referenceType: "FieldClosureType",
        source: "FieldClosureAuthority",
        immutable: true,
      },
    ],
    outcome: {
      status: "ACCEPTED",
      previousState: "FIELD_ACTIVE",
      resultingState: "FIELD_ACTIVE",
      notes: input.notes,
    },
  });
}

export function createFieldClosureAudit(
  input: FieldClosureEvaluationInput,
  close: ScopeVersionCloseEvent | undefined,
  blockers: readonly FieldClosureBlocker[] = identifyFieldClosureBlockers(input),
  diagnostics: readonly FieldClosureDiagnostic[] = [],
): FieldClosureAudit {
  const audit = {
    auditId: `FIELD-CLOSURE-AUDIT-${input.fieldClosureId}`,
    fieldClosureId: input.fieldClosureId,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    fieldClosureType: input.fieldClosureType,
    workPackageId: input.workPackage?.workPackageId ?? "",
    objectIds: input.objectIds ?? [],
    stationIds: input.stationIds ?? [],
    segmentIds: input.segmentIds ?? [],
    evidenceIds: input.evidence?.map((evidence) => evidence.evidenceId) ?? [],
    closeId: close?.closeId,
    blockerIds: blockers.map((blocker) => blocker.blockerId),
    timestamp: input.timestamp ?? nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("FIELD_CLOSURE_AUDIT_CREATED", "INFO", "Field closure audit created.", {
        closeId: close?.closeId,
        blockerCount: blockers.length,
      }),
    ],
  } satisfies FieldClosureAudit;

  console.info("[FIELD_CLOSURE_AUDIT_CREATED]", {
    auditId: audit.auditId,
    fieldClosureId: audit.fieldClosureId,
    closeId: audit.closeId,
  });

  return audit;
}

export function identifyFieldClosureBlockers(input: FieldClosureEvaluationInput): FieldClosureBlocker[] {
  const blockers: FieldClosureBlocker[] = [];

  if (!input.scopeVersionId) blockers.push(createBlocker(input, "MISSING_SCOPEVERSION_ID", "CRITICAL", "Field closure requires scopeVersionId."));
  if (!input.customerId) blockers.push(createBlocker(input, "MISSING_CUSTOMER_ID", "CRITICAL", "Field closure requires customerId."));
  if (!input.opportunityId) blockers.push(createBlocker(input, "MISSING_OPPORTUNITY_ID", "CRITICAL", "Field closure requires opportunityId."));
  if (!input.corridorId) blockers.push(createBlocker(input, "MISSING_CORRIDOR_ID", "CRITICAL", "Field closure requires corridorId."));
  if (input.lifecycleState !== "FIELD_ACTIVE") blockers.push(createBlocker(input, "FIELD_ACTIVE_REQUIRED", "CRITICAL", "Field closure requires FIELD_ACTIVE."));
  if (!input.workPackage) blockers.push(createBlocker(input, "MISSING_WORK_PACKAGE", "CRITICAL", "Field closure requires approved Work Package."));
  if (!input.evidence?.length) blockers.push(createBlocker(input, "MISSING_CLOSURE_EVIDENCE", "CRITICAL", "Field closure requires closure evidence."));
  if (!input.actorId || !input.actorRole) blockers.push(createBlocker(input, "MISSING_ACTOR_IDENTITY", "CRITICAL", "Field closure requires actor identity."));
  if (!input.fieldClosureType) blockers.push(createBlocker(input, "MISSING_CLOSURE_TYPE", "CRITICAL", "Field closure requires closure type."));
  if (!input.timestamp) blockers.push(createBlocker(input, "MISSING_TIMESTAMP", "HIGH", "Field closure requires timestamp."));
  if (!input.completionReferences?.length) blockers.push(createBlocker(input, "MISSING_COMPLETION_REFERENCES", "HIGH", "Field closure requires completion references."));
  if (fieldClosureRequiresObjects(input.fieldClosureType) && !input.objectIds?.length) {
    blockers.push(createBlocker(input, "MISSING_OBJECT_REFERENCES", "HIGH", "Field closure type requires object references."));
  }
  if (fieldClosureRequiresStations(input.fieldClosureType) && !input.stationIds?.length) {
    blockers.push(createBlocker(input, "MISSING_STATION_REFERENCES", "HIGH", "Field closure type requires station references."));
  }
  if (fieldClosureRequiresSegments(input.fieldClosureType) && !input.segmentIds?.length) {
    blockers.push(createBlocker(input, "MISSING_SEGMENT_REFERENCES", "HIGH", "Field closure type requires segment references."));
  }
  if (input.workPackage && !isApprovedWorkPackage(input)) {
    blockers.push(createBlocker(input, "UNAPPROVED_WORK_PACKAGE", "CRITICAL", "Field closure Work Package is not approved for this ScopeVersion."));
  }
  if (input.workPackage && input.scopeVersionId && input.workPackage.scopeVersionId !== input.scopeVersionId) {
    blockers.push(createBlocker(input, "TRACEABILITY_MISMATCH", "CRITICAL", "Work Package ScopeVersion traceability does not match closure."));
  }
  if (input.actorRole === "AI_ASSISTANT_ADVISORY") {
    blockers.push(createBlocker(input, "AI_ADVISORY_RECOMMENDATION", "CRITICAL", "AI advisory output cannot submit Field closure."));
  }

  const deduped = dedupeBlockers(blockers);
  for (const blocker of deduped) {
    console.info("[FIELD_CLOSURE_BLOCKER_IDENTIFIED]", {
      fieldClosureId: input.fieldClosureId,
      code: blocker.code,
      severity: blocker.severity,
    });
  }
  return deduped;
}

function buildFieldClosureEvent(input: FieldClosureEvaluationInput): FieldClosureEvent {
  return {
    fieldClosureId: input.fieldClosureId,
    fieldClosureType: input.fieldClosureType,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    lifecycleState: input.lifecycleState,
    workPackageId: input.workPackage?.workPackageId ?? "",
    actorId: input.actorId,
    actorRole: input.actorRole,
    objectIds: input.objectIds ?? [],
    stationIds: input.stationIds ?? [],
    segmentIds: input.segmentIds ?? [],
    disciplineIds: input.disciplineIds ?? [],
    completionReferences: input.completionReferences ?? [],
    evidence: input.evidence ?? [],
    timestamp: input.timestamp ?? nowIso(),
    status: "DRAFT",
  };
}

function isApprovedWorkPackage(input: FieldClosureEvaluationInput) {
  const workPackage = input.workPackage;
  if (!workPackage) return false;
  return (
    workPackage.status === "PLANNED" ||
    workPackage.status === "VALIDATED" ||
    workPackage.status === "READY_FOR_FIELD"
  );
}

function createBlocker(
  input: FieldClosureEvaluationInput,
  code: FieldClosureBlocker["code"],
  severity: FieldClosureBlockerSeverity,
  message: string,
): FieldClosureBlocker {
  return {
    blockerId: `FIELD-CLOSURE-BLOCKER-${input.fieldClosureId}-${code}`,
    code,
    severity,
    message,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly FieldClosureBlocker[]): FieldClosureDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic("FIELD_CLOSURE_BLOCKER_IDENTIFIED", blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "ERROR" : "WARNING", blocker.message, {
      blockerId: blocker.blockerId,
      code: blocker.code,
      severity: blocker.severity,
    }),
  );
}

function dedupeBlockers(blockers: readonly FieldClosureBlocker[]): FieldClosureBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    if (seen.has(blocker.code)) return false;
    seen.add(blocker.code);
    return true;
  });
}
