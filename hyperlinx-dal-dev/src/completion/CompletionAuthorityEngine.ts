import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../scopeversion/ScopeVersionCloseAuthorityEngine";
import {
  createTransitionAudit,
  evaluateTransition,
} from "../scopeversion/ScopeVersionTransitionAuthorityEngine";
import type {
  ScopeVersionCloseEvent,
  ScopeVersionCloseReference,
} from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionLifecycleAudit } from "../scopeversion/ScopeVersionLifecycle";
import {
  COMPLETION_AUTHORITY,
  statusFromBlockers,
  type CompletionAudit,
  type CompletionDraftInput,
  type CompletionResult,
  type CompletionValidation,
} from "./CompletionAuthority";
import {
  COMPLETION_REQUIREMENTS,
  type CompletionBlocker,
  type CompletionBlockerCode,
  type CompletionBlockerSeverity,
  type CompletionDiagnostic,
  type CompletionDiagnosticCode,
  type CompletionReadinessInput,
  type CompletionRequirement,
} from "./CompletionRequirement";

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: CompletionDiagnosticCode,
  severity: CompletionDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): CompletionDiagnostic {
  return { code, severity, message, details };
}

export function getCompletionRequirements(): readonly CompletionRequirement[] {
  return COMPLETION_REQUIREMENTS;
}

export function evaluateCompletionReadiness(input: CompletionReadinessInput): CompletionResult {
  const started = diagnostic("COMPLETION_EVALUATION_STARTED", "INFO", "Completion readiness evaluation started.", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });
  console.info("[COMPLETION_EVALUATION_STARTED]", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });

  const validation = validateCompletionRequirements(input);
  if (!validation.valid) {
    const diagnostics = [
      started,
      ...validation.diagnostics,
      diagnostic("COMPLETION_REJECTED", "ERROR", "Completion rejected by requirement validation.", {
        blockerCount: validation.blockers.length,
      }),
    ];
    const audit = createCompletionAudit(input, undefined, validation.blockers, [], diagnostics, validation.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: validation.status,
      validation,
      lifecycleAudits: [],
      audit,
      diagnostics: [...diagnostics, ...audit.diagnostics],
    };
  }

  const completionReviewTransition = evaluateTransition({
    scopeVersionId: input.scopeVersionId ?? "",
    previousState: COMPLETION_AUTHORITY.requiredLifecycleState,
    requestedState: COMPLETION_AUTHORITY.reviewState,
    actorId: input.actorId,
    actorRole: input.actorRole,
    closes: validation.validatedFieldCloseIds
      .map((closeId) => input.fieldCloses.find((close) => close.closeId === closeId))
      .filter((close): close is ScopeVersionCloseEvent => Boolean(close)),
  });

  if (!completionReviewTransition.approved) {
    const blockers = [
      ...validation.blockers,
      createBlocker(input, "LIFECYCLE_AUTHORITY_REJECTED", "CRITICAL", "Lifecycle authority rejected FIELD_ACTIVE to COMPLETION_REVIEW."),
    ];
    const rejectedValidation = {
      ...validation,
      valid: false,
      status: statusFromBlockers(blockers),
      blockers,
      diagnostics: [
        ...validation.diagnostics,
        diagnostic("COMPLETION_REJECTED", "ERROR", "Completion review lifecycle transition rejected.", {
          transitionId: completionReviewTransition.transitionId,
        }),
      ],
    } satisfies CompletionValidation;
    const audit = createCompletionAudit(input, undefined, blockers, [], rejectedValidation.diagnostics, rejectedValidation.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: rejectedValidation.status,
      validation: rejectedValidation,
      completionReviewTransition,
      lifecycleAudits: [createTransitionAudit(completionReviewTransition)],
      audit,
      diagnostics: [started, ...rejectedValidation.diagnostics, ...audit.diagnostics],
    };
  }

  const completionCloseDraft = createCompletionDraft({ ...input, validation });
  const closeValidation = validateScopeVersionClose(completionCloseDraft);
  const completionClose: ScopeVersionCloseEvent = {
    ...completionCloseDraft,
    validatedAt: closeValidation.validatedAt,
    immutable: closeValidation.valid,
  };

  if (!closeValidation.valid) {
    const blockers = [
      ...validation.blockers,
      createBlocker(input, "COMPLETION_CLOSE_REJECTED", "CRITICAL", "ScopeVersion COMPLETION_CLOSE validation rejected."),
    ];
    const rejectedValidation = {
      ...validation,
      valid: false,
      status: statusFromBlockers(blockers),
      blockers,
      diagnostics: [
        ...validation.diagnostics,
        diagnostic("COMPLETION_REJECTED", "ERROR", "ScopeVersion COMPLETION_CLOSE rejected.", {
          errors: closeValidation.errors,
        }),
      ],
    } satisfies CompletionValidation;
    const reviewAudit = createTransitionAudit(completionReviewTransition);
    const audit = createCompletionAudit(input, completionClose, blockers, [reviewAudit], rejectedValidation.diagnostics, rejectedValidation.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: rejectedValidation.status,
      validation: rejectedValidation,
      completionCloseDraft,
      completionReviewTransition,
      lifecycleAudits: [reviewAudit],
      audit,
      diagnostics: [started, ...rejectedValidation.diagnostics, ...audit.diagnostics],
    };
  }

  console.info("[COMPLETION_CLOSE_CREATED]", {
    closeId: completionClose.closeId,
    scopeVersionId: completionClose.scopeVersionId,
  });

  const completionTransition = evaluateTransition({
    scopeVersionId: input.scopeVersionId ?? "",
    previousState: COMPLETION_AUTHORITY.reviewState,
    requestedState: COMPLETION_AUTHORITY.completedState,
    actorId: input.actorId,
    actorRole: input.actorRole,
    closes: [...validatedFieldCloses(input), completionClose],
  });
  const lifecycleAudits = [
    createTransitionAudit(completionReviewTransition),
    createTransitionAudit(completionTransition),
  ];

  if (!completionTransition.approved) {
    const blockers = [
      ...validation.blockers,
      createBlocker(input, "LIFECYCLE_AUTHORITY_REJECTED", "CRITICAL", "Lifecycle authority rejected COMPLETION_REVIEW to COMPLETE."),
    ];
    const rejectedValidation = {
      ...validation,
      valid: false,
      status: statusFromBlockers(blockers),
      blockers,
      diagnostics: [
        ...validation.diagnostics,
        diagnostic("COMPLETION_REJECTED", "ERROR", "Completion lifecycle transition rejected.", {
          transitionId: completionTransition.transitionId,
        }),
      ],
    } satisfies CompletionValidation;
    const audit = createCompletionAudit(input, completionClose, blockers, lifecycleAudits, rejectedValidation.diagnostics, rejectedValidation.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: rejectedValidation.status,
      validation: rejectedValidation,
      completionCloseDraft,
      completionClose,
      completionReviewTransition,
      completionTransition,
      lifecycleAudits,
      audit,
      diagnostics: [started, ...rejectedValidation.diagnostics, ...audit.diagnostics],
    };
  }

  const diagnostics = [
    started,
    ...validation.diagnostics,
    diagnostic("COMPLETION_CLOSE_CREATED", "INFO", "ScopeVersion COMPLETION_CLOSE created.", {
      closeId: completionClose.closeId,
    }),
    diagnostic("COMPLETION_APPROVED", "INFO", "Completion approved by Completion Authority.", {
      scopeVersionId: input.scopeVersionId,
      completionCloseId: completionClose.closeId,
    }),
  ];
  const completeValidation = {
    ...validation,
    status: "COMPLETE",
    diagnostics: [...validation.diagnostics, ...diagnostics],
  } satisfies CompletionValidation;
  const audit = createCompletionAudit(input, completionClose, [], lifecycleAudits, diagnostics, "COMPLETE");

  console.info("[COMPLETION_APPROVED]", {
    scopeVersionId: input.scopeVersionId,
    closeId: completionClose.closeId,
  });

  return {
    scopeVersionId: input.scopeVersionId,
    status: "COMPLETE",
    validation: completeValidation,
    completionCloseDraft,
    completionClose,
    completionReviewTransition,
    completionTransition,
    lifecycleAudits,
    audit,
    diagnostics: [...diagnostics, ...audit.diagnostics],
  };
}

export function validateCompletionRequirements(input: CompletionReadinessInput): CompletionValidation {
  const blockers = identifyCompletionBlockers(input);
  const valid = blockers.length === 0;
  const closedWorkPackageIds = closedReferenceIds(input, "WorkPackage");
  const closedObjectIds = closedReferenceIds(input, "Object");
  const closedStationIds = closedReferenceIds(input, "Station");
  const closedSegmentIds = closedReferenceIds(input, "Segment");
  const closedDeliverableIds = closedDeliverableReferences(input);
  const validatedFieldCloseIds = validatedFieldCloses(input).map((close) => close.closeId);
  const status = valid ? "READY_FOR_COMPLETION" : statusFromBlockers(blockers);
  const diagnostics = [
    ...blockerDiagnostics(blockers),
    diagnostic(valid ? "COMPLETION_READY" : "COMPLETION_REJECTED", valid ? "INFO" : "ERROR", `Completion requirements ${valid ? "passed" : "failed"}.`, {
      blockerCount: blockers.length,
      status,
    }),
  ];

  for (const requirement of COMPLETION_REQUIREMENTS) {
    console.info("[COMPLETION_REQUIREMENT_VALIDATED]", {
      requirementId: requirement.requirementId,
      scopeVersionId: input.scopeVersionId,
      valid: valid || !blockers.some((blocker) => blocker.code === requirement.blockerCode),
    });
  }

  console.info(valid ? "[COMPLETION_READY]" : "[COMPLETION_REJECTED]", {
    scopeVersionId: input.scopeVersionId,
    status,
    blockerCount: blockers.length,
  });

  return {
    scopeVersionId: input.scopeVersionId,
    valid,
    status,
    blockers,
    closedWorkPackageIds,
    closedObjectIds,
    closedStationIds,
    closedSegmentIds,
    closedDeliverableIds,
    validatedFieldCloseIds,
    diagnostics,
  };
}

export function identifyCompletionBlockers(input: CompletionReadinessInput): CompletionBlocker[] {
  const blockers: CompletionBlocker[] = [];
  const addMissing = (
    code: CompletionBlockerCode,
    severity: CompletionBlockerSeverity,
    message: string,
    referenceId?: string,
  ) => blockers.push(createBlocker(input, code, severity, message, referenceId));

  if (!input.scopeVersionId) addMissing("MISSING_SCOPEVERSION_ID", "CRITICAL", "Completion requires scopeVersionId.");
  if (!input.customerId) addMissing("MISSING_CUSTOMER_ID", "CRITICAL", "Completion requires customerId.");
  if (!input.opportunityId) addMissing("MISSING_OPPORTUNITY_ID", "CRITICAL", "Completion requires opportunityId.");
  if (!input.corridorId) addMissing("MISSING_CORRIDOR_ID", "CRITICAL", "Completion requires corridorId.");
  if (input.lifecycleState !== COMPLETION_AUTHORITY.requiredLifecycleState) {
    addMissing("FIELD_ACTIVE_REQUIRED", "CRITICAL", "Completion requires FIELD_ACTIVE.");
  }
  if (input.actorRole === "AI_ASSISTANT_ADVISORY") {
    addMissing("AI_ADVISORY_RECOMMENDATION", "CRITICAL", "AI advisory output cannot approve completion.");
  }
  if (validatedFieldCloses(input).length === 0) {
    addMissing("MISSING_FIELD_CLOSE", "CRITICAL", "Completion requires validated FIELD_CLOSE events.");
  }

  missingIds(input.requiredWorkPackageIds, closedReferenceIds(input, "WorkPackage")).forEach((id) =>
    addMissing("MISSING_WORK_PACKAGE_CLOSE", "CRITICAL", "Required Work Package is not closed.", id),
  );
  missingIds(input.requiredObjectIds, closedReferenceIds(input, "Object")).forEach((id) =>
    addMissing("MISSING_OBJECT_CLOSE", "HIGH", "Required Object is not closed.", id),
  );
  missingIds(input.requiredStationIds, closedReferenceIds(input, "Station")).forEach((id) =>
    addMissing("MISSING_STATION_CLOSE", "HIGH", "Required Station is not closed.", id),
  );
  missingIds(input.requiredSegmentIds, closedReferenceIds(input, "Segment")).forEach((id) =>
    addMissing("MISSING_SEGMENT_CLOSE", "HIGH", "Required Segment is not closed.", id),
  );
  missingIds(input.requiredDeliverableIds, closedDeliverableReferences(input)).forEach((id) =>
    addMissing("MISSING_DELIVERABLE_CLOSE", "HIGH", "Required Deliverable is not closed.", id),
  );
  if (!acceptedCriteria(input).length) {
    addMissing("MISSING_ACCEPTANCE_CRITERIA", "CRITICAL", "Completion requires accepted acceptance criteria.");
  }
  (input.unresolvedCriticalBlockers ?? []).forEach((id) =>
    addMissing("UNRESOLVED_CRITICAL_BLOCKER", "CRITICAL", "Unresolved critical blocker prevents completion.", id),
  );

  const deduped = dedupeBlockers(blockers);
  for (const blocker of deduped) {
    console.info("[COMPLETION_BLOCKER_IDENTIFIED]", {
      scopeVersionId: input.scopeVersionId,
      code: blocker.code,
      severity: blocker.severity,
      referenceId: blocker.referenceId,
    });
  }
  return deduped;
}

export function createCompletionDraft(input: CompletionDraftInput): ScopeVersionCloseEvent {
  const evidenceIds = unique([
    ...input.validation.validatedFieldCloseIds,
    ...validatedFieldCloses(input).flatMap((close) => close.evidenceIds),
    ...(input.acceptances ?? []).flatMap((acceptance) => acceptance.evidenceIds),
  ]);

  return createScopeVersionCloseDraft({
    closeId: `COMPLETION-CLOSE-${input.scopeVersionId ?? "MISSING"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    closeType: COMPLETION_AUTHORITY.scopeVersionCloseType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    createdAt: input.createdAt,
    evidenceIds,
    inputReferences: [
      ...validatedFieldCloses(input).map((close) => reference(close.closeId, "FIELD_CLOSE", "CompletionAuthority")),
      ...acceptedCriteria(input).map((acceptance) => reference(acceptance.acceptanceId, acceptance.acceptanceType, "CompletionAcceptance")),
      ...((input.requiredWorkPackageIds ?? []).map((id) => reference(id, "WorkPackage", "CompletionRequirement"))),
      ...((input.requiredObjectIds ?? []).map((id) => reference(id, "Object", "CompletionRequirement"))),
      ...((input.requiredStationIds ?? []).map((id) => reference(id, "Station", "CompletionRequirement"))),
      ...((input.requiredSegmentIds ?? []).map((id) => reference(id, "Segment", "CompletionRequirement"))),
      ...((input.requiredDeliverableIds ?? []).map((id) => reference(id, "Deliverable", "CompletionRequirement"))),
    ],
    constraintReferences: [
      reference(COMPLETION_AUTHORITY.authorityId, "CompletionAuthority", "CompletionAuthority"),
      reference(COMPLETION_AUTHORITY.requiredLifecycleState, "RequiredLifecycleState", "CompletionAuthority"),
    ],
    outcome: {
      status: "ACCEPTED",
      previousState: COMPLETION_AUTHORITY.reviewState,
      resultingState: COMPLETION_AUTHORITY.completedState,
      notes: input.notes,
    },
  });
}

export function createCompletionAudit(
  input: CompletionReadinessInput,
  close: ScopeVersionCloseEvent | undefined,
  blockers: readonly CompletionBlocker[] = identifyCompletionBlockers(input),
  lifecycleAudits: readonly ScopeVersionLifecycleAudit[] = [],
  diagnostics: readonly CompletionDiagnostic[] = [],
  status = statusFromBlockers(blockers),
): CompletionAudit {
  const audit = {
    auditId: `COMPLETION-AUDIT-${input.scopeVersionId ?? "MISSING"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    status,
    closeId: close?.closeId,
    blockerIds: blockers.map((blocker) => blocker.blockerId),
    validatedFieldCloseIds: validatedFieldCloses(input).map((fieldClose) => fieldClose.closeId),
    lifecycleTransitionIds: lifecycleAudits.map((auditRecord) => auditRecord.auditId),
    timestamp: nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("COMPLETION_AUDIT_CREATED", "INFO", "Completion audit created.", {
        closeId: close?.closeId,
        blockerCount: blockers.length,
      }),
    ],
  } satisfies CompletionAudit;

  console.info("[COMPLETION_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    closeId: audit.closeId,
  });

  return audit;
}

function validatedFieldCloses(input: Pick<CompletionReadinessInput, "fieldCloses" | "scopeVersionId">): ScopeVersionCloseEvent[] {
  return input.fieldCloses.filter(
    (close) =>
      close.closeType === "FIELD_CLOSE" &&
      close.scopeVersionId === input.scopeVersionId &&
      close.immutable === true &&
      Boolean(close.validatedAt),
  );
}

function closedReferenceIds(input: CompletionReadinessInput, referenceType: string): string[] {
  return unique(
    validatedFieldCloses(input)
      .flatMap((close) => close.inputReferences)
      .filter((ref) => ref.referenceType === referenceType && ref.referenceId)
      .map((ref) => ref.referenceId),
  );
}

function closedDeliverableReferences(input: CompletionReadinessInput): string[] {
  return unique([
    ...validatedFieldCloses(input)
      .flatMap((close) => [...close.inputReferences, ...close.constraintReferences])
      .filter((ref) => ref.referenceType === "Deliverable" && ref.referenceId)
      .map((ref) => ref.referenceId),
    ...(input.acceptances ?? []).flatMap((acceptance) => acceptance.referenceIds),
  ]);
}

function acceptedCriteria(input: CompletionReadinessInput) {
  return (input.acceptances ?? []).filter((acceptance) => acceptance.accepted);
}

function missingIds(required: readonly string[] | undefined, closed: readonly string[]) {
  if (!required?.length) return [];
  const closedSet = new Set(closed);
  return required.filter((id) => !closedSet.has(id));
}

function createBlocker(
  input: CompletionReadinessInput,
  code: CompletionBlockerCode,
  severity: CompletionBlockerSeverity,
  message: string,
  referenceId?: string,
): CompletionBlocker {
  return {
    blockerId: `COMPLETION-BLOCKER-${input.scopeVersionId ?? "MISSING"}-${code}${referenceId ? `-${referenceId}` : ""}`,
    code,
    severity,
    message,
    referenceId,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly CompletionBlocker[]): CompletionDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic(
      "COMPLETION_BLOCKER_IDENTIFIED",
      blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "ERROR" : "WARNING",
      blocker.message,
      {
        blockerId: blocker.blockerId,
        code: blocker.code,
        severity: blocker.severity,
        referenceId: blocker.referenceId,
      },
    ),
  );
}

function reference(referenceId: string, referenceType: string, source: string): ScopeVersionCloseReference {
  return {
    referenceId,
    referenceType,
    source,
    immutable: true,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function dedupeBlockers(blockers: readonly CompletionBlocker[]): CompletionBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.referenceId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
